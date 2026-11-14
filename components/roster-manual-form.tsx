'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addMonitorManually } from '@/app/actions';
import { formatCpf } from '@/lib/verification';

type CourseOption = { id: number; name: string };
type SubjectOption = { id: number; course_id: number; name: string; code: string };
const field = 'mt-1 w-full rounded-lg border border-line bg-white p-2.5 text-sm font-normal';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Salvando…' : 'Cadastrar monitor'}</button>;
}

/** Cadastro manual de uma linha da planilha. As regras são validadas na Server Action. */
export function RosterManualForm({ institutionId, courses, subjects }: { institutionId: number; courses: CourseOption[]; subjects: SubjectOption[] }) {
  const [cpf, setCpf] = useState('');
  const [courseId, setCourseId] = useState('');
  return <form action={addMonitorManually} className="mt-4 grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="institutionId" value={institutionId}/>
    <label className="text-xs font-bold sm:col-span-2">Nome completo<input name="fullName" required maxLength={120} className={field}/></label>
    <label className="text-xs font-bold">CPF<input name="cpf" required inputMode="numeric" value={cpf} onChange={event => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" className={field}/></label>
    <label className="text-xs font-bold">Nascimento<input name="birthDate" type="date" className={field}/></label>
    <label className="text-xs font-bold">Matrícula<input name="registration" maxLength={30} className={`${field} uppercase`}/></label>
    <label className="text-xs font-bold">E-mail<input name="email" type="email" className={field}/></label>
    <label className="text-xs font-bold">Curso<select name="courseId" required value={courseId} onChange={event => setCourseId(event.target.value)} className={field}><option value="" disabled>Selecione</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
    <label className="text-xs font-bold">Disciplina<select name="subjectId" required disabled={!courseId} defaultValue="" key={courseId} className={`${field} disabled:bg-slate-50`}><option value="" disabled>{courseId ? 'Selecione' : 'Escolha o curso'}</option>{subjects.filter(subject => String(subject.course_id) === courseId).map(subject => <option key={subject.id} value={subject.id}>{subject.name} · {subject.code}</option>)}</select></label>
    <div className="sm:col-span-2"><SubmitButton/></div>
  </form>;
}
