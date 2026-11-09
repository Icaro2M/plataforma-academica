import 'server-only';
import { createClient, type Client, type InValue, type Transaction } from '@libsql/client';
import { randomUUID, scryptSync } from 'node:crypto';
import path from 'node:path';

export type SqlValue = InValue;
export type SqlConnection = Pick<Client, 'execute'> | Pick<Transaction, 'execute'>;

const localPath = process.env.ACADEMIA_DB_PATH ? path.resolve(process.env.ACADEMIA_DB_PATH) : path.join(process.cwd(), 'data', 'academia.libsql');
const url = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const globalDb = globalThis as typeof globalThis & { conectaDb?: Client; conectaSchema?: Promise<void> };

export function database() { return globalDb.conectaDb ??= createClient({ url, ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}) }); }
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

const catalog = `
INSERT OR IGNORE INTO institutions (id,name,kind,city) VALUES (1,'Universidade de Fortaleza','Faculdade','Fortaleza');
INSERT OR IGNORE INTO courses (institution_id,name) VALUES (1,'Ciência da Computação'),(1,'Direito'),(1,'Medicina'),(1,'Psicologia');
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Raciocínio Lógico','CC101' FROM courses WHERE institution_id=1 AND name='Ciência da Computação';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Programação','CC102' FROM courses WHERE institution_id=1 AND name='Ciência da Computação';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Algoritmos e Estruturas de Dados','CC203' FROM courses WHERE institution_id=1 AND name='Ciência da Computação';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Banco de Dados','CC204' FROM courses WHERE institution_id=1 AND name='Ciência da Computação';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Direito Constitucional','DIR102' FROM courses WHERE institution_id=1 AND name='Direito';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Direito Civil','DIR103' FROM courses WHERE institution_id=1 AND name='Direito';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Anatomia Humana','MED101' FROM courses WHERE institution_id=1 AND name='Medicina';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Fisiologia','MED102' FROM courses WHERE institution_id=1 AND name='Medicina';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Psicologia Geral','PSI101' FROM courses WHERE institution_id=1 AND name='Psicologia';
INSERT OR IGNORE INTO subjects (course_id,name,code) SELECT id,'Neuroanatomia','PSI102' FROM courses WHERE institution_id=1 AND name='Psicologia';
`;
const demoSalt = randomUUID();
const demoPasswordHash = `${demoSalt}:${scryptSync(process.env.DEMO_PASSWORD || 'demo12345', demoSalt, 64).toString('hex')}`;
const demoData = `
INSERT OR IGNORE INTO users (id,name,email,password_hash,role,verified,institution_id,course_id) VALUES ('demo-aluna','Marina Alves','aluna@demo.local','${demoPasswordHash}','STUDENT',0,1,1),('demo-monitor','Pedro Santos','monitor@demo.local','${demoPasswordHash}','MONITOR',1,1,1),('demo-professora','Ana Clara','professora@demo.local','${demoPasswordHash}','PROFESSOR',1,1,1);
INSERT OR IGNORE INTO questions (id,author_id,subject_id,title,body,status,accepted_answer_id) VALUES ('demo-q1','demo-aluna',2,'Integral dupla','Pergunta demonstrativa para testes de persistência e paginação.','RESOLVED','demo-a1'),('demo-q2','demo-aluna',1,'Ponteiros e referências','Pergunta demonstrativa para testes de persistência e paginação.','OPEN',NULL);
INSERT OR IGNORE INTO answers (id,question_id,author_id,body,status) VALUES ('demo-a1','demo-q1','demo-professora','Resposta demonstrativa aprovada.','APPROVED');
`;
export async function ensureSchema() {
  if (!globalDb.conectaSchema) {
    globalDb.conectaSchema = database().executeMultiple(schema)
      .then(() => database().executeMultiple(catalog))
      .then(async () => {
        if (!process.env.TURSO_DATABASE_URL || process.env.DEMO_MODE === '1') await database().executeMultiple(demoData);
      });
  }
  return globalDb.conectaSchema;
}
export async function execute(sql:string,...args:SqlValue[]) { await ensureSchema(); return database().execute({sql,args}); }
export async function all<T>(sql:string,...args:SqlValue[]):Promise<T[]> { return (await execute(sql,...args)).rows as unknown as T[]; }
export async function one<T>(sql:string,...args:SqlValue[]):Promise<T|undefined> { return (await all<T>(sql,...args))[0]; }
export async function transaction<T>(work:(tx:SqlConnection)=>Promise<T>) { await ensureSchema(); const tx=await database().transaction('write'); try { const result=await work(tx); await tx.commit(); return result; } catch(error) { if(!tx.closed) await tx.rollback(); throw error; } finally { tx.close(); } }
export async function run(connection:SqlConnection,sql:string,...args:SqlValue[]) { return connection.execute({sql,args}); }
