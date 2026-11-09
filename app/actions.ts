'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { currentUser, endSession, startSession } from '@/lib/auth';
import { createNotification, getQuestion, getUser, normalizeSubjectName, createUser, verifyPassword } from '@/lib/store';
import { isStudyChatContent, moderateContent } from '@/lib/moderation';
import { all as asyncAll, execute, one as asyncOne, transaction, run } from '@/lib/db';

const value = (form: FormData, key: string) => String(form.get(key) || '').trim();
const errorUrl = (path: string, message: string) => `${path}?error=${encodeURIComponent(message)}` as Route;
const requireUser = async () => { const user = await currentUser(); if (!user) redirect(errorUrl('/entrar','Entre para participar.')); return user; };
const requireAdmin = async () => { const user = await requireUser(); if (user.role !== 'ADMIN') redirect('/'); return user; };
const returnPath = (form: FormData, fallback: string) => { const path = value(form,'returnTo'); return (path.startsWith('/') && !path.startsWith('//') ? path : fallback) as Route; };

export async function login(form: FormData) {
  const email = value(form,'email').toLowerCase();
  const password = value(form,'password');
  const account = await asyncOne<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE email=?',email);
  if (!account || !verifyPassword(password,account.password_hash)) redirect(errorUrl('/entrar','E-mail ou senha incorretos.'));
  await startSession(account.id);
  redirect('/');
}
export async function register(form: FormData) {
  const name = value(form,'name');
  const email = value(form,'email').toLowerCase();
  const password = value(form,'password');
  const institutionId = Number(value(form,'institutionId'));
  const courseId = Number(value(form,'courseId'));
  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) redirect(errorUrl('/cadastrar','Preencha nome, e-mail válido e senha com pelo menos 8 caracteres.'));
  const course = await asyncOne<{id:number}>('SELECT id FROM courses WHERE id=? AND institution_id=?',courseId,institutionId);
  if (!course) redirect(errorUrl('/cadastrar','Selecione um curso da instituição escolhida.'));
  if (await asyncOne('SELECT id FROM users WHERE email=?',email)) redirect(errorUrl('/cadastrar','Este e-mail já está cadastrado.'));
  const id = await createUser(name,email,password,institutionId,courseId);
  await startSession(id);
  redirect('/');
}
export async function logout() { await endSession(); redirect('/'); }

export async function createQuestion(form: FormData) {
  const user = await requireUser();
  const title = value(form,'title');
  const body = value(form,'body');
  const subjectId = Number(value(form,'subjectId'));
  const courseId = Number(value(form,'courseId'));
  const subject = await asyncOne<{id:number}>('SELECT s.id FROM subjects s JOIN courses c ON c.id=s.course_id WHERE s.id=? AND s.course_id=? AND c.institution_id=?',subjectId,courseId,user.institution_id);
  if (title.length < 12 || title.length > 140 || body.length < 30 || body.length > 10000 || !subject) redirect(errorUrl('/perguntas/nova','Escolha um curso e uma disciplina correspondente à sua instituição.'));
  const moderation = moderateContent(`${title} ${body}`,'QUESTION');
  if (moderation.status === 'BLOCKED') redirect(errorUrl('/perguntas/nova',moderation.reason || 'Conteúdo não permitido.'));
  const id = randomUUID();
  await execute('INSERT INTO questions (id,author_id,subject_id,title,body,status,moderation_reason) VALUES (?,?,?,?,?,?,?)',id,user.id,subjectId,title,body,moderation.status === 'PENDING' ? 'PENDING' : 'OPEN',moderation.reason);
  revalidatePath('/');
  redirect(`/perguntas/${id}?created=1` as Route);
}

export async function createAnswer(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const body = value(form,'body');
  const question = await getQuestion(questionId);
  if (!question || !['OPEN','RESOLVED'].includes(question.status)) redirect('/');
  if (question.author_id === user.id) redirect(errorUrl(`/perguntas/${questionId}`,'Você não pode responder à própria pergunta.'));
  if (body.length < 10 || body.length > 10000) redirect(errorUrl(`/perguntas/${questionId}`,'A resposta deve ter de 10 a 10.000 caracteres.'));
  const moderation = moderateContent(body,'ANSWER');
  if (moderation.status === 'BLOCKED') redirect(errorUrl(`/perguntas/${questionId}`,moderation.reason || 'Conteúdo não permitido.'));
  const answerId = randomUUID();
  try {
    await transaction(async tx => {
      await run(tx,'INSERT INTO answers (id,question_id,author_id,body,status,moderation_reason) VALUES (?,?,?,?,?,?)',answerId,questionId,user.id,body,moderation.status,moderation.reason);
    });
  } catch { redirect(errorUrl(`/perguntas/${questionId}`,'Não foi possível publicar a resposta.')); }
  revalidatePath(`/perguntas/${questionId}`);
  revalidatePath('/ranking');
  redirect(`/perguntas/${questionId}?answered=1&success=${encodeURIComponent(moderation.status === 'PENDING' ? 'Resposta enviada para revisão' : 'Resposta publicada')}` as Route);
}

export async function acceptAnswer(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const answerId = value(form,'answerId');
  let answerAuthorId: string | null = null;
  let questionTitle = '';
  try {
    await transaction(async tx => {
      const questionResult = await run(tx,'SELECT author_id,status,title FROM questions WHERE id=?',questionId);
      const answerResult = await run(tx,'SELECT id,author_id FROM answers WHERE id=? AND question_id=? AND status=?',answerId,questionId,'APPROVED');
      const question = questionResult.rows[0] as unknown as { author_id: string; status: string; title: string } | undefined;
      const answer = answerResult.rows[0] as unknown as { id: string; author_id: string } | undefined;
      if (!question || question.author_id !== user.id || !answer || question.status === 'REMOVED') throw new Error('Sem permissão para aceitar esta resposta.');
      await run(tx,'UPDATE questions SET accepted_answer_id=?,status=? WHERE id=?',answerId,'RESOLVED',questionId);
      answerAuthorId = answer.author_id;
      questionTitle = question.title;
    });
  } catch { redirect(errorUrl(`/perguntas/${questionId}`,'Não foi possível marcar a solução.')); }
  if (answerAuthorId && answerAuthorId !== user.id) await createNotification(answerAuthorId,'ANSWER_ACCEPTED',user.id,'QUESTION',questionId,'Sua resposta foi marcada como solução',questionTitle);
  revalidatePath(`/perguntas/${questionId}`); revalidatePath('/ranking'); revalidatePath('/');
  redirect(`/perguntas/${questionId}` as Route);
}

export async function voteAnswer(form: FormData) {
  const user = await requireUser();
  const answerId = value(form,'answerId');
  const questionId = value(form,'questionId');
  const answer = await asyncOne<{id:string;author_id:string}>('SELECT id,author_id FROM answers WHERE id=? AND question_id=? AND status=?',answerId,questionId,'APPROVED');
  if (answer && answer.author_id !== user.id) await execute('INSERT OR IGNORE INTO answer_votes (answer_id,user_id) VALUES (?,?)',answerId,user.id);
  revalidatePath(`/perguntas/${questionId}`); revalidatePath('/ranking');
  redirect(`/perguntas/${questionId}` as Route);
}

export async function reportContent(form: FormData) {
  const user = await requireUser();
  const type = value(form,'type');
  const id = value(form,'id');
  const questionId = value(form,'questionId');
  const reason = value(form,'reason');
  if (!['QUESTION','ANSWER'].includes(type) || reason.length < 5) redirect(errorUrl(`/perguntas/${questionId}`,'Informe o motivo da denúncia.'));
  const exists = type === 'QUESTION' ? await asyncOne('SELECT id FROM questions WHERE id=?',id) : await asyncOne('SELECT id FROM answers WHERE id=? AND question_id=?',id,questionId);
  if (exists) await execute('INSERT OR IGNORE INTO reports (id,reporter_id,target_type,target_id,reason) VALUES (?,?,?,?,?)',randomUUID(),user.id,type,id,reason);
  redirect(`/perguntas/${questionId}?success=Denúncia+enviada+para+revisão` as Route);
}

export async function toggleSaveQuestion(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const intent = value(form,'intent');
  const destination = returnPath(form,`/perguntas/${questionId}`);
  const question = await asyncOne<{id:string}>("SELECT id FROM questions WHERE id=? AND status IN ('OPEN','RESOLVED')",questionId);
  if (!question) redirect('/');
  if (intent === 'remove') await execute('DELETE FROM question_saves WHERE user_id=? AND question_id=?',user.id,questionId);
  else await execute('INSERT OR IGNORE INTO question_saves (user_id,question_id) VALUES (?,?)',user.id,questionId);
  revalidatePath('/minha-atividade');
  revalidatePath(`/perguntas/${questionId}`);
  redirect(destination);
}

export async function toggleSubjectFollow(form: FormData) {
  const user = await requireUser();
  const subjectId = Number(value(form,'subjectId'));
  const intent = value(form,'intent');
  const destination = returnPath(form,`/disciplinas/${subjectId}`);
  if (!Number.isSafeInteger(subjectId) || !await asyncOne('SELECT id FROM subjects WHERE id=?',subjectId)) redirect('/disciplinas');
  if (intent === 'remove') await execute('DELETE FROM subject_follows WHERE user_id=? AND subject_id=?',user.id,subjectId);
  else await execute('INSERT OR IGNORE INTO subject_follows (user_id,subject_id) VALUES (?,?)',user.id,subjectId);
  revalidatePath('/minha-atividade');
  revalidatePath('/perfil');
  revalidatePath(`/disciplinas/${subjectId}`);
  redirect(destination);
}

export async function markNotificationRead(form: FormData) {
  const user = await requireUser();
  const notificationId = value(form,'notificationId');
  const destination = returnPath(form,'/notificacoes');
  await execute('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?',notificationId,user.id);
  revalidatePath('/notificacoes');
  redirect(destination);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await execute('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL',user.id);
  revalidatePath('/notificacoes');
  redirect('/notificacoes' as Route);
}

export async function createStudyChat(form: FormData) {
  const user = await requireUser();
  const recipientId = value(form,'recipientId');
  const subjectId = Number(value(form,'subjectId'));
  const title = value(form,'title');
  const body = value(form,'body');
  const recipient = await asyncOne<{ id: string; name: string; role: string; verified: number }>("SELECT id,name,role,verified FROM users WHERE id=? AND id<>?",recipientId,user.id);
  const subject = await asyncOne<{ id: number; name: string }>('SELECT s.id,s.name FROM subjects s JOIN courses c ON c.id=s.course_id WHERE s.id=? AND c.institution_id=?',subjectId,user.institution_id);
  if (!recipient || !['MONITOR','PROFESSOR','ADMIN'].includes(recipient.role) || (!recipient.verified && recipient.role !== 'ADMIN') || !subject || title.length < 6 || title.length > 120 || body.length < 10 || body.length > 2000) redirect(errorUrl('/mensagens/nova','Escolha um orientador, uma disciplina, um tema de 6 a 120 caracteres e escreva sua dúvida.'));
  if (!isStudyChatContent(`${title} ${body}`,subject.name)) redirect(errorUrl('/mensagens/nova','O chat é exclusivo para dúvidas, aulas e assuntos vinculados à disciplina selecionada.'));
  const moderation = moderateContent(`${title} ${body}`,'CHAT');
  if (moderation.status === 'BLOCKED') redirect(errorUrl('/mensagens/nova',moderation.reason || 'Conteúdo não permitido.'));
  const conversationId = randomUUID();
  const messageId = randomUUID();
  await transaction(async tx => {
    await run(tx,'INSERT INTO conversations (id,title,subject_id,created_by) VALUES (?,?,?,?)',conversationId,title,subjectId,user.id);
    await run(tx,'INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,CURRENT_TIMESTAMP)',conversationId,user.id);
    await run(tx,'INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)',conversationId,recipientId);
    await run(tx,'INSERT INTO chat_messages (id,conversation_id,author_id,body,status,moderation_reason) VALUES (?,?,?,?,?,?)',messageId,conversationId,user.id,body,moderation.status,moderation.reason);
  });
  if (moderation.status === 'APPROVED') await createNotification(recipientId,'CHAT_MESSAGE',user.id,'CHAT_MESSAGE',messageId,'Nova conversa de estudo',`${subject.name}: ${title}`);
  revalidatePath('/mensagens'); revalidatePath('/notificacoes');
  redirect(`/mensagens/${conversationId}?success=${encodeURIComponent(moderation.status === 'PENDING' ? 'Mensagem enviada para revisão' : 'Conversa criada')}` as Route);
}

export async function sendChatMessage(form: FormData) {
  const user = await requireUser();
  const conversationId = value(form,'conversationId');
  const body = value(form,'body');
  const membership = await asyncOne<{ other_user_id: string; subject_name: string }>(`SELECT other.user_id other_user_id,s.name subject_name FROM conversation_members mine
    JOIN conversation_members other ON other.conversation_id=mine.conversation_id AND other.user_id<>mine.user_id
    JOIN conversations c ON c.id=mine.conversation_id JOIN subjects s ON s.id=c.subject_id
    WHERE mine.conversation_id=? AND mine.user_id=?`,conversationId,user.id);
  if (!membership || body.length < 1 || body.length > 2000) redirect(errorUrl(`/mensagens/${conversationId}`,'A mensagem deve ter de 1 a 2.000 caracteres.'));
  if (!isStudyChatContent(body,membership.subject_name)) redirect(errorUrl(`/mensagens/${conversationId}`,'O chat aceita apenas mensagens ligadas à disciplina e ao estudo.'));
  const moderation = moderateContent(body,'CHAT');
  if (moderation.status === 'BLOCKED') redirect(errorUrl(`/mensagens/${conversationId}`,moderation.reason || 'Conteúdo não permitido.'));
  const messageId = randomUUID();
  await transaction(async tx => {
    await run(tx,'INSERT INTO chat_messages (id,conversation_id,author_id,body,status,moderation_reason) VALUES (?,?,?,?,?,?)',messageId,conversationId,user.id,body,moderation.status,moderation.reason);
    await run(tx,'UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?',conversationId);
  });
  if (moderation.status === 'APPROVED') await createNotification(membership.other_user_id,'CHAT_MESSAGE',user.id,'CHAT_MESSAGE',messageId,'Nova mensagem de estudo',body.slice(0,120));
  revalidatePath('/mensagens'); revalidatePath(`/mensagens/${conversationId}`); revalidatePath('/notificacoes');
  redirect(`/mensagens/${conversationId}` as Route);
}

export async function requestStudySession(form: FormData) {
  const user = await requireUser();
  const conversationId = value(form,'conversationId');
  const proposedAt = value(form,'proposedAt');
  const note = value(form,'note');
  const recipient = await asyncOne<{ other_user_id: string }>(`SELECT other.user_id other_user_id FROM conversation_members mine
    JOIN conversation_members other ON other.conversation_id=mine.conversation_id AND other.user_id<>mine.user_id
    WHERE mine.conversation_id=? AND mine.user_id=?`,conversationId,user.id);
  const date = new Date(proposedAt);
  if (!recipient || Number.isNaN(date.valueOf()) || date.valueOf() < Date.now() || note.length < 5 || note.length > 500) redirect(errorUrl(`/mensagens/${conversationId}`,'Informe uma data futura e um objetivo de estudo entre 5 e 500 caracteres.'));
  const requestId = randomUUID();
  const normalizedDate = date.toISOString().slice(0,19).replace('T',' ');
  await execute('INSERT INTO study_requests (id,conversation_id,requester_id,receiver_id,proposed_at,note) VALUES (?,?,?,?,?,?)',requestId,conversationId,user.id,recipient.other_user_id,normalizedDate,note);
  await createNotification(recipient.other_user_id,'STUDY_SESSION_REQUEST',user.id,'STUDY_REQUEST',requestId,'Novo pedido de aula',note);
  revalidatePath('/mensagens'); revalidatePath(`/mensagens/${conversationId}`); revalidatePath('/notificacoes');
  redirect(`/mensagens/${conversationId}?success=Pedido+de+aula+enviado` as Route);
}

export async function reviewStudyRequest(form: FormData) {
  const user = await requireUser();
  const requestId = value(form,'requestId');
  const decision = value(form,'decision');
  if (!['ACCEPT','REJECT'].includes(decision)) redirect('/mensagens');
  const request = await asyncOne<{ conversation_id: string; requester_id: string }>('SELECT conversation_id,requester_id FROM study_requests WHERE id=? AND receiver_id=? AND status=?',requestId,user.id,'PENDING');
  if (!request) redirect('/mensagens');
  const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
  await transaction(async tx => {
    await run(tx,'UPDATE study_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',status,requestId);
    if (status === 'ACCEPTED') await run(tx,"UPDATE conversations SET status='SCHEDULED',updated_at=CURRENT_TIMESTAMP WHERE id=?",request.conversation_id);
  });
  await createNotification(request.requester_id,'STUDY_SESSION_REVIEWED',user.id,'STUDY_REQUEST',requestId,status === 'ACCEPTED' ? 'Seu pedido de aula foi aceito' : 'Seu pedido de aula foi recusado',status === 'ACCEPTED' ? 'Confira a conversa para combinar os detalhes.' : 'Você pode propor outro horário na conversa.');
  revalidatePath('/mensagens'); revalidatePath(`/mensagens/${request.conversation_id}`); revalidatePath('/notificacoes');
  redirect(`/mensagens/${request.conversation_id}` as Route);
}

export async function createInstitution(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const kind = value(form,'kind'); const city = value(form,'city');
  if (name.length < 3 || city.length < 2 || !['Faculdade','Escola'].includes(kind)) redirect(errorUrl('/administracao','Dados da instituição inválidos.'));
  await execute('INSERT OR IGNORE INTO institutions (name,kind,city) VALUES (?,?,?)',name,kind,city);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function createCourse(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const institutionId = Number(value(form,'institutionId'));
  if (name.length < 2 || !await asyncOne('SELECT id FROM institutions WHERE id=?',institutionId)) redirect(errorUrl('/administracao','Curso ou instituição inválida.'));
  await execute('INSERT OR IGNORE INTO courses (institution_id,name) VALUES (?,?)',institutionId,name);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function createSubject(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const code = value(form,'code'); const courseId = Number(value(form,'courseId'));
  if (name.length < 2 || code.length < 2 || !await asyncOne('SELECT id FROM courses WHERE id=?',courseId)) redirect(errorUrl('/administracao','Disciplina ou curso inválido.'));
  await execute('INSERT OR IGNORE INTO subjects (course_id,name,code) VALUES (?,?,?)',courseId,name,code);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function requestSubject(form: FormData) {
  const user = await requireUser();
  const name = value(form,'name'); const code = value(form,'code').toUpperCase(); const justification = value(form,'justification');
  const courseId = Number(value(form,'courseId'));
  const normalized = normalizeSubjectName(name);
  const course = await asyncOne<{ id:number; institution_id:number }>('SELECT id,institution_id FROM courses WHERE id=? AND institution_id=?',courseId,user.institution_id);
  if (!course || name.length < 3 || name.length > 120 || !normalized || code.length > 30 || justification.length > 600) redirect(errorUrl('/disciplinas','Preencha uma disciplina válida e selecione um curso da sua instituição.'));
  const existing = (await asyncAll<{ name:string }>('SELECT name FROM subjects WHERE course_id=?',courseId)).some(subject => normalizeSubjectName(subject.name) === normalized);
  if (existing) redirect(errorUrl('/disciplinas','Essa disciplina já está cadastrada nesse curso.'));
  if (await asyncOne('SELECT id FROM subject_requests WHERE course_id=? AND normalized_name=? AND status=?',courseId,normalized,'PENDING')) redirect(errorUrl('/disciplinas','Já existe uma solicitação em análise para essa disciplina neste curso.'));
  try {
    await execute('INSERT INTO subject_requests (id,requester_id,institution_id,course_id,name,normalized_name,code,justification) VALUES (?,?,?,?,?,?,?,?)',randomUUID(),user.id,course.institution_id,courseId,name,normalized,code || null,justification || null);
  } catch { redirect(errorUrl('/disciplinas','Não foi possível registrar a solicitação. Tente novamente.')); }
  revalidatePath('/disciplinas'); revalidatePath('/administracao');
  redirect('/disciplinas?success=Solicitação+enviada+para+análise');
}
export async function reviewSubjectRequest(form: FormData) {
  const admin = await requireAdmin();
  const requestId = value(form,'requestId'); const decision = value(form,'decision'); const code = value(form,'code').toUpperCase(); const reason = value(form,'reason');
  if (!['APPROVE','REJECT'].includes(decision) || reason.length > 300) redirect('/administracao');
  try {
    const request = await asyncOne<{ requester_id:string; course_id:number; name:string; normalized_name:string }>('SELECT requester_id,course_id,name,normalized_name FROM subject_requests WHERE id=? AND status=?',requestId,'PENDING');
    if (!request) throw new Error('Solicitação indisponível.');
    const existing = decision === 'APPROVE' && (await asyncAll<{ name:string }>('SELECT name FROM subjects WHERE course_id=?',request.course_id)).some(subject => normalizeSubjectName(subject.name) === request.normalized_name);
    if (decision === 'APPROVE' && (code.length < 2 || code.length > 30 || existing)) throw new Error(existing ? 'Disciplina já cadastrada.' : 'Código inválido.');
    await transaction(async tx => {
      if (decision === 'APPROVE') {
        await run(tx,'INSERT INTO subjects (course_id,name,code) VALUES (?,?,?)',request.course_id,request.name,code);
        await run(tx,"UPDATE subject_requests SET status='APPROVED',review_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?",reason || 'Disciplina cadastrada pela coordenação.',admin.id,requestId);
      } else {
        await run(tx,"UPDATE subject_requests SET status='REJECTED',review_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?",reason || 'Solicitação não aprovada pela coordenação.',admin.id,requestId);
      }
    });
    await createNotification(
      request.requester_id,
      'SUBJECT_REQUEST_REVIEWED',
      admin.id,
      'SUBJECT_REQUEST',
      requestId,
      decision === 'APPROVE' ? 'Sua solicitação de disciplina foi aprovada' : 'Sua solicitação de disciplina foi analisada',
      decision === 'APPROVE' ? `${request.name} já está disponível no catálogo.` : reason || 'Consulte a coordenação se precisar de mais informações.',
    );
  } catch (error) { redirect(errorUrl('/administracao',error instanceof Error ? error.message : 'Não foi possível analisar a solicitação.')); }
  revalidatePath('/disciplinas'); revalidatePath('/administracao'); revalidatePath('/notificacoes');
  redirect('/administracao');
}
export async function updateRole(form: FormData) {
  const admin = await requireAdmin();
  const id = value(form,'userId'); const role = value(form,'role');
  if (id !== admin.id && ['STUDENT','MONITOR','PROFESSOR'].includes(role) && await getUser(id)) await execute('UPDATE users SET role=?,verified=? WHERE id=?',role,role === 'STUDENT' ? 0 : 1,id);
  revalidatePath('/administracao'); revalidatePath('/ranking'); redirect('/administracao');
}
export async function requestRole(form: FormData) {
  const user = await requireUser();
  if (user.role !== 'STUDENT') redirect('/perfil');
  const role = value(form,'role'); const details = value(form,'details');
  if (!['MONITOR','PROFESSOR'].includes(role) || details.length < 15 || details.length > 500) redirect(errorUrl('/perfil','Informe o papel e um vínculo institucional de 15 a 500 caracteres.'));
  if (await asyncOne('SELECT id FROM role_requests WHERE user_id=? AND status=?',user.id,'PENDING')) redirect(errorUrl('/perfil','Você já tem uma solicitação em análise.'));
  await execute('INSERT INTO role_requests (id,user_id,requested_role,details) VALUES (?,?,?,?)',randomUUID(),user.id,role,details);
  revalidatePath('/perfil'); redirect('/perfil?success=Solicitação+enviada+à+coordenação');
}
export async function reviewRoleRequest(form: FormData) {
  const admin = await requireAdmin();
  const id = value(form,'requestId'); const decision = value(form,'decision');
  if (!['APPROVE','REJECT'].includes(decision)) redirect('/administracao');
  const request = await asyncOne<{user_id:string;requested_role:string}>('SELECT user_id,requested_role FROM role_requests WHERE id=? AND status=?',id,'PENDING');
  if (request) {
    await transaction(async tx => {
      if (decision === 'APPROVE') await run(tx,'UPDATE users SET role=?,verified=1 WHERE id=?',request.requested_role,request.user_id);
      await run(tx,'UPDATE role_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',id);
    });
    await createNotification(request.user_id,'ROLE_REQUEST_REVIEWED',admin.id,'PROFILE',id,decision === 'APPROVE' ? 'Seu vínculo acadêmico foi aprovado' : 'Sua solicitação de vínculo foi revisada',decision === 'APPROVE' ? 'Seu perfil agora exibe a função verificada.' : 'Consulte seu perfil para enviar uma nova solicitação com dados atualizados.');
  }
  revalidatePath('/administracao'); revalidatePath('/ranking'); redirect('/administracao');
}
export async function reviewContent(form: FormData) {
  const admin = await requireAdmin();
  const type = value(form,'type'); const id = value(form,'id'); const decision = value(form,'decision');
  const table = type === 'QUESTION' ? 'questions' : type === 'ANSWER' ? 'answers' : null;
  if (!table || !['APPROVE','REMOVE'].includes(decision)) redirect('/administracao');
  const status = decision === 'REMOVE' ? 'REMOVED' : type === 'QUESTION' ? 'OPEN' : 'APPROVED';
  const content = type === 'QUESTION'
    ? await asyncOne<{author_id:string;question_id:string;question_author_id:string;title:string}>('SELECT author_id,id question_id,author_id question_author_id,title FROM questions WHERE id=?',id)
    : await asyncOne<{author_id:string;question_id:string;question_author_id:string;title:string}>('SELECT a.author_id,a.question_id,q.author_id question_author_id,q.title FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.id=?',id);
  await transaction(async tx => {
    await run(tx,`UPDATE ${table} SET status=?,moderation_reason=NULL WHERE id=?`,status,id);
    if (type === 'ANSWER' && decision === 'REMOVE') await run(tx,"UPDATE questions SET accepted_answer_id=NULL,status='OPEN' WHERE accepted_answer_id=?",id);
  });
  if (content) {
    await createNotification(content.author_id,'CONTENT_REVIEWED',admin.id,'QUESTION',content.question_id,decision === 'APPROVE' ? 'Seu conteúdo foi aprovado' : 'Seu conteúdo foi removido',content.title);
    if (type === 'ANSWER' && decision === 'APPROVE' && content.question_author_id !== content.author_id) await createNotification(content.question_author_id,'NEW_ANSWER',content.author_id,'QUESTION',content.question_id,'Sua pergunta recebeu uma resposta',content.title);
  }
  revalidatePath('/administracao'); revalidatePath('/'); redirect('/administracao');
}
export async function resolveReport(form: FormData) {
  await requireAdmin();
  const id = value(form,'reportId'); const decision = value(form,'decision');
  const report = await asyncOne<{target_type:string;target_id:string}>('SELECT target_type,target_id FROM reports WHERE id=? AND status=?',id,'OPEN');
  if (report && ['REMOVE','DISMISS'].includes(decision)) {
    await transaction(async tx => {
      if (decision === 'REMOVE') {
        await run(tx,`UPDATE ${report.target_type === 'QUESTION' ? 'questions' : 'answers'} SET status='REMOVED' WHERE id=?`,report.target_id);
        if (report.target_type === 'ANSWER') await run(tx,"UPDATE questions SET accepted_answer_id=NULL,status='OPEN' WHERE accepted_answer_id=?",report.target_id);
      }
      await run(tx,'UPDATE reports SET status=? WHERE id=?',decision === 'REMOVE' ? 'REMOVED' : 'DISMISSED',id);
    });
  }
  revalidatePath('/administracao'); revalidatePath('/'); redirect('/administracao');
}
