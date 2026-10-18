import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bookmark, CheckCircle2, ThumbsUp } from 'lucide-react';
import { acceptAnswer, reportContent, toggleSaveQuestion, voteAnswer } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { getAnswers, getQuestion, isQuestionSaved } from '@/lib/store';
import { AcademicContent } from '@/components/academic-content';
import { AnswerComposer } from '@/components/answer-composer';
import { ClearQuestionDraft } from '@/components/question-composer';

const roleLabel = (role: string, verified: number) => verified && role === 'MONITOR' ? 'Monitor verificado' : verified && role === 'PROFESSOR' ? 'Professor verificado' : role === 'ADMIN' ? 'Coordenação' : 'Aluno';
const dateLabel = (date: string) => new Date(`${date}Z`).toLocaleDateString('pt-BR');

export default async function QuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; created?: string; answered?: string }> }) {
  const { id } = await params;
  const { error, success, created, answered } = await searchParams;
  const user = await currentUser();
  const question = getQuestion(id);
  if (!question || (['PENDING', 'REMOVED'].includes(question.status) && user?.id !== question.author_id && user?.role !== 'ADMIN')) notFound();
  const answers = getAnswers(id);
  const isOwner = user?.id === question.author_id;
  const saved = user ? isQuestionSaved(user.id, question.id) : false;
  return <div className="mx-auto max-w-4xl px-5 py-8 md:px-10">
    {created === '1' && <ClearQuestionDraft/>}
    <Link href="/" className="text-sm font-semibold text-slate-500">← Voltar ao fórum</Link>
    <div className="mt-7 flex flex-wrap items-center gap-2 text-xs">
      <Link href={`/disciplinas/${question.subject_id}`} className="rounded-md bg-[#e5f2ef] px-2.5 py-1 font-bold text-teal hover:underline">{question.subject_name}</Link>
      <span className="text-slate-500">{question.institution_name} / {question.course_name}</span>
    </div>
    {question.status === 'PENDING' && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Sua pergunta aguarda revisão: {question.moderation_reason}</p>}
    {question.status === 'REMOVED' && <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">Esta pergunta foi removida pela moderação.</p>}
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {(success || created === '1') && <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-700">{created === '1' ? 'Pergunta enviada com sucesso.' : success}</p>}
    <article className="mt-5 rounded-xl border border-line bg-white p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-2xl text-2xl font-black leading-tight tracking-tight md:text-3xl">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-2">{user && <form action={toggleSaveQuestion}><input type="hidden" name="questionId" value={question.id}/><input type="hidden" name="intent" value={saved ? 'remove' : 'save'}/><input type="hidden" name="returnTo" value={`/perguntas/${question.id}`}/><button aria-pressed={saved} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${saved ? 'border-accent bg-[#eef2fb] text-accent' : 'border-line text-slate-600 hover:border-accent hover:text-accent'}`}><Bookmark size={14} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Salva' : 'Salvar'}</button></form>}{question.status === 'RESOLVED' && <span className="inline-flex items-center gap-1 rounded-md bg-[#e5f2ef] px-2.5 py-1 text-xs font-bold text-teal"><CheckCircle2 size={15}/> Resolvida</span>}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span className="font-semibold text-slate-700">{question.author_name}</span><span>·</span><span>{roleLabel(question.author_role, question.author_verified)}</span><span>·</span><time dateTime={question.created_at}>{dateLabel(question.created_at)}</time></div>
      <div className="mt-7 border-t border-line pt-6"><AcademicContent>{question.body}</AcademicContent></div>
      {user && !isOwner && <form action={reportContent} className="mt-7 flex flex-wrap gap-2 border-t border-line pt-5"><input type="hidden" name="type" value="QUESTION"/><input type="hidden" name="id" value={question.id}/><input type="hidden" name="questionId" value={question.id}/><input name="reason" required minLength={5} maxLength={200} className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-xs" placeholder="Motivo da denúncia" aria-label="Motivo da denúncia da pergunta"/><button className="text-xs font-semibold text-slate-500">Denunciar</button></form>}
    </article>
    <section aria-labelledby="answers-title" className="mt-9"><div className="mb-4 flex items-baseline justify-between"><h2 id="answers-title" className="text-xl font-black tracking-tight">Respostas</h2><span className="text-sm text-slate-500">{answers.length} {answers.length === 1 ? 'contribuição' : 'contribuições'}</span></div>
      {answers.length === 0 && <div className="rounded-xl border border-dashed border-line bg-white p-7 text-sm text-slate-500">Ainda não há respostas aprovadas. Compartilhe seu raciocínio para ajudar a comunidade.</div>}
      <div className="space-y-4">{answers.map(answer => <article key={answer.id} className={`rounded-xl border bg-white p-5 md:p-6 ${question.accepted_answer_id === answer.id ? 'border-teal' : 'border-line'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold">{answer.author_name}</p><p className="mt-1 text-xs text-slate-500">{roleLabel(answer.author_role, answer.author_verified)} · <time dateTime={answer.created_at}>{dateLabel(answer.created_at)}</time></p></div>{question.accepted_answer_id === answer.id && <span className="flex items-center gap-1 rounded-md bg-[#e5f2ef] px-2 py-1 text-xs font-bold text-teal"><CheckCircle2 size={16}/> Solução aceita</span>}</div>
        <div className="mt-5"><AcademicContent>{answer.body}</AcademicContent></div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-4 text-xs"><span className="flex items-center gap-1 text-slate-500"><ThumbsUp size={14}/>{answer.useful_count} úteis</span>{user && user.id !== answer.author_id && <form action={voteAnswer}><input type="hidden" name="questionId" value={id}/><input type="hidden" name="answerId" value={answer.id}/><button className="font-bold text-teal">Foi útil</button></form>}{isOwner && question.accepted_answer_id !== answer.id && <form action={acceptAnswer}><input type="hidden" name="questionId" value={id}/><input type="hidden" name="answerId" value={answer.id}/><button className="font-bold text-teal">Marcar solução</button></form>}{user && user.id !== answer.author_id && <form action={reportContent} className="ml-auto flex flex-wrap gap-2"><input type="hidden" name="type" value="ANSWER"/><input type="hidden" name="id" value={answer.id}/><input type="hidden" name="questionId" value={id}/><input name="reason" required minLength={5} maxLength={200} className="rounded-lg border border-line px-2 py-1" placeholder="Motivo da denúncia" aria-label={`Motivo da denúncia da resposta de ${answer.author_name}`}/><button className="text-slate-500">Denunciar</button></form>}</div>
      </article>)}</div>
    </section>
    {['OPEN', 'RESOLVED'].includes(question.status) && (user && !isOwner ? <AnswerComposer questionId={id} answered={answered === '1'}/> : !user ? <div className="mt-8 rounded-xl border border-line bg-white p-5 text-sm"><Link href="/entrar" className="font-bold text-teal">Entre</Link> para responder esta pergunta.</div> : null)}
  </div>;
}
