'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestRole } from '@/app/actions';
import { formatCpf, validateVerification } from '@/lib/verification';

type CourseOption = { id: number; name: string };
type SubjectOption = { id: number; course_id: number; name: string; code: string };

const field = 'mt-1.5 w-full rounded-lg border border-line bg-white p-3 text-sm font-normal';
const label = 'text-sm font-bold';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="w-fit rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Enviando…' : 'Enviar para verificação'}</button>;
}

export function VerificationForm({ courses, subjects, defaultName, defaultCourseId }: { courses: CourseOption[]; subjects: SubjectOption[]; defaultName: string; defaultCourseId: number | null }) {
  const [role, setRole] = useState<'MONITOR' | 'PROFESSOR'>('MONITOR');
  const [cpf, setCpf] = useState('');
  const [courseId, setCourseId] = useState(courses.some(course => course.id === defaultCourseId) ? String(defaultCourseId) : '');
  const [subjectId, setSubjectId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const courseSubjects = subjects.filter(subject => String(subject.course_id) === courseId);

  // Validação antecipada no navegador; o servidor repete todas as regras.
  function check(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateVerification({ role, fullName: String(data.get('fullName') || ''), cpf, birthDate: String(data.get('birthDate') || ''), registration: String(data.get('registration') || ''), courseId, subjectId, notes: String(data.get('notes') || '') });
    if (!result.ok) { event.preventDefault(); setErrors(result.errors); } else setErrors([]);
  }

  return <form action={requestRole} onSubmit={check} noValidate className="mt-4 grid gap-4">
    <fieldset>
      <legend className={label}>Tipo de verificação</legend>
      <div className="mt-2 flex flex-wrap gap-2">{([['MONITOR', 'Monitor'], ['PROFESSOR', 'Professor']] as const).map(([valueOption, text]) => <label key={valueOption} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold ${role === valueOption ? 'border-accent bg-[#eef2fb] text-accent' : 'border-line text-slate-600'}`}><input type="radio" name="role" value={valueOption} checked={role === valueOption} onChange={() => setRole(valueOption)} className="sr-only"/>{text}</label>)}</div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>Nome completo<input name="fullName" required defaultValue={defaultName} autoComplete="name" maxLength={120} className={field} placeholder="Nome e sobrenome, como no documento"/></label>
      <label className={label}>CPF<input name="cpf" required inputMode="numeric" value={cpf} onChange={event => setCpf(formatCpf(event.target.value))} maxLength={14} className={field} placeholder="000.000.000-00"/></label>
      <label className={label}>Data de nascimento<input name="birthDate" type="date" required className={field}/></label>
      <label className={label}>Matrícula<input name="registration" required minLength={3} maxLength={30} className={`${field} uppercase`} placeholder="Ex.: 2023001234"/></label>
      <label className={label}>Curso<select name="courseId" required value={courseId} onChange={event => { setCourseId(event.target.value); setSubjectId(''); }} className={field}><option value="" disabled>Selecione o curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
      {role === 'MONITOR' && <label className={`${label} sm:col-span-2`}>Cadeira da monitoria<select name="subjectId" required disabled={!courseId} value={subjectId} onChange={event => setSubjectId(event.target.value)} className={`${field} disabled:cursor-not-allowed disabled:bg-slate-50`}><option value="" disabled>{courseId ? 'Selecione a disciplina' : 'Selecione primeiro o curso'}</option>{courseSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name} · {subject.code}</option>)}</select></label>}
      <label className={`${label} sm:col-span-2`}>Observações (opcional)<textarea name="notes" maxLength={500} className={`${field} min-h-20`} placeholder="Ex.: semestre da monitoria, professor orientador ou outro contato para conferência."/></label>
    </div>
    {errors.length > 0 && <ul role="alert" className="list-disc rounded-lg bg-red-50 p-3 pl-7 text-sm text-red-700">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <p className="text-xs leading-5 text-slate-500">Seus dados são usados apenas para conferir o vínculo com a instituição. O CPF não aparece no seu perfil público.</p>
    <SubmitButton/>
  </form>;
}
