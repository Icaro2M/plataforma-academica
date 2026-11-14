import 'server-only';
import { randomUUID } from 'node:crypto';
import { all, one, run, transaction } from './db';
import { createNotification, normalizeSubjectName } from './store';
import { isValidFullName, isValidRegistration, normalizeCpf, normalizeFullName, normalizeRegistration, validateBirthDate } from './verification';

// ---------------------------------------------------------------------------
// Leitura da planilha (.xlsx ou .csv)
// ---------------------------------------------------------------------------

export type RosterField = 'nome' | 'cpf' | 'nascimento' | 'matricula' | 'email' | 'curso' | 'disciplina';
export const rosterColumns: RosterField[] = ['nome', 'cpf', 'nascimento', 'matricula', 'email', 'curso', 'disciplina'];
const requiredColumns: RosterField[] = ['nome', 'cpf', 'disciplina'];

const headerAliases: Record<RosterField, string[]> = {
  nome: ['nome', 'nomecompleto', 'nomedomonitor', 'monitor', 'aluno', 'estudante'],
  cpf: ['cpf', 'cpfdomonitor', 'numerodocpf'],
  nascimento: ['nascimento', 'datadenascimento', 'datanascimento', 'dtnascimento', 'datanasc', 'nasc'],
  matricula: ['matricula', 'numerodematricula', 'numeromatricula', 'ra', 'registroacademico'],
  email: ['email', 'emailinstitucional', 'correioeletronico'],
  curso: ['curso', 'nomedocurso'],
  disciplina: ['disciplina', 'cadeira', 'cadeiradamonitoria', 'materia', 'codigodadisciplina', 'disciplinacodigo', 'componentecurricular'],
};

/** "Data de Nascimento" → "datadenascimento"; "E-mail" → "email"; "Matrícula" → "matricula". */
export function normalizeHeader(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function headerField(value: unknown): RosterField | null {
  const key = normalizeHeader(value);
  if (!key) return null;
  for (const field of rosterColumns) if (headerAliases[field].includes(key)) return field;
  return null;
}

/** CSV com separador ";" ou "," (detectado pelo cabeçalho), aspas e BOM UTF-8. */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^﻿/, '');
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) && firstLine.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === separator) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[index + 1] === '\n') index++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
}

export type RawRosterRow = { line: number; nome: string; cpf: string; nascimento: string | Date; matricula: string; email: string; curso: string; disciplina: string };

function cellText(value: unknown, field: RosterField) {
  if (value === null || value === undefined) return '';
  // CPF e matrícula lidos como número perdem zeros à esquerda na planilha.
  if (typeof value === 'number' && field === 'cpf') return String(Math.trunc(value)).padStart(11, '0');
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

/** Converte a tabela (primeira linha = cabeçalho) em linhas da planilha de monitores. */
export function tableToRoster(table: unknown[][]): { rows: RawRosterRow[]; error?: string } {
  const headerIndex = table.findIndex(cells => cells.some(cell => headerField(cell)));
  if (headerIndex < 0) return { rows: [], error: 'Cabeçalho não encontrado. Use as colunas: nome, cpf, nascimento, matricula, email, curso, disciplina.' };
  const positions = new Map<RosterField, number>();
  table[headerIndex].forEach((cell, index) => { const field = headerField(cell); if (field && !positions.has(field)) positions.set(field, index); });
  const missing = requiredColumns.filter(field => !positions.has(field));
  if (missing.length) return { rows: [], error: `Coluna obrigatória ausente: ${missing.join(', ')}.` };
  const rows = table.slice(headerIndex + 1).map((cells, offset) => {
    const get = (field: RosterField) => { const position = positions.get(field); return position === undefined ? '' : cellText(cells[position], field); };
    const birthPosition = positions.get('nascimento');
    const birthCell = birthPosition === undefined ? '' : cells[birthPosition];
    return {
      line: headerIndex + offset + 2,
      nome: get('nome'), cpf: get('cpf'),
      nascimento: birthCell instanceof Date ? birthCell : get('nascimento'),
      matricula: get('matricula'), email: get('email').toLowerCase(), curso: get('curso'), disciplina: get('disciplina'),
    };
  }).filter(row => row.nome || row.cpf || row.disciplina);
  return { rows };
}

/** Lê um arquivo .xlsx (read-excel-file) ou .csv enviado pelo gestor. */
export async function readRosterFile(fileName: string, bytes: Buffer): Promise<{ rows: RawRosterRow[]; error?: string }> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return tableToRoster(parseCsv(bytes.toString('utf8')));
  if (lower.endsWith('.xlsx')) {
    try {
      const { readSheet } = await import('read-excel-file/node');
      return tableToRoster(await readSheet(bytes) as unknown[][]);
    } catch {
      return { rows: [], error: 'Não foi possível ler a planilha .xlsx. Confira se o arquivo não está corrompido.' };
    }
  }
  return { rows: [], error: 'Envie um arquivo .xlsx ou .csv.' };
}

export const rosterTemplateCsv = '﻿nome;cpf;nascimento;matricula;email;curso;disciplina\r\nMaria da Silva;529.982.247-25;15/03/2003;2023001234;maria.silva@exemplo.edu.br;Ciência da Computação;CC102\r\n';

// ---------------------------------------------------------------------------
// Validação contra o catálogo da instituição
// ---------------------------------------------------------------------------

type CatalogCourse = { id: number; name: string };
type CatalogSubject = { id: number; course_id: number; name: string; code: string };
export type RosterEntry = { fullName: string; cpf: string; birthDate: string | null; registration: string | null; email: string | null; courseId: number; subjectId: number };

async function institutionCatalog(institutionId: number) {
  const [courses, subjects] = await Promise.all([
    all<CatalogCourse>('SELECT id,name FROM courses WHERE institution_id=?', institutionId),
    all<CatalogSubject>('SELECT s.id,s.course_id,s.name,s.code FROM subjects s JOIN courses c ON c.id=s.course_id WHERE c.institution_id=?', institutionId),
  ]);
  return { courses, subjects };
}

export function resolveRosterRow(row: Omit<RawRosterRow, 'line'>, catalog: { courses: CatalogCourse[]; subjects: CatalogSubject[] }): { entry: RosterEntry } | { error: string } {
  if (!isValidFullName(row.nome)) return { error: 'nome completo inválido' };
  const cpf = normalizeCpf(row.cpf);
  if (!cpf) return { error: 'CPF inválido' };
  const birthDate = row.nascimento === '' ? null : validateBirthDate(row.nascimento);
  if (row.nascimento !== '' && !birthDate) return { error: 'data de nascimento inválida' };
  const registration = row.matricula ? normalizeRegistration(row.matricula) : null;
  if (registration && !isValidRegistration(registration)) return { error: 'matrícula inválida' };
  const email = row.email ? row.email.trim().toLowerCase() : null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: 'e-mail inválido' };
  let course: CatalogCourse | undefined;
  if (row.curso) {
    course = catalog.courses.find(item => normalizeSubjectName(item.name) === normalizeSubjectName(row.curso));
    if (!course) return { error: `curso "${row.curso}" não pertence à instituição` };
  }
  const subjectKey = normalizeSubjectName(row.disciplina);
  const candidates = catalog.subjects.filter(subject => (!course || subject.course_id === course.id) && (subject.code.toUpperCase() === row.disciplina.trim().toUpperCase() || normalizeSubjectName(subject.name) === subjectKey));
  if (!row.disciplina || !candidates.length) return { error: `disciplina "${row.disciplina}" não encontrada${course ? ` no curso ${course.name}` : ''}` };
  if (candidates.length > 1) return { error: `disciplina "${row.disciplina}" existe em mais de um curso; informe o curso` };
  return { entry: { fullName: normalizeFullName(row.nome), cpf, birthDate, registration, email, courseId: candidates[0].course_id, subjectId: candidates[0].id } };
}

// ---------------------------------------------------------------------------
// Vinculação automática: quem está na planilha vira MONITOR verificado
// ---------------------------------------------------------------------------

type RosterRow = { id: string; institution_id: number; full_name: string; cpf: string; birth_date: string | null; registration: string | null; subject_id: number };

/** Promove a conta a monitor verificado e vincula as disciplinas das linhas da planilha. */
export async function linkRosterToUser(userId: string, rosterIds: string[]) {
  if (!rosterIds.length) return false;
  const placeholders = rosterIds.map(() => '?').join(',');
  const result = await transaction(async tx => {
    const user = (await run(tx, 'SELECT id,role,verified,cpf,institution_id FROM users WHERE id=?', userId)).rows[0] as unknown as { id: string; role: string; verified: number; cpf: string | null; institution_id: number | null } | undefined;
    if (!user || !['STUDENT', 'MONITOR'].includes(user.role)) return null;
    const rows = (await run(tx, `SELECT id,institution_id,full_name,cpf,birth_date,registration,subject_id FROM monitor_roster WHERE id IN (${placeholders}) AND institution_id=?`, ...rosterIds, user.institution_id)).rows as unknown as RosterRow[];
    if (!rows.length) return null;
    const first = rows[0];
    const cpfFree = !(await run(tx, 'SELECT 1 FROM users WHERE cpf=? AND id<>?', first.cpf, userId)).rows.length;
    await run(tx, `UPDATE users SET role='MONITOR',verified=1,full_name=COALESCE(full_name,?),birth_date=COALESCE(birth_date,?),registration=COALESCE(registration,?)${cpfFree ? ',cpf=COALESCE(cpf,?)' : ''} WHERE id=?`, first.full_name, first.birth_date, first.registration, ...(cpfFree ? [first.cpf] : []), userId);
    for (const row of rows) {
      await run(tx, "INSERT INTO monitor_subjects (user_id,subject_id,source) VALUES (?,?,'ROSTER') ON CONFLICT(user_id,subject_id) DO UPDATE SET source='ROSTER'", userId, row.subject_id);
      await run(tx, 'UPDATE monitor_roster SET linked_user_id=? WHERE id=?', userId, row.id);
    }
    await run(tx, "UPDATE role_requests SET status='APPROVED',roster_match=1,reviewed_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='PENDING' AND requested_role='MONITOR'", userId);
    return { promoted: user.role !== 'MONITOR' || !user.verified };
  });
  if (!result) return false;
  if (result.promoted) await createNotification(userId, 'ROLE_REQUEST_REVIEWED', null, 'PROFILE', `roster-${userId}`, 'Você foi verificado como monitor', 'Seu nome consta na planilha de monitores da instituição.');
  return true;
}

/** (a) Na importação: conta existente na instituição com o mesmo CPF ou e-mail. */
async function linkExistingAccount(institutionId: number, rosterId: string, cpf: string, email: string | null) {
  const account = await one<{ id: string }>('SELECT id FROM users WHERE institution_id=? AND (cpf=? OR (? IS NOT NULL AND email=?)) ORDER BY CASE WHEN cpf=? THEN 0 ELSE 1 END LIMIT 1', institutionId, cpf, email, email, cpf);
  return account ? linkRosterToUser(account.id, [rosterId]) : false;
}

/** (b) Ao se cadastrar com um e-mail que consta na planilha da instituição. */
export async function autoVerifyByEmail(userId: string) {
  const rows = await all<{ id: string }>('SELECT r.id FROM monitor_roster r JOIN users u ON u.institution_id=r.institution_id AND u.email=r.email WHERE u.id=? AND r.linked_user_id IS NULL', userId);
  return linkRosterToUser(userId, rows.map(row => row.id));
}

/** (c) Ao pedir verificação com o mesmo CPF e matrícula da planilha. */
export async function findRosterMatch(institutionId: number, cpf: string, registration: string) {
  return all<{ id: string; subject_id: number }>('SELECT id,subject_id FROM monitor_roster WHERE institution_id=? AND cpf=? AND upper(registration)=? AND linked_user_id IS NULL', institutionId, cpf, normalizeRegistration(registration));
}

export async function rosterHasCpf(institutionId: number, cpf: string) {
  return Boolean(await one('SELECT 1 FROM monitor_roster WHERE institution_id=? AND cpf=?', institutionId, cpf));
}

// ---------------------------------------------------------------------------
// Importação e cadastro manual
// ---------------------------------------------------------------------------

export type ImportResult = { inserted: number; updated: number; linked: number; errors: { line: number; message: string }[] };

export async function saveRosterEntries(institutionId: number, rows: RawRosterRow[], createdBy: string | null): Promise<ImportResult> {
  const catalog = await institutionCatalog(institutionId);
  const result: ImportResult = { inserted: 0, updated: 0, linked: 0, errors: [] };
  for (const row of rows) {
    const resolved = resolveRosterRow(row, catalog);
    if ('error' in resolved) { result.errors.push({ line: row.line, message: resolved.error }); continue; }
    const entry = resolved.entry;
    const existing = await one<{ id: string; linked_user_id: string | null }>('SELECT id,linked_user_id FROM monitor_roster WHERE institution_id=? AND cpf=? AND subject_id=?', institutionId, entry.cpf, entry.subjectId);
    const id = existing?.id ?? randomUUID();
    await transaction(tx => run(tx,
      `INSERT INTO monitor_roster (id,institution_id,full_name,cpf,birth_date,registration,email,course_id,subject_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(institution_id,cpf,subject_id) DO UPDATE SET full_name=excluded.full_name,birth_date=COALESCE(excluded.birth_date,birth_date),registration=COALESCE(excluded.registration,registration),email=COALESCE(excluded.email,email),course_id=excluded.course_id`,
      id, institutionId, entry.fullName, entry.cpf, entry.birthDate, entry.registration, entry.email, entry.courseId, entry.subjectId, createdBy));
    if (existing) result.updated++; else result.inserted++;
    if (!existing?.linked_user_id && await linkExistingAccount(institutionId, id, entry.cpf, entry.email)) result.linked++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Encerramento e consultas da página do gestor
// ---------------------------------------------------------------------------

/** Remove a monitoria; a conta volta a ser aluno quando não restam disciplinas de monitoria. */
export async function endMonitorship(institutionId: number, target: { rosterId: string } | { userId: string }) {
  return transaction(async tx => {
    let userId: string | null = null;
    if ('rosterId' in target) {
      const row = (await run(tx, 'SELECT linked_user_id,subject_id FROM monitor_roster WHERE id=? AND institution_id=?', target.rosterId, institutionId)).rows[0] as unknown as { linked_user_id: string | null; subject_id: number } | undefined;
      if (!row) return false;
      await run(tx, 'DELETE FROM monitor_roster WHERE id=?', target.rosterId);
      userId = row.linked_user_id;
      if (userId) await run(tx, 'DELETE FROM monitor_subjects WHERE user_id=? AND subject_id=?', userId, row.subject_id);
    } else {
      const user = (await run(tx, "SELECT id FROM users WHERE id=? AND institution_id=? AND role='MONITOR'", target.userId, institutionId)).rows[0];
      if (!user) return false;
      userId = target.userId;
      await run(tx, 'DELETE FROM monitor_roster WHERE institution_id=? AND linked_user_id=?', institutionId, userId);
      await run(tx, 'DELETE FROM monitor_subjects WHERE user_id=?', userId);
    }
    if (userId) {
      const remaining = (await run(tx, 'SELECT count(*) count FROM monitor_subjects WHERE user_id=?', userId)).rows[0] as unknown as { count: number };
      if (!Number(remaining.count)) await run(tx, "UPDATE users SET role='STUDENT',verified=0,student_mode=0 WHERE id=? AND role='MONITOR'", userId);
    }
    return true;
  });
}

export type RosterListItem = { id: string; full_name: string; cpf: string; registration: string | null; email: string | null; course_name: string | null; subject_name: string; subject_code: string; linked_user_id: string | null; linked_user_name: string | null; created_at: string };
export async function getRoster(institutionId: number) {
  return all<RosterListItem>(`SELECT r.id,r.full_name,r.cpf,r.registration,r.email,c.name course_name,s.name subject_name,s.code subject_code,r.linked_user_id,u.name linked_user_name,r.created_at
    FROM monitor_roster r JOIN subjects s ON s.id=r.subject_id LEFT JOIN courses c ON c.id=r.course_id LEFT JOIN users u ON u.id=r.linked_user_id
    WHERE r.institution_id=? ORDER BY r.full_name,s.name`, institutionId);
}

/** Monitores verificados da instituição que não vieram da planilha (aprovação manual). */
export async function getMonitorsWithoutRoster(institutionId: number) {
  return all<{ id: string; name: string; email: string; cpf: string | null; subjects: string | null }>(`SELECT u.id,u.name,u.email,u.cpf,(SELECT group_concat(s.name,', ') FROM monitor_subjects ms JOIN subjects s ON s.id=ms.subject_id WHERE ms.user_id=u.id) subjects
    FROM users u WHERE u.institution_id=? AND u.role='MONITOR' AND NOT EXISTS (SELECT 1 FROM monitor_roster r WHERE r.linked_user_id=u.id) ORDER BY u.name`, institutionId);
}

export type PendingVerification = { id: string; user_id: string; user_name: string; email: string; institution_name: string | null; requested_role: string; full_name: string | null; cpf: string | null; birth_date: string | null; registration: string | null; course_name: string | null; subject_name: string | null; details: string; created_at: string; in_roster: number };
export async function getPendingVerifications(institutionId?: number, role?: 'MONITOR' | 'PROFESSOR') {
  return all<PendingVerification>(`SELECT r.id,r.user_id,u.name user_name,u.email,i.name institution_name,r.requested_role,r.full_name,r.cpf,r.birth_date,r.registration,c.name course_name,s.name subject_name,r.details,r.created_at,
    (r.roster_match=1 OR EXISTS (SELECT 1 FROM monitor_roster m WHERE m.institution_id=u.institution_id AND m.cpf=r.cpf)) in_roster
    FROM role_requests r JOIN users u ON u.id=r.user_id LEFT JOIN institutions i ON i.id=u.institution_id LEFT JOIN courses c ON c.id=r.course_id LEFT JOIN subjects s ON s.id=r.subject_id
    WHERE r.status='PENDING' ${institutionId ? 'AND u.institution_id=?' : ''} ${role ? 'AND r.requested_role=?' : ''} ORDER BY r.created_at`, ...(institutionId ? [institutionId] : []), ...(role ? [role] : []));
}
