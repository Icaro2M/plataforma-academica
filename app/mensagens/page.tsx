import Link from 'next/link';
import { MessageCircle, Plus, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getConversations } from '@/lib/store';

const dateLabel = (date: string | null) => date ? new Date(`${date}Z`).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

export default async function MessagesPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  const conversations = await getConversations(user.id);
  return <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Apoio acadêmico</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight"><MessageCircle className="text-accent" size={28}/> Conversas de estudo</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Converse com monitores e professores sobre uma disciplina. Use o chat para tirar dúvidas e combinar uma aula.</p></div>
      <Link href="/mensagens/nova" className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#2549bd]"><Plus size={16}/> Nova conversa</Link>
    </div>
    <section aria-label="Conversas de estudo" className="mt-7 overflow-hidden rounded-xl border border-line bg-white">
      {conversations.length ? <ul className="divide-y divide-line">{conversations.map(conversation => <li key={conversation.id} className={`relative ${conversation.unread_count ? 'bg-[#f7f9ff]' : ''}`}>
        <Link href={`/mensagens/${conversation.id}`} className="block p-4 transition-colors hover:bg-slate-50 md:px-5">
          {conversation.unread_count > 0 && <span aria-label={`${conversation.unread_count} mensagens não lidas`} className="absolute left-1.5 top-6 h-2 w-2 rounded-full bg-accent"/>}
          <div className="flex flex-wrap items-start gap-3 pl-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8edf6] text-xs font-black text-brand">{conversation.other_user_name.split(' ').slice(0,2).map(part => part[0]).join('').toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-ink">{conversation.other_user_name}</p>{conversation.other_user_verified > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal"><ShieldCheck size={13}/>{conversation.other_user_role === 'MONITOR' ? 'Monitor' : conversation.other_user_role === 'PROFESSOR' ? 'Professor' : 'Coordenação'}</span>}<span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${conversation.status === 'SCHEDULED' ? 'bg-[#e5f2ef] text-teal' : 'bg-slate-100 text-slate-600'}`}>{conversation.status === 'SCHEDULED' ? 'Aula combinada' : 'Em conversa'}</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-700">{conversation.title}</p><p className="mt-1 truncate text-xs text-slate-500">{conversation.subject_name} · {conversation.last_message || 'Conversa criada; aguarde a primeira mensagem.'}</p></div><time className="ml-auto text-[11px] text-slate-400" dateTime={conversation.last_message_at || conversation.updated_at}>{dateLabel(conversation.last_message_at || conversation.updated_at)}</time></div>
        </Link>
      </li>)}</ul> : <div className="p-10 text-center"><MessageCircle className="mx-auto text-slate-300" size={30}/><h2 className="mt-3 font-bold text-ink">Nenhuma conversa ainda</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Escolha um monitor ou professor, informe a disciplina e descreva o que está estudando.</p><Link href="/mensagens/nova" className="mt-4 inline-block text-sm font-bold text-teal">Iniciar conversa de estudo →</Link></div>}
    </section>
  </div>;
}
