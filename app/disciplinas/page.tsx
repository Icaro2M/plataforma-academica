import Link from 'next/link';
import { getSubjects } from '@/lib/store';

export default function SubjectsPage() {
  const subjects = getSubjects();
  const institutions = [...new Set(subjects.map(s => s.institution_name))];
  return <div className="mx-auto max-w-5xl px-5 py-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-coral">Catálogo acadêmico</p><h1 className="mt-2 text-3xl font-black">Disciplinas disponíveis</h1><p className="mt-2 text-sm text-slate-500">Explore as perguntas por instituição, curso e disciplina.</p>{institutions.map(institution => <section key={institution} className="mt-8"><h2 className="text-xl font-black">{institution}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{subjects.filter(s => s.institution_name === institution).map(subject => <Link key={subject.id} href={`/?disciplina=${subject.id}`} className="rounded-2xl border border-line bg-white p-5 hover:border-teal"><p className="text-xs font-semibold text-teal">{subject.course_name} · {subject.code}</p><h3 className="mt-2 font-bold">{subject.name}</h3><p className="mt-3 text-xs text-slate-500">Ver perguntas →</p></Link>)}</div></section>)}<p className="mt-8 text-xs text-slate-400">Os cadastros iniciais são exemplos para demonstração.</p></div>;
}
