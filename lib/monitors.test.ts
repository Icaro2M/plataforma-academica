import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('server-only', () => ({}));

let monitors: typeof import('./monitors');
let store: typeof import('./store');
let db: typeof import('./db');
let unifor: number;
let compCourse: number;
const testDirectory = mkdtempSync(path.join(tmpdir(), 'conecta-monitors-'));

beforeAll(async () => {
  process.env.ACADEMIA_DB_PATH = path.join(testDirectory, 'test.libsql');
  vi.resetModules();
  db = await import('./db');
  store = await import('./store');
  monitors = await import('./monitors');
  await db.ensureSchema();
  unifor = (await db.one<{ id: number }>("SELECT id FROM institutions WHERE acronym='UNIFOR'"))!.id;
  compCourse = (await db.one<{ id: number }>("SELECT id FROM courses WHERE institution_id=? AND name='Ciência da Computação'", unifor))!.id;
});

afterAll(() => {
  db.closeDatabaseForTests();
  delete process.env.ACADEMIA_DB_PATH;
});

const role = async (userId: string) => db.one<{ role: string; verified: number }>('SELECT role,verified FROM users WHERE id=?', userId);
const subjectsOf = async (userId: string) => (await store.getMonitorSubjects(userId)).map(subject => subject.code).sort();
const row = (overrides: Partial<import('./monitors').RawRosterRow>) => ({ line: 2, nome: 'Maria da Silva', cpf: '529.982.247-25', nascimento: '15/03/2003', matricula: '2023001234', email: '', curso: 'Ciência da Computação', disciplina: 'CC102', ...overrides });

describe('leitura da planilha', () => {
  it('lê CSV com BOM, separador ";" e campos entre aspas', () => {
    const rows = monitors.parseCsv('﻿nome;cpf;disciplina\r\n"Silva; Maria";529.982.247-25;"Banco ""de"" Dados"\r\n\r\n');
    expect(rows).toEqual([['nome', 'cpf', 'disciplina'], ['Silva; Maria', '529.982.247-25', 'Banco "de" Dados']]);
  });
  it('lê CSV separado por vírgula', () => {
    expect(monitors.parseCsv('nome,cpf\nAna Souza,11144477735\n')).toEqual([['nome', 'cpf'], ['Ana Souza', '11144477735']]);
  });
  it('aceita variações de cabeçalho com acento e CPF numérico', () => {
    const birth = new Date(Date.UTC(2003, 2, 15));
    const result = monitors.tableToRoster([
      ['Nome Completo', 'CPF', 'Data de Nascimento', 'Matrícula', 'E-mail', 'Curso', 'Cadeira da Monitoria'],
      ['Ana Souza', 11144477735, birth, 2023001, 'ANA@EXEMPLO.EDU', 'Ciência da Computação', 'Programação'],
      [null, null, null, null, null, null, null],
    ]);
    expect(result.error).toBeUndefined();
    expect(result.rows).toEqual([{ line: 2, nome: 'Ana Souza', cpf: '11144477735', nascimento: birth, matricula: '2023001', email: 'ana@exemplo.edu', curso: 'Ciência da Computação', disciplina: 'Programação' }]);
    expect(monitors.tableToRoster([['nome', 'email']]).error).toMatch(/cpf, disciplina/);
  });
  it('lê o CSV modelo', async () => {
    const parsed = await monitors.readRosterFile('modelo.csv', Buffer.from(monitors.rosterTemplateCsv, 'utf8'));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ nome: 'Maria da Silva', disciplina: 'CC102' });
    expect((await monitors.readRosterFile('lista.pdf', Buffer.from(''))).error).toMatch(/xlsx ou \.csv/);
  });
});

describe('validação contra o catálogo', () => {
  it('encontra a disciplina por código ou por nome sem acento', async () => {
    const catalog = { courses: [{ id: 1, name: 'Ciência da Computação' }], subjects: [{ id: 10, course_id: 1, name: 'Programação', code: 'CC102' }] };
    expect(monitors.resolveRosterRow(row({ disciplina: 'cc102' }), catalog)).toMatchObject({ entry: { subjectId: 10, courseId: 1, cpf: '52998224725', birthDate: '2003-03-15' } });
    expect(monitors.resolveRosterRow(row({ disciplina: 'programacao', curso: 'ciencia da computacao' }), catalog)).toMatchObject({ entry: { subjectId: 10 } });
    expect(monitors.resolveRosterRow(row({ disciplina: 'Física' }), catalog)).toMatchObject({ error: expect.stringContaining('não encontrada') });
    expect(monitors.resolveRosterRow(row({ cpf: '529.982.247-24' }), catalog)).toEqual({ error: 'CPF inválido' });
    expect(monitors.resolveRosterRow(row({ curso: 'Engenharia Civil' }), catalog)).toMatchObject({ error: expect.stringContaining('não pertence') });
  });
});

describe('verificação automática pela planilha', () => {
  it('(a) na importação, vincula conta existente com o mesmo CPF', async () => {
    const userId = await store.createUser('Maria da Silva', 'maria@conecta.local', 'senha-segura', unifor, compCourse);
    await db.execute('UPDATE users SET cpf=? WHERE id=?', '52998224725', userId);
    const result = await monitors.saveRosterEntries(unifor, [row({}), row({ line: 3, disciplina: 'Física' })], 'demo-gestor');
    expect(result).toMatchObject({ inserted: 1, updated: 0, linked: 1 });
    expect(result.errors).toEqual([{ line: 3, message: expect.stringContaining('Física') }]);
    expect(await role(userId)).toEqual({ role: 'MONITOR', verified: 1 });
    expect(await subjectsOf(userId)).toEqual(['CC102']);
    const again = await monitors.saveRosterEntries(unifor, [row({ nome: 'Maria da Silva Souza' })], 'demo-gestor');
    expect(again).toMatchObject({ inserted: 0, updated: 1, linked: 0 });
  });

  it('(b) ao se cadastrar com o e-mail da planilha', async () => {
    await monitors.saveRosterEntries(unifor, [row({ nome: 'Ana Souza', cpf: '111.444.777-35', email: 'ana@conecta.local', disciplina: 'Banco de Dados' })], 'demo-gestor');
    const userId = await store.createUser('Ana Souza', 'ANA@conecta.local', 'senha-segura', unifor, compCourse);
    expect(await monitors.autoVerifyByEmail(userId)).toBe(true);
    expect(await role(userId)).toEqual({ role: 'MONITOR', verified: 1 });
    expect(await subjectsOf(userId)).toEqual(['CC204']);
    expect((await db.one<{ cpf: string }>('SELECT cpf FROM users WHERE id=?', userId))?.cpf).toBe('11144477735');
  });

  it('não vincula contas de outra instituição', async () => {
    const ufc = (await db.one<{ id: number; course: number }>("SELECT i.id,c.id course FROM institutions i JOIN courses c ON c.institution_id=i.id WHERE i.acronym='UFC' LIMIT 1"))!;
    await monitors.saveRosterEntries(unifor, [row({ nome: 'Caio Lima', cpf: '123.456.789-09', email: 'caio@conecta.local', disciplina: 'CC101' })], 'demo-gestor');
    const userId = await store.createUser('Caio Lima', 'caio@conecta.local', 'senha-segura', ufc.id, ufc.course);
    expect(await monitors.autoVerifyByEmail(userId)).toBe(false);
    expect(await role(userId)).toEqual({ role: 'STUDENT', verified: 0 });
  });

  it('(c) ao pedir verificação com o mesmo CPF e matrícula', async () => {
    await monitors.saveRosterEntries(unifor, [row({ nome: 'Rui Costa', cpf: '935.411.347-80', matricula: 'rc-2024/7', disciplina: 'CC203' })], 'demo-gestor');
    const userId = await store.createUser('Rui Costa', 'rui@conecta.local', 'senha-segura', unifor, compCourse);
    expect(await monitors.findRosterMatch(unifor, '93541134780', 'RC-2024/9')).toHaveLength(0);
    const matches = await monitors.findRosterMatch(unifor, '93541134780', 'rc-2024/7');
    expect(matches).toHaveLength(1);
    await db.execute("INSERT INTO role_requests (id,user_id,requested_role,details,cpf,status) VALUES ('req-rui',?,'MONITOR','',?,'PENDING')", userId, '93541134780');
    expect(await monitors.linkRosterToUser(userId, matches.map(match => match.id))).toBe(true);
    expect(await role(userId)).toEqual({ role: 'MONITOR', verified: 1 });
    expect(await db.one('SELECT status,roster_match FROM role_requests WHERE id=?', 'req-rui')).toEqual({ status: 'APPROVED', roster_match: 1 });
    expect(await monitors.rosterHasCpf(unifor, '93541134780')).toBe(true);
  });

  it('não promove professores nem administradores', async () => {
    const roster = await db.one<{ id: string }>("SELECT id FROM monitor_roster WHERE cpf='93541134780'");
    expect(await monitors.linkRosterToUser('demo-professora', [roster!.id])).toBe(false);
    expect(await role('demo-professora')).toEqual({ role: 'PROFESSOR', verified: 1 });
  });

  it('encerrar monitoria remove a disciplina e devolve o perfil de aluno', async () => {
    const maria = (await db.one<{ id: string }>("SELECT id FROM users WHERE email='maria@conecta.local'"))!.id;
    await monitors.saveRosterEntries(unifor, [row({ disciplina: 'CC101' })], 'demo-gestor');
    expect(await subjectsOf(maria)).toEqual(['CC101', 'CC102']);
    const first = (await db.one<{ id: string }>("SELECT r.id FROM monitor_roster r JOIN subjects s ON s.id=r.subject_id WHERE r.cpf='52998224725' AND s.code='CC102'"))!.id;
    expect(await monitors.endMonitorship(unifor, { rosterId: first })).toBe(true);
    expect(await subjectsOf(maria)).toEqual(['CC101']);
    expect((await role(maria))?.role).toBe('MONITOR');
    expect(await monitors.endMonitorship(unifor, { userId: maria })).toBe(true);
    expect(await subjectsOf(maria)).toEqual([]);
    expect(await role(maria)).toEqual({ role: 'STUDENT', verified: 0 });
    expect(await monitors.endMonitorship(unifor + 1, { rosterId: 'inexistente' })).toBe(false);
  });

  it('lista a planilha e os pedidos pendentes com o selo da planilha', async () => {
    const roster = await monitors.getRoster(unifor);
    expect(roster.map(item => item.full_name)).toEqual(expect.arrayContaining(['Ana Souza', 'Rui Costa', 'Caio Lima']));
    const lia = await store.createUser('Lia Prado', 'lia@conecta.local', 'senha-segura', unifor, compCourse);
    await db.execute("INSERT INTO role_requests (id,user_id,requested_role,details,cpf,status) VALUES ('req-lia',?,'MONITOR','',?,'PENDING')", lia, '12345678909');
    const pending = await monitors.getPendingVerifications(unifor, 'MONITOR');
    expect(pending.find(item => item.id === 'req-lia')).toMatchObject({ user_name: 'Lia Prado', in_roster: 1 });
  });
});
