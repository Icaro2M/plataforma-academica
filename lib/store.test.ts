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
    const tables = store.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('question_saves','subject_follows','notifications','conversations','conversation_members','chat_messages','study_requests') ORDER BY name");
    expect(tables.map(table => table.name)).toEqual(['chat_messages', 'conversation_members', 'conversations', 'notifications', 'question_saves', 'study_requests', 'subject_follows']);
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

  it('mantém conversa acadêmica, leitura e solicitação de aula entre participantes', () => {
    const db = store.database();
    db.prepare('INSERT INTO conversations (id,title,subject_id,created_by) VALUES (?,?,?,?)').run('chat-1','Dúvida sobre ponteiros',2,'demo-aluna');
    db.prepare('INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,CURRENT_TIMESTAMP)').run('chat-1','demo-aluna');
    db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run('chat-1','demo-monitor');
    db.prepare("INSERT INTO chat_messages (id,conversation_id,author_id,body,status) VALUES (?,?,?,?, 'APPROVED')").run('chat-message-1','chat-1','demo-aluna','Como posso revisar ponteiros para a prova?');
    db.prepare('INSERT INTO study_requests (id,conversation_id,requester_id,receiver_id,proposed_at,note) VALUES (?,?,?,?,?,?)').run('study-1','chat-1','demo-aluna','demo-monitor','2026-12-01 15:00:00','Revisar ponteiros e referências');
    expect(store.getChatContacts('demo-aluna').map(contact => contact.id)).toContain('demo-monitor');
    expect(store.getConversations('demo-monitor')[0]).toMatchObject({ id: 'chat-1', other_user_id: 'demo-aluna', unread_count: 1 });
    expect(store.getChatMessages('chat-1','demo-monitor')).toHaveLength(1);
    expect(store.getStudyRequests('chat-1')[0]).toMatchObject({ id: 'study-1', status: 'PENDING' });
    store.markConversationRead('chat-1','demo-monitor');
    expect(store.getUnreadChatCount('demo-monitor')).toBe(0);
  });
});
