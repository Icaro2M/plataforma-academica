import Link from 'next/link';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { all, getUserStats, type User } from '@/lib/store';
import { requestRole } from '@/app/actions';

type SubjectActivity = { id: number; name: string; code: string; course_name: string; questions: number; answers: number };
type RecentQuestion = { id: string; title: string; subject_name: string; status: string; created_at: string };
type RecentAnswer = { question_id: string; title: string; subject_name: string; accepted: number; created_at: string };
type RoleRequest = { requested_role: string; status: string; created_at: string };
const dateLabel = (date: string) => new Date(`${date}Z`).toLocaleDateString('pt-BR');

export function ProfileView({ user, own = false, error, success }: { user: User; own?: boolean; error?: string; success?: string }) {
  const stats = getUserStats(user.id);
  const subjects = all<SubjectActivity>(`SELECT s.id,s.name,s.code,c.name course_name,
    (SELECT count(*) FROM questions q WHERE q.subject_id=s.id AND q.author_id=? AND q.status IN ('OPEN','RESOLVED')) questions,
    (SELECT count(*) FROM answers a JOIN questions q ON q.id=a.question_id WHERE q.subject_id=s.id AND a.author_id=? AND a.status='APPROVED') answers
    FROM subjects s JOIN courses c ON c.id=s.course_id WHERE questions>0 OR answers>0 ORDER BY answers DESC,questions DESC,s.name`, user.id, user.id);
  const questions = all<RecentQuestion>(`SELECT q.id,q.title,s.name subject_name,q.status,q.created_at FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE q.author_id=? AND q.status IN ('OPEN','RESOLVED') ORDER BY q.created_at DESC LIMIT 4`, user.id);
  const answers = all<RecentAnswer>(`SELECT a.question_id,q.title,s.name subject_name,(q.accepted_answer_id=a.id) accepted,a.created_at FROM answers a JOIN questions q ON q.id=a.question_id JOIN subjects s ON s.id=q.subject_id WHERE a.author_id=? AND a.status='APPROVED' AND q.status IN ('OPEN','RESOLVED') ORDER BY a.created_at DESC LIMIT 4`, user.id);
  const roleRequest = own ? all<RoleRequest>('SELECT requested_role,status,created_at FROM role_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1', user.id)[0] : undefined;
  const role = user.role === 'MONITOR' ? 'Monitor' : user.role === 'PROFESSOR' ? 'Professor' : user.role === 'ADMIN' ? 'Coordenação' : 'Aluno';
  return <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">{success}</p>}
    <p className="text-xs font-bold uppercase tracking-[.16em] text-coral">{own ? 'Meu perfil' : 'Perfil acadêmico'}</p>
    <section className="mt-4 rounded-xl border border-line bg-white p-5 md:p-7" aria-label="Identidade acadêmica">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#e8edf6] text-lg font-black text-ink">{user.name.split(' ').slice(0,2).map(part => part[0]).join('').toUpperCase()}</span>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-black tracking-tight md:text-3xl">{user.name}</h1><p className="mt-1 text-sm text-slate-500">{user.course_name || 'Curso não informado'} · {user.institution_name || 'Instituição não informada'}</p></div>
        <span className={`inline-flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold sm:ml-auto sm:w-auto ${user.verified ? 'bg-[#e5f2ef] text-teal' : 'bg-slate-100 text-slate-600'}`}>{Boolean(user.verified) && <ShieldCheck size={15}/>} {role}{user.verified && user.role !== 'ADMIN' ? ' verificado' : ''}</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-5">{[['Perguntas',stats.questions],['Respostas',stats.answers],['Recebidas',stats.received],['Soluções',stats.accepted],['Votos úteis',stats.useful]].map(([label,count]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-3"><p className="text-2xl font-black text-ink">{count}</p><p className="text-xs text-slate-500">{label}</p></div>)}</div>
    </section>
    <section className="mt-7 rounded-xl border border-line bg-white p-5 md:p-6" aria-labelledby="profile-subjects"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="profile-subjects" className="text-lg font-black">Disciplinas em que participa</h2><span className="text-xs text-slate-500">{subjects.length} {subjects.length === 1 ? 'disciplina' : 'disciplinas'}</span></div>
      {subjects.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{subjects.map(subject => <Link key={subject.id} href={`/disciplinas/${subject.id}`} className="rounded-lg border border-line p-3 hover:border-teal"><p className="font-bold">{subject.name} <span className="text-xs font-normal text-slate-500">{subject.code}</span></p><p className="mt-1 text-xs text-slate-500">{subject.course_name} · {subject.questions} {subject.questions === 1 ? 'pergunta' : 'perguntas'} · {subject.answers} {subject.answers === 1 ? 'resposta' : 'respostas'}</p></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">A participação em disciplinas aparece aqui após publicar perguntas ou respostas aprovadas.</p>}
    </section>
    <div className="mt-7 grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="profile-questions"><h2 id="profile-questions" className="text-lg font-black">Perguntas recentes</h2>{questions.length ? <ul className="mt-3 divide-y divide-line">{questions.map(question => <li key={question.id} className="py-3"><Link href={`/perguntas/${question.id}`} className="text-sm font-semibold hover:text-teal">{question.title}</Link><p className="mt-1 text-xs text-slate-500">{question.subject_name} · {dateLabel(question.created_at)}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nenhuma pergunta publicada ainda.</p>}</section>
      <section className="rounded-xl border border-line bg-white p-5" aria-labelledby="profile-answers"><h2 id="profile-answers" className="text-lg font-black">Respostas recentes</h2>{answers.length ? <ul className="mt-3 divide-y divide-line">{answers.map((answer,index) => <li key={`${answer.question_id}-${index}`} className="py-3"><Link href={`/perguntas/${answer.question_id}`} className="text-sm font-semibold hover:text-teal">{answer.title}</Link><p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">{answer.subject_name} · {dateLabel(answer.created_at)} {Boolean(answer.accepted) && <span className="inline-flex items-center gap-1 font-bold text-teal"><CheckCircle2 size={12}/> Solução aceita</span>}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nenhuma resposta aprovada ainda.</p>}</section>
    </div>
    {own && user.role === 'STUDENT' && <section className="mt-7 rounded-xl border border-line bg-white p-5 md:p-6" aria-labelledby="profile-verification"><h2 id="profile-verification" className="text-lg font-black">Verificação acadêmica</h2><p className="mt-1 text-sm text-slate-500">Monitores e professores são confirmados pela coordenação. Você pode continuar perguntando e respondendo enquanto aguarda.</p>
      {roleRequest?.status === 'PENDING' ? <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Solicitação para {roleRequest.requested_role === 'MONITOR' ? 'monitor' : 'professor'} em análise desde {dateLabel(roleRequest.created_at)}.</p> : <>{roleRequest?.status === 'REJECTED' && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Sua última solicitação não foi aprovada. Você pode enviar outra com os dados atualizados.</p>}<form action={requestRole} className="mt-4 grid gap-3"><label className="text-sm font-bold" htmlFor="requested-role">Papel solicitado</label><select id="requested-role" name="role" className="rounded-lg border border-line bg-white p-3 text-sm"><option value="MONITOR">Monitor</option><option value="PROFESSOR">Professor</option></select><label className="text-sm font-bold" htmlFor="verification-details">Vínculo institucional</label><textarea id="verification-details" name="details" required minLength={15} maxLength={500} className="min-h-24 rounded-lg border border-line p-3 text-sm" placeholder="Informe seu vínculo e um contato institucional para conferência manual."/><button className="w-fit rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white">Enviar para verificação</button></form></>}
    </section>}
    {own && <Link href="/minha-atividade" className="mt-6 inline-block text-sm font-bold text-teal">Ver toda minha atividade →</Link>}
  </div>;
}
