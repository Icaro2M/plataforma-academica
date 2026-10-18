'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';

const sections: [string, string][] = [
  ['/perguntas/nova', 'Nova pergunta'], ['/perguntas/', 'Pergunta'],
  ['/disciplinas', 'Disciplinas'], ['/ranking', 'Ranking'],
  ['/minha-atividade', 'Minha atividade'], ['/perfil', 'Meu perfil'],
  ['/pessoas/', 'Perfil'], ['/administracao', 'Administração'],
  ['/entrar', 'Entrar'], ['/cadastrar', 'Cadastrar'],
];

export function AppHeader() {
  const pathname = usePathname();
  const title = pathname === '/' ? 'Perguntas' : sections.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Comunidade';
  return <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-line bg-white px-5 sm:px-8 xl:px-10">
    <div className="flex min-w-0 items-center gap-2 text-[13px]"><span className="hidden font-medium text-muted sm:inline">Comunidade</span><ChevronRight className="hidden text-[#bdc5d2] sm:inline" size={15}/><span className="truncate font-semibold text-brand">{title}</span></div>
    <Link href="/perguntas/nova" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#2549bd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Plus size={16} strokeWidth={2.2}/><span className="hidden min-[400px]:inline">Nova pergunta</span><span className="min-[400px]:hidden">Perguntar</span></Link>
  </header>;
}
