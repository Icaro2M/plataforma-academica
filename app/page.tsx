import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, BookOpenText, Search, SlidersHorizontal } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { countQuestions, getQuestions, getSubjectCatalog, getSubjects, getUserStats } from '@/lib/store';
import { QuestionCard } from '@/components/question-card';
import { Pagination } from '@/components/pagination';

type Params = { busca?: string; disciplina?: string; estado?: string; pagina?: string };

export default async function ForumPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const filters = {
    busca: typeof raw.busca === 'string' ? raw.busca.slice(0, 100) : '',
    disciplina: typeof raw.disciplina === 'string' ? raw.disciplina : '',
    estado: raw.estado === 'unanswered' || raw.estado === 'resolved' ? raw.estado : '',
  };
  const user = await currentUser();
  const subjects = getSubjects();
  const questionFilters = { search: filters.busca, subjectId: Number(filters.disciplina) || undefined, status: filters.estado };
  const totalQuestions = countQuestions(questionFilters);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));
  const requestedPage = Number.parseInt(typeof raw.pagina === 'string' ? raw.pagina : '1', 10);
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const questions = getQuestions({ ...questionFilters, limit: pageSize, offset: (page - 1) * pageSize });
  const featuredSubjects = getSubjectCatalog().sort((a, b) => b.question_count - a.question_count);
  const stats = user ? getUserStats(user.id) : null;
  const hrefFor = (change: Partial<typeof filters>) => {
    const next = { ...filters, ...change };
    const params = new URLSearchParams();
    if (next.busca) params.set('busca', next.busca);
    if (next.disciplina) params.set('disciplina', next.disciplina);
    if (next.estado) params.set('estado', next.estado);
    return `/${params.size ? `?${params}` : ''}` as Route;
  };
  const hrefForPage = (target: number) => {
    const params = new URLSearchParams();
    if (filters.busca) params.set('busca', filters.busca);
    if (filters.disciplina) params.set('disciplina', filters.disciplina);
    if (filters.estado) params.set('estado', filters.estado);
    if (target > 1) params.set('pagina', String(target));
    return `/${params.size ? `?${params}` : ''}` as Route;
  };

  return <div className="mx-auto w-full max-w-[1240px] px-5 pb-12 pt-8 sm:px-8 xl:px-10">
    <div className="mb-7 flex items-end justify-between gap-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-accent">Comunidade acadêmica</p><h1 className="mt-2 font-display text-[26px] font-extrabold leading-[1.25] tracking-[-.055em] text-ink sm:text-[30px]">Perguntas da comunidade</h1><p className="mt-1.5 text-[13px] leading-5 text-muted">Encontre respostas e compartilhe o que você sabe.</p></div>
    </div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_252px]">
      <div className="min-w-0">
        <form action="/" className="rounded-xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,.025)] sm:p-4">
          {filters.estado && <input type="hidden" name="estado" value={filters.estado}/>}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar perguntas</span><Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8090a7]" size={17}/><input name="busca" type="search" defaultValue={filters.busca} className="h-10 w-full rounded-lg border border-line bg-[#fcfdff] pl-10 pr-3 text-[13px] text-ink placeholder:text-[#8995a6] focus:border-accent focus:outline-none" placeholder="Buscar dúvidas, temas ou disciplinas"/></label>
            <label className="relative sm:w-[220px]"><span className="sr-only">Filtrar por disciplina</span><select name="disciplina" defaultValue={filters.disciplina} className="h-10 w-full appearance-none rounded-lg border border-line bg-[#fcfdff] pl-3 pr-9 text-[12px] text-[#3d4b60] focus:border-accent focus:outline-none"><option value="">Todas as disciplinas</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} · {s.course_name}</option>)}</select><SlidersHorizontal className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8390a3]" size={14}/></label>
            <button className="h-10 rounded-lg bg-brand px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#304e81]">Buscar</button>
          </div>
        </form>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-line">
          <nav aria-label="Filtrar perguntas por estado" className="flex gap-5 text-[12px] sm:gap-7">
            {([['', 'Recentes'], ['unanswered', 'Sem resposta'], ['resolved', 'Resolvidas']] as const).map(([status, label]) => <Link key={status} href={hrefFor({ estado: status })} aria-current={filters.estado === status ? 'page' : undefined} className={`-mb-px border-b-2 pb-3 font-semibold transition-colors ${filters.estado === status ? 'border-accent text-brand' : 'border-transparent text-muted hover:text-brand'}`}>{label}</Link>)}
          </nav>
          <span className="pb-3 text-[11px] text-muted">{totalQuestions} {totalQuestions === 1 ? 'pergunta' : 'perguntas'}</span>
        </div>
        {(filters.busca || filters.disciplina) && <div className="flex items-center gap-2 py-3 text-[11px] text-muted"><span>Filtros aplicados</span><Link href="/" className="font-semibold text-accent hover:underline">Limpar filtros</Link></div>}
        {questions.length ? <><section aria-label="Lista de perguntas" className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,.025)]">{questions.map(q => <QuestionCard key={q.id} question={q}/>)}</section><Pagination page={page} totalPages={totalPages} hrefForPage={hrefForPage}/></> : <div className="rounded-xl border border-line bg-white px-6 py-12 text-center"><BookOpenText className="mx-auto text-[#a4afc0]" size={27}/><h2 className="mt-3 font-display text-[16px] font-bold text-brand">Nenhuma pergunta encontrada</h2><p className="mt-1 text-[13px] text-muted">Tente outra busca ou comece uma conversa.</p><div className="mt-4 flex justify-center gap-3 text-[12px] font-semibold"><Link href="/" className="text-muted hover:text-brand">Limpar filtros</Link><Link href="/perguntas/nova" className="text-accent hover:underline">Fazer pergunta →</Link></div></div>}
      </div>
      <aside aria-label="Informações da comunidade" className="space-y-4">
        <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.025)]"><div className="flex items-center justify-between"><h2 className="font-display text-[13px] font-bold text-brand">Disciplinas</h2><BookOpenText size={16} className="text-[#8a9ab2]"/></div><p className="mt-1 text-[11px] leading-4 text-muted">Explore dúvidas por área de estudo.</p><div className="mt-4 space-y-0.5">{featuredSubjects.slice(0, 5).map(subject => <Link key={subject.id} href={`/disciplinas/${subject.id}` as Route} className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-[12px] text-[#495a70] transition-colors hover:bg-[#f4f7fd] hover:text-accent"><span className="min-w-0 truncate">{subject.name}</span><ArrowRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"/></Link>)}</div><Link href="/disciplinas" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">Ver todas as disciplinas <ArrowRight size={13}/></Link></section>
        <section className="rounded-xl border border-line bg-[#f9fafc] p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted">{user ? 'Sua participação' : 'Participe da comunidade'}</p>{user ? <><div className="mt-3 flex gap-7"><div><strong className="font-display text-[23px] font-extrabold text-brand">{stats?.questions ?? 0}</strong><p className="text-[11px] text-muted">perguntas</p></div><div><strong className="font-display text-[23px] font-extrabold text-brand">{stats?.answers ?? 0}</strong><p className="text-[11px] text-muted">respostas</p></div></div><Link href="/minha-atividade" className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">Ver minha atividade <ArrowRight size={13}/></Link></> : <><p className="mt-2 text-[12px] leading-[1.6] text-[#536178]">Entre para perguntar, responder e acompanhar suas contribuições.</p><Link href="/entrar" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">Entrar ou cadastrar <ArrowRight size={13}/></Link></>}</section>
      </aside>
    </div>
    <p className="mt-8 text-[10px] text-[#8a96a8]">Projeto acadêmico de demonstração, sem vínculo oficial com as instituições citadas.</p>
  </div>;
}
