import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('server-only', () => ({}));

let store: typeof import('./store');
let db: typeof import('./db');
const testDirectory = mkdtempSync(path.join(tmpdir(), 'conecta-libsql-'));

beforeAll(async () => {
  process.env.ACADEMIA_DB_PATH = path.join(testDirectory, 'test.libsql');
  vi.resetModules();
  db = await import('./db');
  store = await import('./store');
  await db.ensureSchema();
});

afterAll(() => {
  db.closeDatabaseForTests();
  delete process.env.ACADEMIA_DB_PATH;
});

describe('persistência libSQL da comunidade acadêmica', () => {
  it('cria o esquema e o catálogo acadêmico inicial', async () => {
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('questions','answers','sessions','subjects','users') ORDER BY name");
    expect(tables.map(table => table.name)).toEqual(['answers', 'questions', 'sessions', 'subjects', 'users']);
    expect(await store.countQuestions()).toBe(2);
    expect((await store.getCoursesForInstitution(1)).map(course => course.name)).toEqual(expect.arrayContaining(['Ciência da Computação','Direito','Medicina','Psicologia']));
    expect((await store.getSubjectsForInstitution(1)).filter(subject => subject.course_name === 'Direito').map(subject => subject.name)).toEqual(expect.arrayContaining(['Direito Constitucional','Direito Civil']));
  });

  it('pagina perguntas preservando os filtros', async () => {
    const first = await store.getQuestions({ limit: 1, offset: 0 });
    const second = await store.getQuestions({ limit: 1, offset: 1 });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].id).not.toBe(second[0].id);
    expect(await store.countQuestions({ status: 'resolved' })).toBe(1);
  });

  it('cadastra usuário com senha verificável', async () => {
    const id = await store.createUser('Usuário de Teste','teste@conecta.local','senha-segura',1,1);
    const account = await db.one<{ id: string; password_hash: string }>('SELECT id,password_hash FROM users WHERE id=?',id);
    expect(account?.id).toBe(id);
    expect(store.verifyPassword('senha-segura',account?.password_hash ?? '')).toBe(true);
    expect(store.verifyPassword('senha-incorreta',account?.password_hash ?? '')).toBe(false);
  });

  it('salva perguntas e acompanha disciplinas por usuário', async () => {
    await db.execute('INSERT INTO question_saves (user_id,question_id) VALUES (?,?)','demo-aluna','demo-q1');
    await db.execute('INSERT INTO subject_follows (user_id,subject_id) VALUES (?,?)','demo-aluna',1);
    expect(await store.isQuestionSaved('demo-aluna','demo-q1')).toBe(true);
    expect((await store.getSavedQuestions('demo-aluna')).map(question => question.id)).toEqual(['demo-q1']);
    expect(await store.isSubjectFollowed('demo-aluna',1)).toBe(true);
    expect((await store.getFollowedSubjects('demo-aluna')).map(subject => subject.id)).toEqual([1]);
  });

  it('persiste notificações sem duplicar o mesmo evento', async () => {
    await store.createNotification('demo-aluna','NEW_ANSWER','demo-monitor','QUESTION','demo-q2','Nova resposta','Ponteiros e referências');
    await store.createNotification('demo-aluna','NEW_ANSWER','demo-monitor','QUESTION','demo-q2','Nova resposta','Ponteiros e referências');
    expect(await store.getNotifications('demo-aluna')).toHaveLength(1);
    expect(await store.getUnreadNotificationCount('demo-aluna')).toBe(1);
    await db.execute('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=?','demo-aluna');
    expect(await store.getUnreadNotificationCount('demo-aluna')).toBe(0);
  });

  it('mantém conversa acadêmica e solicitação de aula', async () => {
    await db.transaction(async tx => {
      await db.run(tx,'INSERT INTO conversations (id,title,subject_id,created_by) VALUES (?,?,?,?)','chat-1','Dúvida sobre programação',1,'demo-aluna');
      await db.run(tx,'INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,CURRENT_TIMESTAMP)','chat-1','demo-aluna');
      await db.run(tx,'INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)','chat-1','demo-monitor');
      await db.run(tx,"INSERT INTO chat_messages (id,conversation_id,author_id,body,status) VALUES (?,?,?,?, 'APPROVED')",'chat-message-1','chat-1','demo-aluna','Como posso revisar programação para a prova?');
      await db.run(tx,'INSERT INTO study_requests (id,conversation_id,requester_id,receiver_id,proposed_at,note) VALUES (?,?,?,?,?,?)','study-1','chat-1','demo-aluna','demo-monitor','2026-12-01 15:00:00','Revisar programação');
    });
    expect((await store.getChatContacts('demo-aluna')).map(contact => contact.id)).toContain('demo-monitor');
    expect((await store.getConversations('demo-monitor'))[0]).toMatchObject({ id: 'chat-1', other_user_id: 'demo-aluna', unread_count: 1 });
    expect(await store.getChatMessages('chat-1','demo-monitor')).toHaveLength(1);
    expect((await store.getStudyRequests('chat-1'))[0]).toMatchObject({ id: 'study-1', status: 'PENDING' });
    await store.markConversationRead('chat-1','demo-monitor');
    expect(await store.getUnreadChatCount('demo-monitor')).toBe(0);
  });

  it('mantém pergunta e resposta após fechar e reabrir o cliente', async () => {
    await db.execute('INSERT INTO questions (id,author_id,subject_id,title,body,status) VALUES (?,?,?,?,?,?)','persist-q','demo-aluna',1,'Como estudar programação funcional?','Quero organizar uma rotina de exercícios sobre funções puras e composição.','OPEN');
    await db.execute('INSERT INTO answers (id,question_id,author_id,body,status) VALUES (?,?,?,?,?)','persist-a','persist-q','demo-monitor','Comece com funções pequenas e depois pratique composição com exemplos reais.','APPROVED');
    db.closeDatabaseForTests();
    expect((await store.getQuestion('persist-q'))?.title).toContain('programação funcional');
    expect((await store.getAnswers('persist-q')).map(answer => answer.id)).toContain('persist-a');
  });
});
