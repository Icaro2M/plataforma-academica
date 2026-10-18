import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createQuestion } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { getSubjects } from '@/lib/store';

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{error?:string;disciplina?:string}> }) {
  if (!await currentUser()) redirect('/entrar');
  const { error, disciplina } = await searchParams;
  const subjects = getSubjects();
  const selectedSubject = subjects.some(subject => String(subject.id) === disciplina) ? disciplina : '';
  return <div className="mx-auto max-w-3xl px-5 py-10"><Link href="/" className="text-sm font-semibold text-slate-500">← Voltar ao fórum</Link><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-coral">Nova pergunta</p><h1 className="mt-2 text-3xl font-black">O que você quer entender?</h1><p className="mt-2 text-sm text-slate-500">Diga a disciplina, explique o contexto e conte o que já tentou.</p><form action={createQuestion} className="mt-8 space-y-5 rounded-3xl border border-line bg-white p-6 md:p-8"><label className="block text-sm font-bold">Título<input name="title" required minLength={12} maxLength={140} className="mt-2 w-full rounded-xl border border-line p-3 font-normal" placeholder="Ex.: Como escolher os limites de uma integral dupla?"/></label><label className="block text-sm font-bold">Disciplina<select name="subjectId" required defaultValue={selectedSubject} className="mt-2 w-full rounded-xl border border-line bg-white p-3 font-normal"><option value="" disabled>Selecione uma disciplina</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.institution_name} · {s.course_name} · {s.name}</option>)}</select></label><label className="block text-sm font-bold">Descrição<textarea name="body" required minLength={30} maxLength={10000} className="mt-2 min-h-48 w-full rounded-xl border border-line p-3 font-normal" placeholder="Explique sua dúvida com detalhes..."/></label><p className="text-xs text-slate-500">Uma triagem automática simples bloqueia linguagem ofensiva e sinaliza perguntas possivelmente fora do contexto acadêmico para revisão.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">Publicar pergunta</button></form></div>;
}
