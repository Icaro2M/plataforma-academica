import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export type Role = 'STUDENT' | 'MONITOR' | 'PROFESSOR' | 'ADMIN';
export type User = { id: string; name: string; email: string; role: Role; verified: number; institution_id: number | null; course_id: number | null; institution_name?: string | null; course_name?: string | null; created_at: string };
export type Institution = { id: number; name: string; kind: string; city: string };
export type Course = { id: number; institution_id: number; name: string; institution_name?: string };
export type Subject = { id: number; course_id: number; name: string; code: string; course_name: string; institution_name: string };
export type SubjectSummary = Subject & { institution_id: number; question_count: number; latest_question_at: string | null };
export type Question = { id: string; author_id: string; subject_id: number; title: string; body: string; status: string; moderation_reason: string | null; accepted_answer_id: string | null; created_at: string; author_name: string; author_role: Role; author_verified: number; subject_name: string; course_name: string; institution_name: string; answer_count: number };
export type Answer = { id: string; question_id: string; author_id: string; body: string; status: string; moderation_reason: string | null; created_at: string; author_name: string; author_role: Role; author_verified: number; useful_count: number };

const file = process.env.ACADEMIA_DB_PATH ? path.resolve(process.env.ACADEMIA_DB_PATH) : path.join(process.cwd(), 'data', 'academia.sqlite');
const globalDb = globalThis as typeof globalThis & { academiaDb?: DatabaseSync };

function hashPassword(password: string, salt = randomUUID()) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, original] = stored.split(':');
  if (!salt || !original) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(original, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

function init(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
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
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_role_request ON role_requests(user_id) WHERE status='PENDING';
    CREATE INDEX IF NOT EXISTS questions_feed_idx ON questions(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS answers_question_idx ON answers(question_id,status);
    CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status,created_at);
  `);
  const count = (db.prepare('SELECT count(*) as count FROM institutions').get() as { count: number }).count;
  if (count) {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== '1' && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD && process.env.BOOTSTRAP_ADMIN_PASSWORD.length >= 12 && !(db.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").get())) {
      db.prepare('INSERT INTO users (id,name,email,password_hash,role,verified,institution_id,course_id) VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),'Coordenação Acadêmica',process.env.BOOTSTRAP_ADMIN_EMAIL,hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD),'ADMIN',1,1,1);
    }
    return;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const inst = db.prepare('INSERT INTO institutions (name,kind,city) VALUES (?,?,?)');
    inst.run('Universidade de Fortaleza (demonstração)', 'Faculdade', 'Fortaleza');
    inst.run('Escola Modelo (demonstração)', 'Escola', 'Fortaleza');
    const course = db.prepare('INSERT INTO courses (institution_id,name) VALUES (?,?)');
    course.run(1, 'Ciência da Computação');
    course.run(1, 'Engenharia');
    course.run(1, 'Administração');
    course.run(2, 'Ensino Médio');
    const subject = db.prepare('INSERT INTO subjects (course_id,name,code) VALUES (?,?,?)');
    [
      [1,'Raciocínio Lógico','RL101'],[1,'Programação','CC102'],[1,'Banco de Dados','CC203'],[1,'Algoritmos','CC104'],
      [2,'Cálculo II','ENG202'],[2,'Álgebra Linear','ENG105'],[2,'Física','ENG106'],
      [3,'Estatística','ADM201'],[3,'Matemática Financeira','ADM202'],
      [4,'Matemática','EM101'],[4,'Geografia','EM102'],[4,'História','EM103'],[4,'Biologia','EM104'],[4,'Literatura','EM105']
    ].forEach(([courseId,name,code]) => subject.run(courseId,name,code));
    const user = db.prepare('INSERT INTO users (id,name,email,password_hash,role,verified,institution_id,course_id) VALUES (?,?,?,?,?,?,?,?)');
    const demoMode = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1';
    if (demoMode) {
      const demoPassword = hashPassword(process.env.DEMO_PASSWORD || 'demo12345');
      user.run('demo-aluna','Marina Alves','aluna@demo.local',demoPassword,'STUDENT',0,1,1);
      user.run('demo-monitor','Pedro Santos','monitor@demo.local',demoPassword,'MONITOR',1,1,1);
      user.run('demo-professora','Ana Clara','professora@demo.local',demoPassword,'PROFESSOR',1,1,2);
      user.run('demo-admin','Coordenação Acadêmica','admin@demo.local',demoPassword,'ADMIN',1,1,1);
      const question = db.prepare('INSERT INTO questions (id,author_id,subject_id,title,body,status,accepted_answer_id) VALUES (?,?,?,?,?,?,?)');
      question.run('demo-q1','demo-aluna',5,'Como interpretar uma integral dupla?','Estou estudando cálculo e queria entender como escolher os limites de integração de uma região limitada por duas curvas. Já fiz o desenho, mas não sei como montar a integral.','RESOLVED','demo-a1');
      question.run('demo-q2','demo-aluna',2,'Qual a diferença entre ponteiro e referência em C++?','Na aula de programação, vi ponteiros e referências em C++. Em qual situação devo usar cada recurso e como isso afeta a memória?','OPEN',null);
      const answer = db.prepare('INSERT INTO answers (id,question_id,author_id,body,status) VALUES (?,?,?,?,?)');
      answer.run('demo-a1','demo-q1','demo-professora','Comece desenhando a região e encontrando as interseções das curvas. Depois, escolha fatias verticais ou horizontais e escreva os limites interno e externo.','APPROVED');
      answer.run('demo-a2','demo-q1','demo-monitor','Se a região for circular, também vale testar coordenadas polares. Nesse caso, lembre do fator r no jacobiano.','APPROVED');
    } else if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD && process.env.BOOTSTRAP_ADMIN_PASSWORD.length >= 12) {
      user.run(randomUUID(),'Coordenação Acadêmica',process.env.BOOTSTRAP_ADMIN_EMAIL,hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD),'ADMIN',1,1,1);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function database() {
  if (!globalDb.academiaDb) {
    mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    init(db);
    globalDb.academiaDb = db;
  }
  return globalDb.academiaDb;
}

export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return database().prepare(sql).all(...params) as T[];
}
export function one<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return database().prepare(sql).get(...params) as T | undefined;
}

export function getUser(id: string) {
  return one<User>(`SELECT u.id,u.name,u.email,u.role,u.verified,u.institution_id,u.course_id,u.created_at,i.name institution_name,c.name course_name FROM users u LEFT JOIN institutions i ON i.id=u.institution_id LEFT JOIN courses c ON c.id=u.course_id WHERE u.id=?`, id);
}
export function getInstitutions() { return all<Institution>('SELECT * FROM institutions ORDER BY name'); }
export function getCourses() { return all<Course>('SELECT c.*,i.name institution_name FROM courses c JOIN institutions i ON i.id=c.institution_id ORDER BY i.name,c.name'); }
export function getSubjects() { return all<Subject>('SELECT s.*,c.name course_name,i.name institution_name FROM subjects s JOIN courses c ON c.id=s.course_id JOIN institutions i ON i.id=c.institution_id ORDER BY i.name,c.name,s.name'); }
export function getSubjectCatalog() {
  return all<SubjectSummary>(`SELECT s.*,c.institution_id,c.name course_name,i.name institution_name,
    (SELECT count(*) FROM questions q WHERE q.subject_id=s.id AND q.status IN ('OPEN','RESOLVED')) question_count,
    (SELECT max(q.created_at) FROM questions q WHERE q.subject_id=s.id AND q.status IN ('OPEN','RESOLVED')) latest_question_at
    FROM subjects s JOIN courses c ON c.id=s.course_id JOIN institutions i ON i.id=c.institution_id
    ORDER BY i.name,c.name,s.name`);
}
export function getSubjectCounts(subjectId: number) {
  return one<{ unanswered: number; resolved: number }>(`SELECT
    (SELECT count(*) FROM questions q WHERE q.subject_id=? AND q.status IN ('OPEN','RESOLVED') AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id=q.id AND a.status='APPROVED')) unanswered,
    (SELECT count(*) FROM questions q WHERE q.subject_id=? AND q.status='RESOLVED') resolved`, subjectId, subjectId)!;
}

const questionSelect = `SELECT q.*,u.name author_name,u.role author_role,u.verified author_verified,s.name subject_name,c.name course_name,i.name institution_name,(SELECT count(*) FROM answers a WHERE a.question_id=q.id AND a.status='APPROVED') answer_count FROM questions q JOIN users u ON u.id=q.author_id JOIN subjects s ON s.id=q.subject_id JOIN courses c ON c.id=s.course_id JOIN institutions i ON i.id=c.institution_id`;
export function getQuestion(id: string) { return one<Question>(`${questionSelect} WHERE q.id=?`, id); }
export function getQuestions(filters: { search?: string; subjectId?: number; status?: string; institutionId?: number } = {}) {
  const where = ["q.status IN ('OPEN','RESOLVED')"];
  const params: (string | number)[] = [];
  if (filters.search) { where.push('(q.title LIKE ? OR q.body LIKE ? OR s.name LIKE ?)'); params.push(...Array(3).fill(`%${filters.search}%`)); }
  if (filters.subjectId) { where.push('q.subject_id=?'); params.push(filters.subjectId); }
  if (filters.status === 'unanswered') where.push("NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id=q.id AND a.status='APPROVED')");
  if (filters.status === 'resolved') where.push("q.status='RESOLVED'");
  if (filters.institutionId) { where.push('i.id=?'); params.push(filters.institutionId); }
  return all<Question>(`${questionSelect} WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC LIMIT 100`, ...params);
}
export function getAnswers(questionId: string) {
  return all<Answer>(`SELECT a.*,u.name author_name,u.role author_role,u.verified author_verified,(SELECT count(*) FROM answer_votes v WHERE v.answer_id=a.id) useful_count FROM answers a JOIN users u ON u.id=a.author_id WHERE a.question_id=? AND a.status='APPROVED' ORDER BY a.created_at ASC`,questionId);
}
export function getUserStats(id: string) {
  return one<{ questions: number; answers: number; received: number; accepted: number; useful: number }>(`SELECT (SELECT count(*) FROM questions WHERE author_id=? AND status IN ('OPEN','RESOLVED')) questions,(SELECT count(*) FROM answers WHERE author_id=? AND status='APPROVED') answers,(SELECT count(*) FROM answers a JOIN questions q ON q.id=a.question_id WHERE q.author_id=? AND q.status IN ('OPEN','RESOLVED') AND a.status='APPROVED') received,(SELECT count(*) FROM questions q JOIN answers a ON a.id=q.accepted_answer_id WHERE a.author_id=? AND a.status='APPROVED' AND q.status='RESOLVED') accepted,(SELECT count(*) FROM answer_votes v JOIN answers a ON a.id=v.answer_id WHERE a.author_id=? AND a.status='APPROVED') useful`,id,id,id,id,id)!;
}
export function getRanking(institutionId?: number) {
  return all<{ id:string; name:string; role:Role; verified:number; institution_name:string; answers:number; accepted:number; useful:number; points:number }>(`SELECT u.id,u.name,u.role,u.verified,i.name institution_name,(SELECT count(*) FROM answers a WHERE a.author_id=u.id AND a.status='APPROVED') answers,(SELECT count(*) FROM questions q JOIN answers a ON a.id=q.accepted_answer_id WHERE a.author_id=u.id AND a.status='APPROVED' AND q.status='RESOLVED') accepted,(SELECT count(*) FROM answer_votes v JOIN answers a ON a.id=v.answer_id WHERE a.author_id=u.id AND a.status='APPROVED') useful,((SELECT count(*) FROM answers a WHERE a.author_id=u.id AND a.status='APPROVED')*2+(SELECT count(*) FROM questions q JOIN answers a ON a.id=q.accepted_answer_id WHERE a.author_id=u.id AND a.status='APPROVED' AND q.status='RESOLVED')*10+(SELECT count(*) FROM answer_votes v JOIN answers a ON a.id=v.answer_id WHERE a.author_id=u.id AND a.status='APPROVED')) points FROM users u JOIN institutions i ON i.id=u.institution_id WHERE u.role IN ('MONITOR','PROFESSOR') AND u.verified=1 ${institutionId ? 'AND u.institution_id=?' : ''} ORDER BY points DESC,answers DESC,u.name LIMIT 50`, ...(institutionId ? [institutionId] : []));
}
export function createUser(name: string, email: string, password: string, institutionId: number, courseId: number) {
  const id = randomUUID();
  database().prepare('INSERT INTO users (id,name,email,password_hash,institution_id,course_id) VALUES (?,?,?,?,?,?)').run(id,name,email,hashPassword(password),institutionId,courseId);
  return id;
}
