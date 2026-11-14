import 'server-only';
import { createClient, type Client, type InStatement, type InValue, type Transaction } from '@libsql/client';
import { randomUUID, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export type SqlValue = InValue;
export type SqlConnection = Pick<Client, 'execute'> | Pick<Transaction, 'execute'>;

const localPath = process.env.ACADEMIA_DB_PATH ? path.resolve(process.env.ACADEMIA_DB_PATH) : path.join(process.cwd(), 'data', 'academia.libsql');
const url = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const globalDb = globalThis as typeof globalThis & { conectaDb?: Client; conectaSchema?: Promise<void> };

export function database() {
  // Banco local: garante que a pasta exista (data/ não é versionada).
  if (!globalDb.conectaDb && !process.env.TURSO_DATABASE_URL) mkdirSync(path.dirname(localPath), { recursive: true });
  return globalDb.conectaDb ??= createClient({ url, ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}) });
}
export function closeDatabaseForTests() {
  globalDb.conectaDb?.close();
  delete globalDb.conectaDb;
  delete globalDb.conectaSchema;
}

const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS institutions (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('Faculdade','Escola')), city TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id), name TEXT NOT NULL, UNIQUE(institution_id,name));
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), name TEXT NOT NULL, code TEXT NOT NULL, UNIQUE(course_id,code));
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT','MONITOR','PROFESSOR','ADMIN')), verified INTEGER NOT NULL DEFAULT 0, institution_id INTEGER REFERENCES institutions(id), course_id INTEGER REFERENCES courses(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), subject_id INTEGER NOT NULL REFERENCES subjects(id), title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED','PENDING','REMOVED')), moderation_reason TEXT, accepted_answer_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS answers (id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'APPROVED' CHECK(status IN ('APPROVED','PENDING','REMOVED')), moderation_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS answer_votes (answer_id TEXT NOT NULL REFERENCES answers(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(answer_id,user_id));
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id), target_type TEXT NOT NULL CHECK(target_type IN ('QUESTION','ANSWER')), target_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(reporter_id,target_type,target_id));
CREATE TABLE IF NOT EXISTS role_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, requested_role TEXT NOT NULL CHECK(requested_role IN ('MONITOR','PROFESSOR')), details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS question_saves (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,question_id));
CREATE TABLE IF NOT EXISTS subject_follows (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,subject_id));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, entity_type TEXT, entity_id TEXT, title TEXT NOT NULL, body TEXT, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, subject_id INTEGER NOT NULL REFERENCES subjects(id), created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','SCHEDULED','CLOSED')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS conversation_members (conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_read_at TEXT, joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(conversation_id,user_id));
CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'APPROVED' CHECK(status IN ('APPROVED','PENDING','REMOVED')), moderation_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS study_requests (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, proposed_at TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED')), reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subject_requests (id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, institution_id INTEGER NOT NULL REFERENCES institutions(id), course_id INTEGER NOT NULL REFERENCES courses(id), name TEXT NOT NULL, normalized_name TEXT NOT NULL, code TEXT, justification TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), review_reason TEXT, reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_role_request ON role_requests(user_id) WHERE status='PENDING'; CREATE INDEX IF NOT EXISTS questions_feed_idx ON questions(status,created_at DESC); CREATE INDEX IF NOT EXISTS answers_question_idx ON answers(question_id,status); CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status,created_at); CREATE INDEX IF NOT EXISTS question_saves_user_idx ON question_saves(user_id,created_at DESC); CREATE INDEX IF NOT EXISTS subject_follows_user_idx ON subject_follows(user_id,created_at DESC); CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,created_at DESC); CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_unique ON notifications(user_id,type,entity_id,actor_id); CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON conversation_members(user_id,conversation_id); CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages(conversation_id,created_at); CREATE INDEX IF NOT EXISTS study_requests_conversation_idx ON study_requests(conversation_id,status,created_at DESC); CREATE UNIQUE INDEX IF NOT EXISTS one_pending_subject_request ON subject_requests(course_id,normalized_name) WHERE status='PENDING'; CREATE INDEX IF NOT EXISTS subject_requests_requester_idx ON subject_requests(requester_id,created_at DESC); CREATE INDEX IF NOT EXISTS subject_requests_status_idx ON subject_requests(status,created_at);
`;

// Tabelas criadas depois das colunas novas existirem (índices dependem de addMissingColumns).
const schemaAfterColumns = `
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_unique ON users(cpf) WHERE cpf IS NOT NULL;
CREATE TABLE IF NOT EXISTS institution_managers (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,institution_id));
CREATE TABLE IF NOT EXISTS monitor_roster (id TEXT PRIMARY KEY, institution_id INTEGER NOT NULL REFERENCES institutions(id), full_name TEXT NOT NULL, cpf TEXT NOT NULL, birth_date TEXT, registration TEXT, email TEXT COLLATE NOCASE, course_id INTEGER REFERENCES courses(id), subject_id INTEGER NOT NULL REFERENCES subjects(id), created_by TEXT REFERENCES users(id) ON DELETE SET NULL, linked_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(institution_id,cpf,subject_id));
CREATE TABLE IF NOT EXISTS monitor_subjects (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('ROSTER','REQUEST','MANUAL')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,subject_id));
CREATE INDEX IF NOT EXISTS monitor_roster_institution_idx ON monitor_roster(institution_id,full_name);
CREATE INDEX IF NOT EXISTS monitor_roster_email_idx ON monitor_roster(institution_id,email);
CREATE INDEX IF NOT EXISTS institution_managers_institution_idx ON institution_managers(institution_id);
`;

/** Colunas acrescentadas depois da primeira versão do schema. Nunca remova itens desta lista. */
export const addedColumns: Record<string, [column: string, definition: string][]> = {
  institutions: [['acronym', 'TEXT']],
  users: [['full_name', 'TEXT'], ['cpf', 'TEXT'], ['birth_date', 'TEXT'], ['registration', 'TEXT'], ['student_mode', 'INTEGER NOT NULL DEFAULT 0']],
  role_requests: [['full_name', 'TEXT'], ['cpf', 'TEXT'], ['birth_date', 'TEXT'], ['registration', 'TEXT'], ['course_id', 'INTEGER'], ['subject_id', 'INTEGER'], ['roster_match', 'INTEGER NOT NULL DEFAULT 0'], ['reviewed_by', 'TEXT']],
  questions: [['posted_as', 'TEXT']],
  answers: [['posted_as', 'TEXT']],
};

/** Migração sem perda de dados: confere PRAGMA table_info e só roda ALTER TABLE ADD COLUMN para colunas ausentes. */
export async function addMissingColumns(connection: SqlConnection = database()) {
  const added: string[] = [];
  for (const [table, columns] of Object.entries(addedColumns)) {
    const existing = new Set((await connection.execute(`PRAGMA table_info(${table})`)).rows.map(row => String(row.name)));
    for (const [column, definition] of columns) {
      if (existing.has(column)) continue;
      await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      added.push(`${table}.${column}`);
    }
  }
  return added;
}

type CatalogSubject = { name: string; code: string };
type CatalogInstitution = { name: string; acronym: string; kind: 'Faculdade' | 'Escola'; city: string; courses: { name: string; subjects: CatalogSubject[] }[] };

/** Catálogo inicial. Os nomes são exemplos para demonstração, sem vínculo oficial com as instituições. */
export const institutionCatalog: CatalogInstitution[] = [
  { name: 'Universidade de Fortaleza', acronym: 'UNIFOR', kind: 'Faculdade', city: 'Fortaleza', courses: [
    { name: 'Ciência da Computação', subjects: [{ name: 'Raciocínio Lógico', code: 'CC101' }, { name: 'Programação', code: 'CC102' }, { name: 'Cálculo I', code: 'CC105' }, { name: 'Algoritmos e Estruturas de Dados', code: 'CC203' }, { name: 'Banco de Dados', code: 'CC204' }] },
    { name: 'Direito', subjects: [{ name: 'Direito Constitucional', code: 'DIR102' }, { name: 'Direito Civil', code: 'DIR103' }] },
    { name: 'Medicina', subjects: [{ name: 'Anatomia Humana', code: 'MED101' }, { name: 'Fisiologia', code: 'MED102' }] },
    { name: 'Psicologia', subjects: [{ name: 'Psicologia Geral', code: 'PSI101' }, { name: 'Neuroanatomia', code: 'PSI102' }] },
  ] },
  { name: 'Universidade Federal do Ceará', acronym: 'UFC', kind: 'Faculdade', city: 'Fortaleza', courses: [
    { name: 'Engenharia Civil', subjects: [{ name: 'Cálculo Diferencial e Integral I', code: 'CB0661' }, { name: 'Resistência dos Materiais', code: 'TD0902' }, { name: 'Mecânica dos Solos', code: 'TD0915' }] },
    { name: 'Física', subjects: [{ name: 'Física Básica I', code: 'CD0301' }, { name: 'Mecânica Clássica', code: 'CD0320' }, { name: 'Eletromagnetismo', code: 'CD0330' }] },
    { name: 'Odontologia', subjects: [{ name: 'Anatomia Dental', code: 'OD0101' }, { name: 'Periodontia', code: 'OD0304' }] },
  ] },
  { name: 'Universidade Estadual do Ceará', acronym: 'UECE', kind: 'Faculdade', city: 'Fortaleza', courses: [
    { name: 'Ciências Biológicas', subjects: [{ name: 'Biologia Celular', code: 'BIO110' }, { name: 'Genética', code: 'BIO220' }, { name: 'Ecologia', code: 'BIO310' }] },
    { name: 'Pedagogia', subjects: [{ name: 'Didática', code: 'PED120' }, { name: 'Psicologia da Educação', code: 'PED130' }] },
    { name: 'Geografia', subjects: [{ name: 'Cartografia', code: 'GEO101' }, { name: 'Geomorfologia', code: 'GEO205' }] },
  ] },
  { name: 'Centro Universitário Christus', acronym: 'Unichristus', kind: 'Faculdade', city: 'Fortaleza', courses: [
    { name: 'Arquitetura e Urbanismo', subjects: [{ name: 'Desenho Arquitetônico', code: 'ARQ101' }, { name: 'Teoria da Arquitetura', code: 'ARQ110' }, { name: 'Conforto Ambiental', code: 'ARQ240' }] },
    { name: 'Fisioterapia', subjects: [{ name: 'Cinesiologia', code: 'FIS101' }, { name: 'Biomecânica', code: 'FIS202' }] },
    { name: 'Odontologia', subjects: [{ name: 'Histologia Bucal', code: 'ODC102' }, { name: 'Bioquímica', code: 'ODC105' }] },
  ] },
  { name: 'Centro Universitário 7 de Setembro', acronym: 'UNI7', kind: 'Faculdade', city: 'Fortaleza', courses: [
    { name: 'Administração', subjects: [{ name: 'Contabilidade Geral', code: 'ADM110' }, { name: 'Gestão de Pessoas', code: 'ADM210' }, { name: 'Matemática Financeira', code: 'ADM150' }] },
    { name: 'Sistemas de Informação', subjects: [{ name: 'Lógica de Programação', code: 'SI101' }, { name: 'Engenharia de Software', code: 'SI230' }, { name: 'Redes de Computadores', code: 'SI250' }] },
  ] },
];

/** Inserts idempotentes: a instituição é sempre localizada pelo nome, nunca por id fixo. */
export function catalogStatements(catalog = institutionCatalog): InStatement[] {
  const statements: InStatement[] = [];
  for (const institution of catalog) {
    statements.push({ sql: 'INSERT OR IGNORE INTO institutions (name,kind,city,acronym) VALUES (?,?,?,?)', args: [institution.name, institution.kind, institution.city, institution.acronym] });
    statements.push({ sql: 'UPDATE institutions SET acronym=? WHERE name=? AND acronym IS NULL', args: [institution.acronym, institution.name] });
    for (const course of institution.courses) {
      statements.push({ sql: 'INSERT OR IGNORE INTO courses (institution_id,name) SELECT id,? FROM institutions WHERE name=?', args: [course.name, institution.name] });
      for (const subject of course.subjects) {
        statements.push({ sql: 'INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT c.id,?,? FROM courses c JOIN institutions i ON i.id=c.institution_id WHERE i.name=? AND c.name=?', args: [subject.name, subject.code, institution.name, course.name] });
      }
    }
  }
  return statements;
}

const UNIFOR = 'Universidade de Fortaleza';
const UFC = 'Universidade Federal do Ceará';
function demoStatements(passwordHash: string): InStatement[] {
  const user = (id: string, name: string, email: string, role: string, verified: number, institution: string, course: string): InStatement => ({
    sql: 'INSERT OR IGNORE INTO users (id,name,email,password_hash,role,verified,institution_id,course_id) SELECT ?,?,?,?,?,?,c.institution_id,c.id FROM courses c JOIN institutions i ON i.id=c.institution_id WHERE i.name=? AND c.name=?',
    args: [id, name, email, passwordHash, role, verified, institution, course],
  });
  const question = (id: string, author: string, institution: string, code: string, title: string, body: string, status: string, accepted: string | null): InStatement => ({
    sql: "INSERT OR IGNORE INTO questions (id,author_id,subject_id,title,body,status,accepted_answer_id,posted_as) SELECT ?,?,s.id,?,?,?,?,'STUDENT' FROM subjects s JOIN courses c ON c.id=s.course_id JOIN institutions i ON i.id=c.institution_id WHERE i.name=? AND s.code=?",
    args: [id, author, title, body, status, accepted, institution, code],
  });
  const subjectId = 'SELECT s.id FROM subjects s JOIN courses c ON c.id=s.course_id JOIN institutions i ON i.id=c.institution_id WHERE i.name=? AND s.code=?';
  return [
    user('demo-aluna', 'Marina Alves', 'aluna@demo.local', 'STUDENT', 0, UNIFOR, 'Ciência da Computação'),
    user('demo-monitor', 'Pedro Santos', 'monitor@demo.local', 'MONITOR', 1, UNIFOR, 'Ciência da Computação'),
    user('demo-professora', 'Ana Clara', 'professora@demo.local', 'PROFESSOR', 1, UNIFOR, 'Ciência da Computação'),
    user('demo-gestor', 'Helena Duarte', 'gestor@demo.local', 'PROFESSOR', 1, UNIFOR, 'Ciência da Computação'),
    user('demo-aluno-ufc', 'Lucas Ferreira', 'aluno.ufc@demo.local', 'STUDENT', 0, UFC, 'Engenharia Civil'),
    { sql: "INSERT OR IGNORE INTO users (id,name,email,password_hash,role,verified) VALUES ('demo-admin','Coordenação Conecta','admin@demo.local',?,'ADMIN',1)", args: [passwordHash] },
    { sql: 'INSERT OR IGNORE INTO institution_managers (user_id,institution_id) SELECT ?,id FROM institutions WHERE name=?', args: ['demo-gestor', UNIFOR] },
    { sql: `INSERT OR IGNORE INTO monitor_subjects (user_id,subject_id,source) SELECT 'demo-monitor',(${subjectId}),'MANUAL'`, args: [UNIFOR, 'CC102'] },
    question('demo-q1', 'demo-aluna', UNIFOR, 'CC105', 'Integral dupla', 'Pergunta demonstrativa para testes de persistência e paginação.', 'RESOLVED', 'demo-a1'),
    question('demo-q2', 'demo-aluna', UNIFOR, 'CC102', 'Ponteiros e referências', 'Pergunta demonstrativa para testes de persistência e paginação.', 'OPEN', null),
    question('demo-q-ufc', 'demo-aluno-ufc', UFC, 'TD0902', 'Como calcular a tensão de cisalhamento em uma viga biapoiada?', 'Estou estudando para a prova de Resistência dos Materiais e não entendi como montar o diagrama de esforço cortante para achar a tensão máxima.', 'OPEN', null),
    { sql: "INSERT OR IGNORE INTO answers (id,question_id,author_id,body,status,posted_as) VALUES ('demo-a1','demo-q1','demo-professora','Resposta demonstrativa aprovada.','APPROVED','PROFESSOR')", args: [] },
  ];
}

const demoEnabled = () => !process.env.TURSO_DATABASE_URL || process.env.DEMO_MODE === '1';
function demoPasswordHash() {
  const salt = randomUUID();
  return `${salt}:${scryptSync(process.env.DEMO_PASSWORD || 'demo12345', salt, 64).toString('hex')}`;
}

export async function ensureSchema() {
  if (!globalDb.conectaSchema) {
    globalDb.conectaSchema = (async () => {
      const db = database();
      await db.executeMultiple(schema);
      await addMissingColumns(db);
      await db.executeMultiple(schemaAfterColumns);
      await db.batch(catalogStatements(), 'write');
      if (demoEnabled()) await db.batch(demoStatements(demoPasswordHash()), 'write');
    })().catch(error => { delete globalDb.conectaSchema; throw error; });
  }
  return globalDb.conectaSchema;
}
export async function execute(sql:string,...args:SqlValue[]) { await ensureSchema(); return database().execute({sql,args}); }
export async function all<T>(sql:string,...args:SqlValue[]):Promise<T[]> { return (await execute(sql,...args)).rows as unknown as T[]; }
export async function one<T>(sql:string,...args:SqlValue[]):Promise<T|undefined> { return (await all<T>(sql,...args))[0]; }
export async function transaction<T>(work:(tx:SqlConnection)=>Promise<T>) { await ensureSchema(); const tx=await database().transaction('write'); try { const result=await work(tx); await tx.commit(); return result; } catch(error) { if(!tx.closed) await tx.rollback(); throw error; } finally { tx.close(); } }
export async function run(connection:SqlConnection,sql:string,...args:SqlValue[]) { return connection.execute({sql,args}); }
