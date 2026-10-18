import Link from 'next/link';
import { Medal, ShieldCheck } from 'lucide-react';
import { getInstitutions, getRanking } from '@/lib/store';

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ instituicao?: string }> }) {
  const { instituicao } = await searchParams;
  const institutions = getInstitutions();
  const institutionId = institutions.find(item => String(item.id) === instituicao)?.id;
  const people = getRanking(institutionId);
  return <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Comunidade</p>
    <h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight"><Medal size={28} className="shrink-0 text-coral"/> Ranking de quem ajuda</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Monitores e professores verificados, classificados pelas contribuições aprovadas. Cada resposta soma 2 pontos, uma solução aceita soma mais 10 e um voto útil soma 1.</p>
    <form action="/ranking" className="mt-7 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4"><label htmlFor="ranking-institution" className="min-w-0 flex-1 text-sm font-bold">Instituição<select id="ranking-institution" name="instituicao" defaultValue={institutionId || ''} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 font-normal"><option value="">Todas as instituições</option>{institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white">Filtrar</button></form>
    <div className="mt-7 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-black">Classificação</h2><span className="text-xs text-slate-500">{people.length} {people.length === 1 ? 'participante' : 'participantes'} verificados</span></div>
    <section aria-label="Classificação de monitores e professores" className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
      {people.length ? <ol className="divide-y divide-line">{people.map((person,index) => <li key={person.id}><Link href={`/pessoas/${person.id}`} className="grid gap-3 p-4 hover:bg-slate-50 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 md:px-5">
        <span aria-label={`${index + 1}ª posição`} className={`grid h-8 w-8 place-items-center rounded-md text-sm font-black ${index < 3 ? 'bg-[#e8edf6] text-brand' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
        <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-bold text-ink">{person.name}<span className="inline-flex items-center gap-1 rounded-md bg-[#e5f2ef] px-2 py-0.5 text-[10px] font-bold text-teal"><ShieldCheck size={12}/>{person.role === 'MONITOR' ? 'Monitor' : 'Professor'} verificado</span></p><p className="mt-1 text-xs text-slate-500">{person.institution_name}</p></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs sm:block sm:border-0 sm:pt-0 sm:text-right"><strong className="text-sm text-teal">{person.points} pontos</strong><span className="text-slate-500 sm:mt-1 sm:block">{person.answers} respostas · {person.accepted} soluções · {person.useful} úteis</span></div>
      </Link></li>)}</ol> : <div className="p-8 text-center"><Medal className="mx-auto text-slate-300" size={28}/><p className="mt-3 font-bold">Nenhum participante verificado neste filtro</p><p className="mt-1 text-sm text-slate-500">Quando a coordenação verificar monitores ou professores, eles aparecerão aqui.</p>{institutionId && <Link href="/ranking" className="mt-3 inline-block text-sm font-bold text-teal">Ver todas as instituições →</Link>}</div>}
    </section>
    <p className="mt-4 text-xs leading-5 text-slate-500">A posição usa a pontuação calculada no banco. Em empate, vence quem tem mais respostas; depois, a ordem é alfabética. São exibidos até 50 participantes.</p>
  </div>;
}
