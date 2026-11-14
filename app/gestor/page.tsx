import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Download, FileSpreadsheet, UserMinus } from 'lucide-react';
import { endMonitorshipAction, importMonitorRoster, reviewRoleRequest } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { getCoursesForInstitution, getInstitutions, getManagedInstitutions, getSubjectsForInstitution } from '@/lib/store';
import { getMonitorsWithoutRoster, getPendingVerifications, getRoster } from '@/lib/monitors';
import { maskCpf } from '@/lib/verification';
import { VerificationRequestCard } from '@/components/verification-request-card';
import { RosterManualForm } from '@/components/roster-manual-form';

export default async function ManagerPage({ searchParams }: { searchParams: Promise<{ instituicao?: string; error?: string; success?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  // Acesso: gestor da instituição ou ADMIN. As Server Actions repetem a checagem.
  const allowed = user.role === 'ADMIN' ? await getInstitutions() : await getManagedInstitutions(user.id);
  if (!allowed.length) redirect('/');
  const { instituicao, error, success } = await searchParams;
  const institution = allowed.find(item => String(item.id) === instituicao) ?? allowed[0];
  const [roster, otherMonitors, requests, courses, subjects] = await Promise.all([
    getRoster(institution.id),
    getMonitorsWithoutRoster(institution.id),
    getPendingVerifications(institution.id, 'MONITOR'),
    getCoursesForInstitution(institution.id),
    getSubjectsForInstitution(institution.id),
  ]);
  const returnTo = `/gestor?instituicao=${institution.id}`;
  const endButton = (hidden: { rosterId?: string; userId?: string }, name: string) => <form action={endMonitorshipAction}><input type="hidden" name="institutionId" value={institution.id}/>{hidden.rosterId && <input type="hidden" name="rosterId" value={hidden.rosterId}/>}{hidden.userId && <input type="hidden" name="userId" value={hidden.userId}/>}<button aria-label={`Encerrar monitoria de ${name}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:border-red-300"><UserMinus size={13}/> Encerrar monitoria</button></form>;

  return <div className="mx-auto max-w-6xl px-5 py-10">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-coral">Gestor de monitoria</p>
    <h1 className="mt-2 text-3xl font-black">{institution.name}</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-500">Quem consta na planilha vira monitor verificado automaticamente: na importação (se já houver conta com o mesmo CPF ou e-mail), ao se cadastrar com o mesmo e-mail ou ao pedir verificação com o mesmo CPF e matrícula.</p>
    {allowed.length > 1 && <form action="/gestor" className="mt-4 flex flex-wrap items-center gap-2"><label htmlFor="manager-institution" className="text-sm font-bold">Instituição</label><select id="manager-institution" name="instituicao" defaultValue={institution.id} className="rounded-lg border border-line bg-white p-2 text-sm">{allowed.map(item => <option key={item.id} value={item.id}>{item.acronym || item.name}</option>)}</select><button className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold">Trocar</button></form>}
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-700">{success}</p>}

    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="import-title">
        <h2 id="import-title" className="flex items-center gap-2 font-black"><FileSpreadsheet size={18} className="text-teal"/> Importar planilha</h2>
        <p className="mt-1 text-sm text-slate-500">Arquivo .xlsx ou .csv (separador ; ou ,) com as colunas <strong>nome, cpf, nascimento, matricula, email, curso, disciplina</strong>. A disciplina pode ser o nome ou o código. Linhas já cadastradas são atualizadas.</p>
        <form action={importMonitorRoster} className="mt-4 flex flex-wrap items-center gap-3"><input type="hidden" name="institutionId" value={institution.id}/><input name="file" type="file" required accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Planilha de monitores" className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#eef2fb] file:px-3 file:py-2 file:text-xs file:font-bold file:text-accent"/><button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white">Importar</button></form>
        <a href="/gestor/modelo" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"><Download size={14}/> Baixar CSV modelo</a>
      </section>
      <section className="rounded-lg border border-line bg-white p-5" aria-labelledby="manual-title">
        <h2 id="manual-title" className="font-black">Cadastro manual</h2>
        <RosterManualForm institutionId={institution.id} courses={courses.map(({ id, name }) => ({ id, name }))} subjects={subjects.map(({ id, course_id, name, code }) => ({ id, course_id, name, code }))}/>
      </section>
    </div>

    <section className="mt-9" aria-labelledby="requests-title"><h2 id="requests-title" className="text-xl font-black">Pedidos de verificação pendentes ({requests.length})</h2>
      <div className="mt-4 space-y-3">{requests.length ? requests.map(request => <VerificationRequestCard key={request.id} request={request} returnTo={returnTo} action={reviewRoleRequest}/>) : <p className="rounded-lg bg-white p-5 text-sm text-slate-500">Nenhum pedido de monitoria aguardando análise.</p>}</div>
    </section>

    <section className="mt-9" aria-labelledby="roster-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="roster-title" className="text-xl font-black">Monitores da planilha ({roster.length})</h2><span className="text-xs text-slate-500">CPF mascarado para proteção dos dados</span></div>
      {roster.length ? <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">CPF</th><th className="p-3">Matrícula</th><th className="p-3">Curso · Disciplina</th><th className="p-3">Conta</th><th className="p-3"><span className="sr-only">Ações</span></th></tr></thead><tbody className="divide-y divide-line">{roster.map(row => <tr key={row.id}><td className="p-3 font-semibold">{row.full_name}{row.email && <span className="block text-xs font-normal text-slate-500">{row.email}</span>}</td><td className="p-3 font-mono text-xs">{maskCpf(row.cpf)}</td><td className="p-3 text-xs">{row.registration || '—'}</td><td className="p-3 text-xs">{row.course_name || '—'} · <strong>{row.subject_name}</strong> <span className="text-slate-400">{row.subject_code}</span></td><td className="p-3 text-xs">{row.linked_user_id ? <Link href={`/pessoas/${row.linked_user_id}` as Route} className="font-bold text-teal hover:underline">Verificado · {row.linked_user_name}</Link> : <span className="text-amber-700">Aguardando cadastro</span>}</td><td className="p-3">{endButton({ rosterId: row.id }, row.full_name)}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-lg bg-white p-5 text-sm text-slate-500">Nenhum monitor importado ainda.</p>}
    </section>

    {otherMonitors.length > 0 && <section className="mt-9" aria-labelledby="other-title"><h2 id="other-title" className="text-xl font-black">Monitores verificados fora da planilha ({otherMonitors.length})</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{otherMonitors.map(monitor => <div key={monitor.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4"><div className="min-w-0 flex-1"><Link href={`/pessoas/${monitor.id}` as Route} className="font-bold hover:text-teal">{monitor.name}</Link><p className="truncate text-xs text-slate-500">{monitor.email} · CPF {maskCpf(monitor.cpf)}</p><p className="mt-1 text-xs text-teal">{monitor.subjects || 'Sem disciplina vinculada'}</p></div>{endButton({ userId: monitor.id }, monitor.name)}</div>)}</div>
    </section>}
  </div>;
}
