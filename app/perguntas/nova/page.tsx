import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSubjects } from '@/lib/store';
import { QuestionComposer } from '@/components/question-composer';

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ error?: string; disciplina?: string }> }) {
  if (!await currentUser()) redirect('/entrar');
  const { error, disciplina } = await searchParams;
  const subjects = getSubjects().map(({ id, name, course_name, institution_name }) => ({ id, name, course_name, institution_name }));
  const selectedSubject = subjects.some(subject => String(subject.id) === disciplina) ? disciplina! : '';
  return <div className="mx-auto max-w-3xl px-5 py-8 md:py-10">
    <Link href="/" className="text-sm font-semibold text-slate-500">← Voltar ao fórum</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-coral">Nova pergunta</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight">O que você quer entender?</h1>
    <p className="mt-2 text-sm text-slate-500">Escolha a disciplina, explique o contexto e conte o que já tentou.</p>
    <QuestionComposer subjects={subjects} selectedSubject={selectedSubject} error={error}/>
  </div>;
}
