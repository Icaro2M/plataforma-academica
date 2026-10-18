'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Plus, Search } from 'lucide-react';

const sections: [string, string][] = [
  ['/perguntas/nova', 'Nova pergunta'], ['/perguntas/', 'Pergunta'],
  ['/disciplinas', 'Disciplinas'], ['/ranking', 'Ranking'],
  ['/notificacoes', 'Notificações'],
  ['/minha-atividade', 'Minha atividade'], ['/perfil', 'Meu perfil'],
  ['/pessoas/', 'Perfil'], ['/administracao', 'Administração'],
  ['/entrar', 'Entrar'], ['/cadastrar', 'Cadastrar'],
];

export function AppHeader() {
  const pathname = usePathname();
  const title = pathname === '/' ? 'Perguntas' : sections.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Comunidade';
  return <header className="flex min-h-[72px] items-center justify-between gap-2 border-b border-line bg-white px-3 sm:gap-3 sm:px-6 xl:px-10">
    <div className="hidden min-w-0 items-center gap-2 text-[13px] xl:flex"><span className="font-medium text-muted">Comunidade</span><ChevronRight className="text-[#bdc5d2]" size={15}/><span className="truncate font-semibold text-brand">{title}</span></div>
    <form action="/" className="relative w-0 min-w-0 max-w-lg flex-1" role="search"><label htmlFor="global-search" className="sr-only">Pesquisar em toda a comunidade</label><Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input id="global-search" name="busca" type="search" maxLength={100} className="h-9 min-w-0 w-full rounded-lg border border-line bg-[#fcfdff] pl-9 pr-3 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none" placeholder="Pesquisar perguntas e disciplinas"/></form>
    <Link href="/perguntas/nova" aria-label="Nova pergunta" className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent text-xs font-semibold text-white transition-colors hover:bg-[#2549bd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-auto sm:w-auto sm:px-3.5 sm:py-2.5"><Plus size={16} strokeWidth={2.2}/><span className="hidden sm:inline">Nova pergunta</span></Link>
  </header>;
}
