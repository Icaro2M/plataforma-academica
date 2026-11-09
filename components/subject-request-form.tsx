'use client';

import { useFormStatus } from 'react-dom';
import { requestSubject } from '@/app/actions';

type Course = { id: number; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-md bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{pending ? 'Enviando…' : 'Solicitar disciplina'}</button>;
}

export function SubjectRequestForm({ courses, requests }: { courses: Course[]; requests: { id: string; name: string; course_name?: string; status: string; review_reason: string | null }[] }) {
  return <section className="mt-7 rounded-lg border border-[#cdd9f1] bg-[#f7faff] p-5" aria-labelledby="request-subject-title">
    <h2 id="request-subject-title" className="font-display text-[17px] font-bold text-brand">Não encontrou sua disciplina?</h2>
    <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted">Envie uma solicitação para a coordenação. Ela ficará vinculada ao curso escolhido e será analisada antes de entrar no catálogo.</p>
    <form action={requestSubject} className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-[11px] font-semibold text-[#526178]">Curso
        <select name="courseId" required defaultValue="" className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink"><option value="" disabled>Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
      </label>
      <label className="text-[11px] font-semibold text-[#526178]">Nome da disciplina
        <input name="name" required minLength={3} maxLength={120} className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink" placeholder="Ex.: Redes de Computadores" />
      </label>
      <label className="text-[11px] font-semibold text-[#526178]">Código (opcional)
        <input name="code" maxLength={30} className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink" placeholder="Ex.: CC301" />
      </label>
      <label className="text-[11px] font-semibold text-[#526178]">Justificativa (opcional)
        <input name="justification" maxLength={600} className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] text-ink" placeholder="Turma, semestre ou contexto" />
      </label>
      <div className="md:col-span-2"><SubmitButton /></div>
    </form>
    {requests.length > 0 && <div className="mt-5 border-t border-[#dbe5f5] pt-4"><h3 className="text-[11px] font-bold uppercase tracking-[.1em] text-[#526178]">Suas solicitações</h3><ul className="mt-2 space-y-2">{requests.map(request => <li key={request.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600"><span className="font-semibold text-ink">{request.name}</span>{request.course_name && <span>· {request.course_name}</span>}<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : request.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{request.status === 'APPROVED' ? 'Aprovada' : request.status === 'REJECTED' ? 'Não aprovada' : 'Em análise'}</span>{request.review_reason && <span className="text-muted">· {request.review_reason}</span>}</li>)}</ul></div>}
  </section>;
}
