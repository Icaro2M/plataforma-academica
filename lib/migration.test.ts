import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';

vi.mock('server-only', () => ({}));

let db: typeof import('./db');
const file = path.join(mkdtempSync(path.join(tmpdir(), 'conecta-migracao-')), 'antigo.libsql');

// Banco no formato da versão anterior: sem as colunas e tabelas novas, com dados reais.
beforeAll(async () => {
  const legacy = createClient({ url: `file:${file}` });
  await legacy.executeMultiple(`
    CREATE TABLE institutions (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, city TEXT NOT NULL);
    CREATE TABLE courses (id INTEGER PRIMARY KEY, institution_id INTEGER NOT NULL, name TEXT NOT NULL, UNIQUE(institution_id,name));
    CREATE TABLE subjects (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL, UNIQUE(course_id,code));
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STUDENT', verified INTEGER NOT NULL DEFAULT 0, institution_id INTEGER, course_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE questions (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, subject_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', moderation_reason TEXT, accepted_answer_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE answers (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'APPROVED', moderation_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE role_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, requested_role TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);
    INSERT INTO institutions (id,name,kind,city) VALUES (1,'Universidade de Fortaleza','Faculdade','Fortaleza');
    INSERT INTO courses (id,institution_id,name) VALUES (1,1,'Ciência da Computação');
    INSERT INTO subjects (id,course_id,name,code) VALUES (1,1,'Raciocínio Lógico','CC101');
    INSERT INTO users (id,name,email,password_hash,institution_id,course_id) VALUES ('antigo','Usuário Antigo','antigo@conecta.local','x:y',1,1);
    INSERT INTO questions (id,author_id,subject_id,title,body) VALUES ('q-antiga','antigo',1,'Pergunta anterior à migração','Conteúdo que precisa continuar existindo.');
    INSERT INTO role_requests (id,user_id,requested_role,details) VALUES ('r-antigo','antigo','MONITOR','Pedido feito na versão anterior.');
  `);
  legacy.close();
  process.env.ACADEMIA_DB_PATH = file;
  vi.resetModules();
  db = await import('./db');
  await db.ensureSchema();
});

afterAll(() => {
  db.closeDatabaseForTests();
  delete process.env.ACADEMIA_DB_PATH;
});

describe('migração de banco existente', () => {
  it('adiciona colunas e tabelas novas preservando os dados', async () => {
    expect(await db.one('SELECT title FROM questions WHERE id=?', 'q-antiga')).toEqual({ title: 'Pergunta anterior à migração' });
    expect(await db.one('SELECT details,roster_match FROM role_requests WHERE id=?', 'r-antigo')).toEqual({ details: 'Pedido feito na versão anterior.', roster_match: 0 });
    expect(await db.one('SELECT student_mode,cpf FROM users WHERE id=?', 'antigo')).toEqual({ student_mode: 0, cpf: null });
    expect(await db.one('SELECT id,acronym FROM institutions WHERE name=?', 'Universidade de Fortaleza')).toEqual({ id: 1, acronym: 'UNIFOR' });
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('institution_managers','monitor_roster','monitor_subjects') ORDER BY name")).map(row => row.name);
    expect(tables).toEqual(['institution_managers', 'monitor_roster', 'monitor_subjects']);
    expect((await db.one<{ count: number }>('SELECT count(*) count FROM institutions'))?.count).toBe(5);
  });

  it('impede o mesmo CPF em duas contas', async () => {
    await db.execute("UPDATE users SET cpf='52998224725' WHERE id='antigo'");
    await expect(db.execute("UPDATE users SET cpf='52998224725' WHERE id='demo-aluna'")).rejects.toThrow(/UNIQUE/);
  });
});
