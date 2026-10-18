'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { currentUser, endSession, startSession } from '@/lib/auth';
import { createNotification, database, getQuestion, getUser, one, createUser, verifyPassword } from '@/lib/store';
import { moderateContent } from '@/lib/moderation';

const value = (form: FormData, key: string) => String(form.get(key) || '').trim();
const errorUrl = (path: string, message: string) => `${path}?error=${encodeURIComponent(message)}` as Route;
const requireUser = async () => { const user = await currentUser(); if (!user) redirect(errorUrl('/entrar','Entre para participar.')); return user; };
const requireAdmin = async () => { const user = await requireUser(); if (user.role !== 'ADMIN') redirect('/'); return user; };
const returnPath = (form: FormData, fallback: string) => { const path = value(form,'returnTo'); return (path.startsWith('/') && !path.startsWith('//') ? path : fallback) as Route; };

export async function login(form: FormData) {
  const email = value(form,'email').toLowerCase();
  const password = value(form,'password');
  const account = one<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE email=?',email);
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
  const course = one<{id:number}>('SELECT id FROM courses WHERE id=? AND institution_id=?',courseId,institutionId);
  if (!course) redirect(errorUrl('/cadastrar','Selecione um curso da instituição escolhida.'));
  if (one('SELECT id FROM users WHERE email=?',email)) redirect(errorUrl('/cadastrar','Este e-mail já está cadastrado.'));
  const id = createUser(name,email,password,institutionId,courseId);
  await startSession(id);
  redirect('/');
}
export async function logout() { await endSession(); redirect('/'); }

export async function createQuestion(form: FormData) {
  const user = await requireUser();
  const title = value(form,'title');
  const body = value(form,'body');
  const subjectId = Number(value(form,'subjectId'));
  const subject = one<{id:number}>('SELECT id FROM subjects WHERE id=?',subjectId);
  if (title.length < 12 || title.length > 140 || body.length < 30 || body.length > 10000 || !subject) redirect(errorUrl('/perguntas/nova','Preencha título (12 a 140 caracteres), descrição (30 a 10.000) e disciplina.'));
  const moderation = moderateContent(`${title} ${body}`,'QUESTION');
  if (moderation.status === 'BLOCKED') redirect(errorUrl('/perguntas/nova',moderation.reason || 'Conteúdo não permitido.'));
  const id = randomUUID();
  database().prepare('INSERT INTO questions (id,author_id,subject_id,title,body,status,moderation_reason) VALUES (?,?,?,?,?,?,?)').run(id,user.id,subjectId,title,body,moderation.status === 'PENDING' ? 'PENDING' : 'OPEN',moderation.reason);
  revalidatePath('/');
  redirect(`/perguntas/${id}?created=1` as Route);
}

export async function createAnswer(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const body = value(form,'body');
  const question = getQuestion(questionId);
  if (!question || !['OPEN','RESOLVED'].includes(question.status)) redirect('/');
  if (question.author_id === user.id) redirect(errorUrl(`/perguntas/${questionId}`,'Você não pode responder à própria pergunta.'));
  if (body.length < 10 || body.length > 10000) redirect(errorUrl(`/perguntas/${questionId}`,'A resposta deve ter de 10 a 10.000 caracteres.'));
  const moderation = moderateContent(body,'ANSWER');
  if (moderation.status === 'BLOCKED') redirect(errorUrl(`/perguntas/${questionId}`,moderation.reason || 'Conteúdo não permitido.'));
  const answerId = randomUUID();
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO answers (id,question_id,author_id,body,status,moderation_reason) VALUES (?,?,?,?,?,?)').run(answerId,questionId,user.id,body,moderation.status,moderation.reason);
    if (moderation.status === 'APPROVED') createNotification(question.author_id,'NEW_ANSWER',user.id,'QUESTION',questionId,'Sua pergunta recebeu uma resposta',question.title);
    db.exec('COMMIT');
  } catch { db.exec('ROLLBACK'); redirect(errorUrl(`/perguntas/${questionId}`,'Não foi possível publicar a resposta.')); }
  revalidatePath(`/perguntas/${questionId}`);
  revalidatePath('/ranking');
  redirect(`/perguntas/${questionId}?answered=1&success=${encodeURIComponent(moderation.status === 'PENDING' ? 'Resposta enviada para revisão' : 'Resposta publicada')}` as Route);
}

export async function acceptAnswer(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const answerId = value(form,'answerId');
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    const question = getQuestion(questionId);
    const answer = one<{id:string;author_id:string}>('SELECT id,author_id FROM answers WHERE id=? AND question_id=? AND status=?',answerId,questionId,'APPROVED');
    if (!question || question.author_id !== user.id || !answer || question.status === 'REMOVED') throw new Error('Sem permissão para aceitar esta resposta.');
    db.prepare('UPDATE questions SET accepted_answer_id=?,status=? WHERE id=?').run(answerId,'RESOLVED',questionId);
    if (answer.author_id !== user.id) createNotification(answer.author_id,'ANSWER_ACCEPTED',user.id,'QUESTION',questionId,'Sua resposta foi marcada como solução',question.title);
    db.exec('COMMIT');
  } catch { db.exec('ROLLBACK'); redirect(errorUrl(`/perguntas/${questionId}`,'Não foi possível marcar a solução.')); }
  revalidatePath(`/perguntas/${questionId}`); revalidatePath('/ranking'); revalidatePath('/');
  redirect(`/perguntas/${questionId}` as Route);
}

export async function voteAnswer(form: FormData) {
  const user = await requireUser();
  const answerId = value(form,'answerId');
  const questionId = value(form,'questionId');
  const answer = one<{id:string;author_id:string}>('SELECT id,author_id FROM answers WHERE id=? AND question_id=? AND status=?',answerId,questionId,'APPROVED');
  if (answer && answer.author_id !== user.id) database().prepare('INSERT OR IGNORE INTO answer_votes (answer_id,user_id) VALUES (?,?)').run(answerId,user.id);
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
  const exists = type === 'QUESTION' ? one('SELECT id FROM questions WHERE id=?',id) : one('SELECT id FROM answers WHERE id=? AND question_id=?',id,questionId);
  if (exists) database().prepare('INSERT OR IGNORE INTO reports (id,reporter_id,target_type,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),user.id,type,id,reason);
  redirect(`/perguntas/${questionId}?success=Denúncia+enviada+para+revisão` as Route);
}

export async function toggleSaveQuestion(form: FormData) {
  const user = await requireUser();
  const questionId = value(form,'questionId');
  const intent = value(form,'intent');
  const destination = returnPath(form,`/perguntas/${questionId}`);
  const question = one<{id:string}>("SELECT id FROM questions WHERE id=? AND status IN ('OPEN','RESOLVED')",questionId);
  if (!question) redirect('/');
  if (intent === 'remove') database().prepare('DELETE FROM question_saves WHERE user_id=? AND question_id=?').run(user.id,questionId);
  else database().prepare('INSERT OR IGNORE INTO question_saves (user_id,question_id) VALUES (?,?)').run(user.id,questionId);
  revalidatePath('/minha-atividade');
  revalidatePath(`/perguntas/${questionId}`);
  redirect(destination);
}

export async function toggleSubjectFollow(form: FormData) {
  const user = await requireUser();
  const subjectId = Number(value(form,'subjectId'));
  const intent = value(form,'intent');
  const destination = returnPath(form,`/disciplinas/${subjectId}`);
  if (!Number.isSafeInteger(subjectId) || !one('SELECT id FROM subjects WHERE id=?',subjectId)) redirect('/disciplinas');
  if (intent === 'remove') database().prepare('DELETE FROM subject_follows WHERE user_id=? AND subject_id=?').run(user.id,subjectId);
  else database().prepare('INSERT OR IGNORE INTO subject_follows (user_id,subject_id) VALUES (?,?)').run(user.id,subjectId);
  revalidatePath('/minha-atividade');
  revalidatePath('/perfil');
  revalidatePath(`/disciplinas/${subjectId}`);
  redirect(destination);
}

export async function markNotificationRead(form: FormData) {
  const user = await requireUser();
  const notificationId = value(form,'notificationId');
  const destination = returnPath(form,'/notificacoes');
  database().prepare('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?').run(notificationId,user.id);
  revalidatePath('/notificacoes');
  redirect(destination);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  database().prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL').run(user.id);
  revalidatePath('/notificacoes');
  redirect('/notificacoes' as Route);
}

export async function createInstitution(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const kind = value(form,'kind'); const city = value(form,'city');
  if (name.length < 3 || city.length < 2 || !['Faculdade','Escola'].includes(kind)) redirect(errorUrl('/administracao','Dados da instituição inválidos.'));
  database().prepare('INSERT OR IGNORE INTO institutions (name,kind,city) VALUES (?,?,?)').run(name,kind,city);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function createCourse(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const institutionId = Number(value(form,'institutionId'));
  if (name.length < 2 || !one('SELECT id FROM institutions WHERE id=?',institutionId)) redirect(errorUrl('/administracao','Curso ou instituição inválida.'));
  database().prepare('INSERT OR IGNORE INTO courses (institution_id,name) VALUES (?,?)').run(institutionId,name);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function createSubject(form: FormData) {
  await requireAdmin();
  const name = value(form,'name'); const code = value(form,'code'); const courseId = Number(value(form,'courseId'));
  if (name.length < 2 || code.length < 2 || !one('SELECT id FROM courses WHERE id=?',courseId)) redirect(errorUrl('/administracao','Disciplina ou curso inválido.'));
  database().prepare('INSERT OR IGNORE INTO subjects (course_id,name,code) VALUES (?,?,?)').run(courseId,name,code);
  revalidatePath('/administracao'); redirect('/administracao');
}
export async function updateRole(form: FormData) {
  const admin = await requireAdmin();
  const id = value(form,'userId'); const role = value(form,'role');
  if (id !== admin.id && ['STUDENT','MONITOR','PROFESSOR'].includes(role) && getUser(id)) database().prepare('UPDATE users SET role=?,verified=? WHERE id=?').run(role,role === 'STUDENT' ? 0 : 1,id);
  revalidatePath('/administracao'); revalidatePath('/ranking'); redirect('/administracao');
}
export async function requestRole(form: FormData) {
  const user = await requireUser();
  if (user.role !== 'STUDENT') redirect('/perfil');
  const role = value(form,'role'); const details = value(form,'details');
  if (!['MONITOR','PROFESSOR'].includes(role) || details.length < 15 || details.length > 500) redirect(errorUrl('/perfil','Informe o papel e um vínculo institucional de 15 a 500 caracteres.'));
  if (one('SELECT id FROM role_requests WHERE user_id=? AND status=?',user.id,'PENDING')) redirect(errorUrl('/perfil','Você já tem uma solicitação em análise.'));
  database().prepare('INSERT INTO role_requests (id,user_id,requested_role,details) VALUES (?,?,?,?)').run(randomUUID(),user.id,role,details);
  revalidatePath('/perfil'); redirect('/perfil?success=Solicitação+enviada+à+coordenação');
}
export async function reviewRoleRequest(form: FormData) {
  const admin = await requireAdmin();
  const id = value(form,'requestId'); const decision = value(form,'decision');
  if (!['APPROVE','REJECT'].includes(decision)) redirect('/administracao');
  const db = database(); db.exec('BEGIN IMMEDIATE');
  try {
    const request = one<{user_id:string;requested_role:string}>('SELECT user_id,requested_role FROM role_requests WHERE id=? AND status=?',id,'PENDING');
    if (request) {
      if (decision === 'APPROVE') db.prepare('UPDATE users SET role=?,verified=1 WHERE id=?').run(request.requested_role,request.user_id);
      db.prepare('UPDATE role_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',id);
      createNotification(request.user_id,'ROLE_REQUEST_REVIEWED',admin.id,'PROFILE',id,decision === 'APPROVE' ? 'Seu vínculo acadêmico foi aprovado' : 'Sua solicitação de vínculo foi revisada',decision === 'APPROVE' ? 'Seu perfil agora exibe a função verificada.' : 'Consulte seu perfil para enviar uma nova solicitação com dados atualizados.');
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  revalidatePath('/administracao'); revalidatePath('/ranking'); redirect('/administracao');
}
export async function reviewContent(form: FormData) {
  const admin = await requireAdmin();
  const type = value(form,'type'); const id = value(form,'id'); const decision = value(form,'decision');
  const table = type === 'QUESTION' ? 'questions' : type === 'ANSWER' ? 'answers' : null;
  if (!table || !['APPROVE','REMOVE'].includes(decision)) redirect('/administracao');
  const status = decision === 'REMOVE' ? 'REMOVED' : type === 'QUESTION' ? 'OPEN' : 'APPROVED';
  const db = database(); db.exec('BEGIN IMMEDIATE');
  try {
    const content = type === 'QUESTION'
      ? one<{author_id:string;question_id:string;question_author_id:string;title:string}>('SELECT author_id,id question_id,author_id question_author_id,title FROM questions WHERE id=?',id)
      : one<{author_id:string;question_id:string;question_author_id:string;title:string}>('SELECT a.author_id,a.question_id,q.author_id question_author_id,q.title FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.id=?',id);
    db.prepare(`UPDATE ${table} SET status=?,moderation_reason=NULL WHERE id=?`).run(status,id);
    if (type === 'ANSWER' && decision === 'REMOVE') db.prepare("UPDATE questions SET accepted_answer_id=NULL,status='OPEN' WHERE accepted_answer_id=?").run(id);
    if (content) {
      createNotification(content.author_id,'CONTENT_REVIEWED',admin.id,'QUESTION',content.question_id,decision === 'APPROVE' ? 'Seu conteúdo foi aprovado' : 'Seu conteúdo foi removido',content.title);
      if (type === 'ANSWER' && decision === 'APPROVE' && content.question_author_id !== content.author_id) createNotification(content.question_author_id,'NEW_ANSWER',content.author_id,'QUESTION',content.question_id,'Sua pergunta recebeu uma resposta',content.title);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  revalidatePath('/administracao'); revalidatePath('/'); redirect('/administracao');
}
export async function resolveReport(form: FormData) {
  await requireAdmin();
  const id = value(form,'reportId'); const decision = value(form,'decision');
  const report = one<{target_type:string;target_id:string}>('SELECT target_type,target_id FROM reports WHERE id=? AND status=?',id,'OPEN');
  if (report && ['REMOVE','DISMISS'].includes(decision)) {
    const db = database(); db.exec('BEGIN IMMEDIATE');
    try {
      if (decision === 'REMOVE') {
        db.prepare(`UPDATE ${report.target_type === 'QUESTION' ? 'questions' : 'answers'} SET status='REMOVED' WHERE id=?`).run(report.target_id);
        if (report.target_type === 'ANSWER') db.prepare("UPDATE questions SET accepted_answer_id=NULL,status='OPEN' WHERE accepted_answer_id=?").run(report.target_id);
      }
      db.prepare('UPDATE reports SET status=? WHERE id=?').run(decision === 'REMOVE' ? 'REMOVED' : 'DISMISSED',id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  revalidatePath('/administracao'); revalidatePath('/'); redirect('/administracao');
}
