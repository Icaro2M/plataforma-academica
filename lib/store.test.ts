import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('server-only', () => ({}));

let store: typeof import('./store');
const testDirectory = mkdtempSync(path.join(tmpdir(), 'conecta-store-'));

beforeAll(async () => {
  process.env.ACADEMIA_DB_PATH = path.join(testDirectory, 'test.sqlite');
  store = await import('./store');
  store.database();
});

afterAll(() => {
  store.database().close();
  delete (globalThis as typeof globalThis & { academiaDb?: unknown }).academiaDb;
  delete process.env.ACADEMIA_DB_PATH;
  rmSync(testDirectory, { recursive: true, force: true });
});

describe('persistência da comunidade acadêmica', () => {
  it('cria as tabelas incrementais sem perder os dados demonstrativos', () => {
    const tables = store.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('question_saves','subject_follows','notifications') ORDER BY name");
    expect(tables.map(table => table.name)).toEqual(['notifications', 'question_saves', 'subject_follows']);
    expect(store.countQuestions()).toBe(2);
  });

  it('pagina perguntas preservando filtros reais', () => {
    const first = store.getQuestions({ limit: 1, offset: 0 });
    const second = store.getQuestions({ limit: 1, offset: 1 });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].id).not.toBe(second[0].id);
    expect(store.countQuestions({ status: 'resolved' })).toBe(1);
  });

  it('salva perguntas e acompanha disciplinas por usuário', () => {
    const db = store.database();
    db.prepare('INSERT INTO question_saves (user_id,question_id) VALUES (?,?)').run('demo-aluna','demo-q1');
    db.prepare('INSERT INTO subject_follows (user_id,subject_id) VALUES (?,?)').run('demo-aluna',5);
    expect(store.isQuestionSaved('demo-aluna','demo-q1')).toBe(true);
    expect(store.getSavedQuestions('demo-aluna').map(question => question.id)).toEqual(['demo-q1']);
    expect(store.isSubjectFollowed('demo-aluna',5)).toBe(true);
    expect(store.getFollowedSubjects('demo-aluna').map(subject => subject.id)).toEqual([5]);
  });

  it('persiste notificações e evita duplicar o mesmo evento', () => {
    store.createNotification('demo-aluna','NEW_ANSWER','demo-monitor','QUESTION','demo-q2','Nova resposta','Ponteiros e referências');
    store.createNotification('demo-aluna','NEW_ANSWER','demo-monitor','QUESTION','demo-q2','Nova resposta','Ponteiros e referências');
    expect(store.getNotifications('demo-aluna')).toHaveLength(1);
    expect(store.getUnreadNotificationCount('demo-aluna')).toBe(1);
    store.database().prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=?').run('demo-aluna');
    expect(store.getUnreadNotificationCount('demo-aluna')).toBe(0);
  });
});
