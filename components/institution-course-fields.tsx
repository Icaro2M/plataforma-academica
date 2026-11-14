'use client';

import { useState } from 'react';

type InstitutionOption = { id: number; name: string; acronym: string | null };
type CourseOption = { id: number; institution_id: number; name: string };

/** Cadastro: escolhe a instituição primeiro e mostra só os cursos dela. O servidor confere a associação. */
export function InstitutionCourseFields({ institutions, courses }: { institutions: InstitutionOption[]; courses: CourseOption[] }) {
  const [institutionId, setInstitutionId] = useState('');
  const [courseId, setCourseId] = useState('');
  const available = courses.filter(course => String(course.institution_id) === institutionId);
  return <>
    <label className="text-sm font-bold">Instituição<select name="institutionId" required value={institutionId} onChange={event => { setInstitutionId(event.target.value); setCourseId(''); }} className="mt-2 w-full rounded-lg border border-line bg-white p-3 font-normal"><option value="" disabled>Selecione sua faculdade</option>{institutions.map(item => <option key={item.id} value={item.id}>{item.acronym ? `${item.acronym} · ${item.name}` : item.name}</option>)}</select></label>
    <label className="text-sm font-bold">Curso<select name="courseId" required disabled={!institutionId} value={courseId} onChange={event => setCourseId(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white p-3 font-normal disabled:cursor-not-allowed disabled:bg-slate-50"><option value="" disabled>{institutionId ? 'Selecione o curso' : 'Selecione primeiro a instituição'}</option>{available.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
    <p className="text-xs text-slate-500">Você verá as perguntas, disciplinas e orientadores da instituição escolhida.</p>
  </>;
}
