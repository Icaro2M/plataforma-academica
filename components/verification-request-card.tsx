import { FileCheck2 } from 'lucide-react';
import type { PendingVerification } from '@/lib/monitors';
import { formatCpf } from '@/lib/verification';

const birthLabel = (iso: string | null) => iso ? iso.split('-').reverse().join('/') : '—';

/** Pedido de verificação com todos os dados informados e o selo "consta na planilha". */
export function VerificationRequestCard({ request, returnTo, action }: { request: PendingVerification; returnTo: string; action: (form: FormData) => Promise<void> }) {
  const rows: [string, string][] = [
    ['Nome completo', request.full_name || '—'],
    ['CPF', request.cpf ? formatCpf(request.cpf) : '—'],
    ['Nascimento', birthLabel(request.birth_date)],
    ['Matrícula', request.registration || '—'],
    ['Curso', request.course_name || '—'],
    ...(request.requested_role === 'MONITOR' ? [['Cadeira da monitoria', request.subject_name || '—'] as [string, string]] : []),
  ];
  return <div className="rounded-lg border border-line bg-white p-5">
    <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{request.user_name} · {request.requested_role === 'MONITOR' ? 'Monitor' : 'Professor'}</p>{Boolean(request.in_roster) && <span className="inline-flex items-center gap-1 rounded-md bg-[#e5f2ef] px-2 py-0.5 text-[11px] font-bold text-teal"><FileCheck2 size={13}/> Consta na planilha</span>}</div>
    <p className="mt-1 text-xs text-slate-500">{request.email}{request.institution_name ? ` · ${request.institution_name}` : ''} · enviado em {new Date(`${request.created_at}Z`).toLocaleDateString('pt-BR')}</p>
    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">{rows.map(([label, content]) => <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400">{label}</dt><dd className="text-slate-700">{content}</dd></div>)}</dl>
    {request.details && <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Observações:</span> {request.details}</p>}
    {!request.in_roster && <p className="mt-2 text-xs text-slate-400">Não consta na planilha: confira o vínculo pelos canais da instituição antes de aprovar.</p>}
    <div className="mt-4 flex gap-2">{([['APPROVE', 'Aprovar'], ['REJECT', 'Rejeitar']] as const).map(([decision, label]) => <form key={decision} action={action}><input type="hidden" name="requestId" value={request.id}/><input type="hidden" name="decision" value={decision}/><input type="hidden" name="returnTo" value={returnTo}/><button className={`rounded-lg px-3 py-2 text-xs font-bold ${decision === 'APPROVE' ? 'bg-teal text-white' : 'border border-line'}`}>{label}</button></form>)}</div>
  </div>;
}
