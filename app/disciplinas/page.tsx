import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, BookOpenText, Search } from 'lucide-react';
import { SubjectSymbol } from '@/components/subject-symbol';
import { getCourses, getInstitutions, getSubjectCatalog } from '@/lib/store';

type Filters = { busca?: string; instituicao?: string; curso?: string };
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const raw = await searchParams;
  const institutions = getInstitutions();
  const courses = getCourses();
  const subjects = getSubjectCatalog();
  const search = typeof raw.busca === 'string' ? raw.busca.trim().slice(0, 80) : '';
  const institutionId = institutions.some(item => String(item.id) === raw.instituicao) ? Number(raw.instituicao) : 0;
  const courseId = courses.some(item => String(item.id) === raw.curso) ? Number(raw.curso) : 0;
  const term = fold(search);
  const filtered = subjects.filter(subject =>
    (!institutionId || subject.institution_id === institutionId) &&
    (!courseId || subject.course_id === courseId) &&
    (!term || fold(`${subject.name} ${subject.code} ${subject.course_name} ${subject.institution_name}`).includes(term))
  );
  const institutionGroups = institutions.filter(item => filtered.some(subject => subject.institution_id === item.id))
    .sort((a, b) => filtered.filter(subject => subject.institution_id === b.id).reduce((sum, subject) => sum + subject.question_count, 0) - filtered.filter(subject => subject.institution_id === a.id).reduce((sum, subject) => sum + subject.question_count, 0));

  return <div className="mx-auto w-full max-w-[1240px] px-5 pb-14 pt-8 sm:px-8 xl:px-10">
    <p className="text-[11px] font-bold uppercase tracking-[.17em] text-accent">Catálogo acadêmico</p>
    <h1 className="mt-2 font-display text-[26px] font-extrabold tracking-[-.055em] text-ink sm:text-[30px]">Explore as disciplinas</h1>
    <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-muted">Encontre sua área de estudo e participe das conversas de cada curso.</p>

    <form action="/disciplinas" className="mt-7 grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="col-span-2 min-w-0 lg:col-span-1"><span className="mb-1.5 block text-[11px] font-semibold text-[#526178]">Buscar disciplina</span><span className="relative block"><Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b98ab]"/><input type="search" name="busca" defaultValue={search} maxLength={80} placeholder="Nome, código ou curso" className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[12px] text-ink placeholder:text-[#96a1b0]"/></span></label>
      <label><span className="mb-1.5 block text-[11px] font-semibold text-[#526178]">Instituição</span><select name="instituicao" defaultValue={institutionId || ''} className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink"><option value="">Todas as instituições</option>{institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="mb-1.5 block text-[11px] font-semibold text-[#526178]">Curso</span><select name="curso" defaultValue={courseId || ''} className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink"><option value="">Todos os cursos</option>{courses.map(item => <option key={item.id} value={item.id}>{item.name} · {item.institution_name}</option>)}</select></label>
      <button type="submit" className="col-span-2 h-10 self-end rounded-md bg-brand px-5 text-[12px] font-semibold text-white transition-colors hover:bg-[#304e81] lg:col-span-1">Aplicar filtros</button>
    </form>
    <div className="mt-6 flex items-center justify-between gap-3 border-b border-line pb-3"><p className="text-[12px] font-semibold text-brand">{filtered.length} {filtered.length === 1 ? 'disciplina encontrada' : 'disciplinas encontradas'}</p>{Boolean(search || institutionId || courseId) && <Link href="/disciplinas" className="text-[11px] font-semibold text-accent hover:underline">Limpar filtros</Link>}</div>

    {filtered.length ? institutionGroups.map(institution => <section key={institution.id} aria-labelledby={`institution-${institution.id}`} className="mt-7">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 id={`institution-${institution.id}`} className="font-display text-[17px] font-bold tracking-[-.03em] text-brand">{institution.name}</h2><span className="text-[11px] text-muted">{institution.kind} · {institution.city}</span></div>
      {courses.filter(course => course.institution_id === institution.id && filtered.some(subject => subject.course_id === course.id)).sort((a,b) => filtered.filter(subject => subject.course_id === b.id).reduce((sum, subject) => sum + subject.question_count, 0) - filtered.filter(subject => subject.course_id === a.id).reduce((sum, subject) => sum + subject.question_count, 0)).map(course => <div key={course.id} className="mt-5"><h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.12em] text-muted">{course.name}</h3><div className="grid gap-3 md:grid-cols-2">{filtered.filter(subject => subject.course_id === course.id).sort((a,b) => b.question_count - a.question_count).map(subject => <Link key={subject.id} href={`/disciplinas/${subject.id}` as Route} className="group flex min-w-0 gap-3.5 rounded-lg border border-line bg-white p-4 transition-colors hover:border-[#afbfde] hover:bg-[#fcfdff]"><SubjectSymbol name={subject.name}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{subject.code}</p><h4 className="mt-1 font-display text-[15px] font-bold leading-5 text-ink group-hover:text-accent">{subject.name}</h4></div><ArrowRight size={16} className="shrink-0 text-[#9aa9be] transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true"/></div><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted"><span>{subject.question_count} {subject.question_count === 1 ? 'pergunta' : 'perguntas'}</span>{subject.latest_question_at && <span>Atividade em {new Date(`${subject.latest_question_at}Z`).toLocaleDateString('pt-BR')}</span>}</div></div></Link>)}</div></div>)}
    </section>) : <div className="mt-6 rounded-lg border border-line bg-white px-6 py-12 text-center"><BookOpenText className="mx-auto text-[#9aa9be]" size={27}/><h2 className="mt-3 font-display text-[16px] font-bold text-brand">Nenhuma disciplina encontrada</h2><p className="mt-1 text-[12px] text-muted">Tente outro nome ou ajuste os filtros.</p><Link href="/disciplinas" className="mt-4 inline-block text-[12px] font-semibold text-accent hover:underline">Ver todas as disciplinas</Link></div>}
    <p className="mt-9 text-[10px] text-[#8a96a8]">Os cadastros iniciais são exemplos para demonstração.</p>
  </div>;
}
