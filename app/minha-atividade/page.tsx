import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, MessageCircle, MessageSquareText } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { all, getUserStats } from '@/lib/store';

type Activity = { id: string; question_id: string; title: string; subject_name: string; status: string; question_status: string; accepted: number; created_at: string };
const dateLabel = (date: string) => new Date(`${date}Z`).toLocaleDateString('pt-BR');
const statusLabel = (status: string) => status === 'PENDING' ? 'Em revisão' : status === 'RESOLVED' ? 'Resolvida' : status === 'REMOVED' ? 'Removida' : status === 'APPROVED' ? 'Publicada' : 'Aberta';

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ aba?: string; estado?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  const { aba, estado } = await searchParams;
  const activeTab = aba === 'respostas' ? 'respostas' : 'perguntas';
  const activeStatus = ['todos','publicados','revisao','resolvidos'].includes(estado || '') ? estado! : 'todos';
  const stats = getUserStats(user.id);
  const asked = all<Activity>(`SELECT q.id,q.id question_id,q.title,s.name subject_name,q.status,q.status question_status,(q.status='RESOLVED') accepted,q.created_at FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE q.author_id=? ORDER BY q.created_at DESC`, user.id);
  const answered = all<Activity>(`SELECT a.id,a.question_id,q.title,s.name subject_name,a.status,q.status question_status,(q.accepted_answer_id=a.id) accepted,a.created_at FROM answers a JOIN questions q ON q.id=a.question_id JOIN subjects s ON s.id=q.subject_id WHERE a.author_id=? ORDER BY a.created_at DESC`, user.id);
  const records = (activeTab === 'perguntas' ? asked : answered).filter(item => activeStatus === 'todos' || (activeStatus === 'revisao' && item.status === 'PENDING') || (activeStatus === 'publicados' && ['OPEN','APPROVED'].includes(item.status)) || (activeStatus === 'resolvidos' && Boolean(item.accepted)));
  const tabs = [{ id: 'perguntas', label: 'Minhas perguntas', count: asked.length, icon: MessageSquareText }, { id: 'respostas', label: 'Minhas respostas', count: answered.length, icon: MessageCircle }];
  const filters = [{ id: 'todos', label: 'Todos' }, { id: 'publicados', label: 'Publicados' }, { id: 'revisao', label: 'Em revisão' }, { id: 'resolvidos', label: 'Soluções' }];
  return <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">Minha participação</p><h1 className="mt-2 text-3xl font-black tracking-tight">Pergunto e respondo</h1><p className="mt-2 text-sm text-slate-500">Acompanhe suas dúvidas e as contribuições que você compartilhou.</p>
    <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Perguntas',stats.questions],['Respostas',stats.answers],['Recebidas',stats.received],['Soluções aceitas',stats.accepted]].map(([label,count]) => <div key={label} className="rounded-lg border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{count}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div>
    <nav className="mt-8 flex border-b border-line" aria-label="Tipo de atividade">{tabs.map(tab => <Link key={tab.id} href={`/minha-atividade?aba=${tab.id}`} aria-current={activeTab === tab.id ? 'page' : undefined} className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold ${activeTab === tab.id ? 'border-ink text-ink' : 'border-transparent text-slate-500 hover:text-ink'}`}><tab.icon size={16}/>{tab.label}<span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">{tab.count}</span></Link>)}</nav>
    <div className="my-4 flex flex-wrap gap-2" aria-label="Filtrar atividade">{filters.map(filter => <Link key={filter.id} href={`/minha-atividade?aba=${activeTab}&estado=${filter.id}`} aria-current={activeStatus === filter.id ? 'page' : undefined} className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${activeStatus === filter.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-slate-600 hover:border-ink'}`}>{filter.label}</Link>)}</div>
    <section aria-label={activeTab === 'perguntas' ? 'Histórico de perguntas' : 'Histórico de respostas'} className="overflow-hidden rounded-lg border border-line bg-white">
      {records.length ? <ul className="divide-y divide-line">{records.map(item => <li key={item.id} className="p-4 md:px-5"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1">{item.question_status === 'REMOVED' && activeTab === 'respostas' ? <span className="font-bold text-slate-500">{item.title}</span> : <Link href={`/perguntas/${item.question_id}`} className="font-bold hover:text-teal">{item.title}</Link>}<p className="mt-1 text-xs text-slate-500">{item.subject_name} · {dateLabel(item.created_at)}</p></div><span className={`rounded-md px-2 py-1 text-xs font-semibold ${item.status === 'PENDING' ? 'bg-amber-50 text-amber-800' : item.status === 'REMOVED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(item.status)}</span></div>{activeTab === 'respostas' && Boolean(item.accepted) && <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal"><CheckCircle2 size={13}/> Solução aceita</span>}</li>)}</ul> : <div className="p-8 text-center"><p className="font-bold text-ink">{activeStatus === 'todos' ? activeTab === 'perguntas' ? 'Você ainda não fez perguntas' : 'Você ainda não publicou respostas' : 'Nenhuma atividade neste filtro'}</p><p className="mt-2 text-sm text-slate-500">{activeStatus === 'todos' ? activeTab === 'perguntas' ? 'Comece por uma disciplina e conte o que você está tentando aprender.' : 'Encontre uma dúvida da sua área e compartilhe seu raciocínio.' : 'Experimente outro estado para ver seu histórico.'}</p><Link href={activeTab === 'perguntas' ? '/perguntas/nova' : '/?estado=unanswered'} className="mt-4 inline-block text-sm font-bold text-teal">{activeTab === 'perguntas' ? 'Fazer uma pergunta' : 'Ver dúvidas sem resposta'} →</Link></div>}
    </section>
  </div>;
}
