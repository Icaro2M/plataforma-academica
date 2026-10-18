import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, BellPlus, Plus, Search } from 'lucide-react';
import { toggleSubjectFollow } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { SubjectSymbol } from '@/components/subject-symbol';
import { QuestionCard } from '@/components/question-card';
import { Pagination } from '@/components/pagination';
import { countQuestions, getQuestions, getSubjectCatalog, getSubjectCounts, getSubjectFollowerCount, isSubjectFollowed } from '@/lib/store';

type Filters = { busca?: string; estado?: string; pagina?: string };

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Filters> }) {
  const { id } = await params;
  const subjectId = Number(id);
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) notFound();
  const subject = getSubjectCatalog().find(item => item.id === subjectId);
  if (!subject) notFound();
  const raw = await searchParams;
  const search = typeof raw.busca === 'string' ? raw.busca.trim().slice(0, 100) : '';
  const status = raw.estado === 'unanswered' || raw.estado === 'resolved' ? raw.estado : '';
  const questionFilters = { subjectId, search, status };
  const totalQuestions = countQuestions(questionFilters);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));
  const requestedPage = Number.parseInt(typeof raw.pagina === 'string' ? raw.pagina : '1', 10);
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const questions = getQuestions({ ...questionFilters, limit: pageSize, offset: (page - 1) * pageSize });
  const counts = getSubjectCounts(subjectId);
  const user = await currentUser();
  const following = user ? isSubjectFollowed(user.id, subjectId) : false;
  const followerCount = getSubjectFollowerCount(subjectId);
  const statusHref = (next: string) => {
    const query = new URLSearchParams();
    if (search) query.set('busca', search);
    if (next) query.set('estado', next);
    return `/disciplinas/${subjectId}${query.size ? `?${query}` : ''}` as Route;
  };
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set('busca', search);
    if (status) query.set('estado', status);
    if (target > 1) query.set('pagina', String(target));
    return `/disciplinas/${subjectId}${query.size ? `?${query}` : ''}` as Route;
  };

  return <div className="mx-auto w-full max-w-[1140px] px-5 pb-14 pt-7 sm:px-8 xl:px-10">
    <Link href="/disciplinas" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-accent"><ArrowLeft size={15}/> Todas as disciplinas</Link>
    <section className="mt-5 rounded-lg border border-line bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start gap-4"><SubjectSymbol name={subject.name} size="lg"/><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-accent">{subject.code} · {subject.course_name}</p><h1 className="mt-1 font-display text-[25px] font-extrabold tracking-[-.045em] text-ink sm:text-[29px]">{subject.name}</h1><p className="mt-1 text-[12px] text-muted">{subject.institution_name}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{user && <form action={toggleSubjectFollow} className="flex-1 sm:flex-none"><input type="hidden" name="subjectId" value={subject.id}/><input type="hidden" name="intent" value={following ? 'remove' : 'follow'}/><input type="hidden" name="returnTo" value={`/disciplinas/${subject.id}`}/><button aria-pressed={following} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3.5 py-2.5 text-[11px] font-semibold ${following ? 'border-accent bg-[#eef2fb] text-accent' : 'border-line text-brand hover:border-accent'}`}><BellPlus size={15}/>{following ? 'Acompanhando' : 'Acompanhar'}</button></form>}<Link href={`/perguntas/nova?disciplina=${subject.id}` as Route} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#2549bd] sm:flex-none"><Plus size={15}/> Perguntar nesta disciplina</Link></div></div><div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-4 text-center sm:max-w-xl sm:grid-cols-4 sm:text-left"><div><strong className="font-display text-[20px] font-bold text-brand">{subject.question_count}</strong><p className="text-[11px] text-muted">{subject.question_count === 1 ? 'pergunta' : 'perguntas'}</p></div><div><strong className="font-display text-[20px] font-bold text-brand">{counts.unanswered}</strong><p className="text-[11px] text-muted">sem resposta</p></div><div><strong className="font-display text-[20px] font-bold text-brand">{counts.resolved}</strong><p className="text-[11px] text-muted">{counts.resolved === 1 ? 'resolvida' : 'resolvidas'}</p></div><div><strong className="font-display text-[20px] font-bold text-brand">{followerCount}</strong><p className="text-[11px] text-muted">acompanhando</p></div></div></section>
    <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="font-display text-[18px] font-bold text-brand">Conversas da disciplina</h2><p className="mt-1 text-[12px] text-muted">Dúvidas recentes e respostas da comunidade.</p></div><span className="text-[11px] text-muted">{totalQuestions} {totalQuestions === 1 ? 'pergunta' : 'perguntas'}</span></div>
    <form action={`/disciplinas/${subjectId}`} className="mt-5 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="estado" value={status}/><label className="relative flex-1"><span className="sr-only">Buscar nesta disciplina</span><Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b98ab]"/><input name="busca" type="search" maxLength={100} defaultValue={search} placeholder="Buscar nesta disciplina" className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[12px]"/></label><button className="h-10 rounded-md bg-brand px-4 text-[12px] font-semibold text-white">Buscar</button></form>
    <nav aria-label="Filtrar perguntas da disciplina" className="mt-5 flex gap-5 border-b border-line text-[12px] sm:gap-7">{([['', 'Recentes'], ['unanswered', 'Sem resposta'], ['resolved', 'Resolvidas']] as const).map(([value, label]) => <Link key={value} href={statusHref(value)} aria-current={status === value ? 'page' : undefined} className={`-mb-px border-b-2 pb-3 font-semibold ${status === value ? 'border-accent text-brand' : 'border-transparent text-muted hover:text-brand'}`}>{label}</Link>)}</nav>
    {questions.length ? <><section aria-label="Perguntas da disciplina" className="mt-4 overflow-hidden rounded-lg border border-line bg-white">{questions.map(question => <QuestionCard key={question.id} question={question}/>)}</section><Pagination page={page} totalPages={totalPages} hrefForPage={pageHref}/></> : <div className="mt-4 rounded-lg border border-line bg-white px-6 py-12 text-center"><h3 className="font-display text-[16px] font-bold text-brand">Nenhuma pergunta nesta seleção</h3><p className="mt-1 text-[12px] text-muted">Explore outro estado ou abra a primeira conversa.</p><div className="mt-4 flex justify-center gap-4 text-[12px] font-semibold"><Link href={`/disciplinas/${subjectId}` as Route} className="text-muted hover:text-brand">Limpar filtros</Link><Link href={`/perguntas/nova?disciplina=${subjectId}` as Route} className="text-accent hover:underline">Fazer pergunta</Link></div></div>}
  </div>;
}
