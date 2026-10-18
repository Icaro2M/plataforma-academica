import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { getNotifications } from '@/lib/store';

const dateLabel = (date: string) => new Date(`${date}Z`).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const destination = (type: string, entityId: string | null) => (type === 'ROLE_REQUEST_REVIEWED' ? '/perfil' : entityId ? `/perguntas/${entityId}` : '/notificacoes') as Route;

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  const notifications = getNotifications(user.id);
  const unread = notifications.filter(item => !item.read_at).length;

  return <div className="mx-auto max-w-4xl px-5 py-8 md:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Sua comunidade</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight"><Bell className="text-accent" size={27}/> Notificações</h1><p className="mt-2 text-sm text-slate-500">Respostas, soluções e atualizações da coordenação ficam registradas aqui.</p></div>
      {unread > 0 && <form action={markAllNotificationsRead}><button className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink hover:border-ink"><CheckCheck size={15}/> Marcar todas como lidas</button></form>}
    </div>
    <section aria-label="Histórico de notificações" className="mt-7 overflow-hidden rounded-lg border border-line bg-white">
      {notifications.length ? <ul className="divide-y divide-line">{notifications.map(notification => {
        const href = destination(notification.type, notification.entity_id);
        return <li key={notification.id} className={`relative p-4 md:px-5 ${notification.read_at ? 'bg-white' : 'bg-[#f7f9ff]'}`}>
          {!notification.read_at && <span className="absolute left-1.5 top-6 h-2 w-2 rounded-full bg-accent" aria-label="Não lida"/>}
          <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
            <div className="min-w-0 flex-1"><p className="font-bold text-ink">{notification.title}</p>{notification.body && <p className="mt-1 text-sm leading-5 text-slate-600">{notification.body}</p>}<p className="mt-2 text-xs text-slate-500">{notification.actor_name ? `${notification.actor_name} · ` : ''}<time dateTime={notification.created_at}>{dateLabel(notification.created_at)}</time></p></div>
            {notification.read_at ? <Link href={href} className="text-xs font-bold text-teal">Abrir</Link> : <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id}/><input type="hidden" name="returnTo" value={href}/><button className="text-xs font-bold text-teal">Ler e abrir</button></form>}
          </div>
        </li>;
      })}</ul> : <div className="p-10 text-center"><Bell className="mx-auto text-slate-300" size={28}/><h2 className="mt-3 font-bold text-ink">Nenhuma notificação ainda</h2><p className="mt-1 text-sm text-slate-500">Quando alguém responder ou a coordenação revisar seu vínculo, a atualização aparecerá aqui.</p></div>}
    </section>
  </div>;
}
