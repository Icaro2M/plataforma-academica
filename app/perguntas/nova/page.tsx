import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getCoursesForInstitution, getSubjectsForInstitution } from '@/lib/store';
import { QuestionComposer } from '@/components/question-composer';

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ error?: string; disciplina?: string }> }) {
  const user = await currentUser();
  if (!user || !user.institution_id) redirect('/entrar');
  const { error, disciplina } = await searchParams;
  const courses = getCoursesForInstitution(user.institution_id).map(({ id, name }) => ({ id, name }));
  const subjects = getSubjectsForInstitution(user.institution_id).map(({ id, course_id, name, course_name, institution_name }) => ({ id, course_id, name, course_name, institution_name }));
  const selectedSubject = subjects.some(subject => String(subject.id) === disciplina) ? disciplina! : '';
  return <div className="mx-auto max-w-3xl px-5 py-8 md:py-10">
    <Link href="/" className="text-sm font-semibold text-slate-500">← Voltar ao fórum</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-coral">Nova pergunta</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight">O que você quer entender?</h1>
    <p className="mt-2 text-sm text-slate-500">Escolha primeiro o curso e depois uma disciplina correspondente. Explique o contexto e conte o que já tentou.</p>
    <QuestionComposer courses={courses} subjects={subjects} selectedSubject={selectedSubject} error={error}/>
  </div>;
}
