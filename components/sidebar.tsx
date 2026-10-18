'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Bell, BookOpenText, House, LogOut, Medal, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { logout } from '@/app/actions';
import type { User } from '@/lib/store';

const mainLinks = [
  { href: '/', label: 'Perguntas', icon: House },
  { href: '/disciplinas', label: 'Disciplinas', icon: BookOpenText },
  { href: '/ranking', label: 'Ranking', icon: Medal },
] as const;

function NavContent({ user, unreadNotifications, onNavigate }: { user: User | null; unreadNotifications: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = [
    ...mainLinks,
    ...(user ? [{ href: '/minha-atividade', label: 'Minha atividade', icon: UserRound }] : []),
    ...(user ? [{ href: '/notificacoes', label: 'Notificações', icon: Bell }] : []),
    ...(user?.role === 'ADMIN' ? [{ href: '/administracao', label: 'Administração', icon: ShieldCheck }] : []),
  ];
  return <>
    <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.15em] text-muted">Navegação</p>
    <nav aria-label="Navegação principal" className="space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' || pathname.startsWith('/perguntas/') : pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href as Route} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${active ? 'bg-[#edf2ff] text-accent' : 'text-[#536178] hover:bg-[#f3f5f9] hover:text-ink'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.8}/><span>{label}</span>{href === '/notificacoes' && unreadNotifications > 0 && <span aria-label={`${unreadNotifications} notificações não lidas`} className="ml-auto min-w-5 rounded-full bg-coral px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</Link>;
      })}
    </nav>
    <div className="mx-3 mt-7 border-t border-line pt-5">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted">Sua conta</p>
      <Link href={user ? '/perfil' : '/entrar'} onClick={onNavigate} className={`mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${pathname === '/perfil' || pathname === '/entrar' ? 'bg-[#edf2ff] text-accent' : 'text-[#536178] hover:bg-[#f3f5f9] hover:text-ink'}`}><UserRound size={17} strokeWidth={1.8}/>{user ? 'Meu perfil' : 'Entrar ou cadastrar'}</Link>
    </div>
  </>;
}

function Brand() {
  return <Link href="/" aria-label="Conecta, página inicial" className="flex items-center gap-2.5"><span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand font-display text-[22px] font-extrabold leading-none tracking-[-.08em] text-white">c<span className="-ml-1 self-end pb-[7px] text-[14px] text-[#f1a06e]">.</span></span><span className="font-display text-[19px] font-extrabold tracking-[-.065em] text-brand">conecta<span className="text-warm">.</span></span></Link>;
}

export function Sidebar({ user, unreadNotifications = 0 }: { user: User | null; unreadNotifications?: number }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <>
    <div className="relative z-30 flex h-[64px] items-center justify-between border-b border-line bg-white px-5 lg:hidden">
      <Brand/>
      <button type="button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-brand hover:bg-cream">{open ? <X size={19}/> : <Menu size={19}/>}</button>
      {open && <div id="mobile-navigation" className="absolute left-3 right-3 top-[58px] rounded-xl border border-line bg-white p-3 shadow-[0_18px_42px_rgba(36,59,99,.15)]"><NavContent user={user} unreadNotifications={unreadNotifications} onNavigate={close}/>{user && <form action={logout} className="mx-3 mt-4 border-t border-line pt-3"><button className="flex items-center gap-2 py-2 text-xs font-semibold text-muted hover:text-ink"><LogOut size={15}/> Sair da conta</button></form>}</div>}
    </div>
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-white lg:flex">
      <div className="flex h-[72px] items-center border-b border-line px-6"><Brand/></div>
      <div className="flex-1 overflow-y-auto px-3"><NavContent user={user} unreadNotifications={unreadNotifications}/><div className="mx-3 mt-8 rounded-lg border border-line bg-[#fafbfc] px-3.5 py-3"><p className="text-[11px] font-semibold text-brand">Aprendizado em comunidade</p><p className="mt-1 text-[11px] leading-[1.5] text-muted">Perguntas organizadas por curso e disciplina.</p></div></div>
      <div className="border-t border-line px-5 py-4">{user ? <div className="flex items-center gap-2.5"><Link href="/perfil" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e8ecf6] text-[10px] font-bold text-brand">{user.name.slice(0,2).toUpperCase()}</Link><Link href="/perfil" className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{user.name}</span><span className="block truncate text-[11px] text-muted">{user.institution_name || (user.role === 'STUDENT' ? 'Aluno' : user.role === 'MONITOR' ? 'Monitor' : user.role === 'PROFESSOR' ? 'Professor' : 'Administrador')}</span></Link><form action={logout}><button title="Sair da conta" aria-label="Sair da conta" className="rounded-md p-1.5 text-muted hover:bg-cream hover:text-ink"><LogOut size={16}/></button></form></div> : <Link href="/entrar" className="flex items-center gap-2 text-xs font-semibold text-brand hover:text-accent"><UserRound size={17}/> Entre para participar</Link>}</div>
    </aside>
  </>;
}
