'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createQuestion } from '@/app/actions';
import { AcademicEditor } from './academic-editor';

const draftKey = 'conecta-question-draft-v1';
type CourseOption = { id: number; name: string };
type SubjectOption = { id: number; course_id: number; name: string; course_name: string; institution_name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Publicando…' : 'Publicar pergunta'}</button>;
}

export function QuestionComposer({ courses, subjects, selectedSubject, error }: { courses: CourseOption[]; subjects: SubjectOption[]; selectedSubject: string; error?: string }) {
  const [title, setTitle] = useState('');
  const preselectedCourse = subjects.find(subject => String(subject.id) === selectedSubject)?.course_id;
  const [courseId, setCourseId] = useState(preselectedCourse ? String(preselectedCourse) : '');
  const [subjectId, setSubjectId] = useState(selectedSubject);
  const [body, setBody] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: { title?: string; subjectId?: string; body?: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null') as { title?: string; subjectId?: string; body?: string } | null;
    } catch { /* Rascunho inválido é ignorado. */ }
    const restoredDraft = saved;
    const timer = window.setTimeout(() => {
      if (restoredDraft) {
        setTitle(restoredDraft.title || '');
        const selected = subjects.find(subject => String(subject.id) === selectedSubject || String(subject.id) === restoredDraft.subjectId);
        setCourseId(selected ? String(selected.course_id) : '');
        setSubjectId(selectedSubject || restoredDraft.subjectId || '');
        setBody(restoredDraft.body || '');
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedSubject, subjects]);

  useEffect(() => {
    if (ready) sessionStorage.setItem(draftKey, JSON.stringify({ title, courseId, subjectId, body }));
  }, [title, courseId, subjectId, body, ready]);

  function discard() {
    sessionStorage.removeItem(draftKey);
    setTitle(''); setCourseId(preselectedCourse ? String(preselectedCourse) : ''); setSubjectId(selectedSubject); setBody('');
  }

  return <form action={createQuestion} className="mt-8 space-y-5 rounded-xl border border-line bg-white p-5 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">Escreva sua dúvida</p><span className="text-xs text-slate-500">Rascunho salvo neste navegador</span></div>
    <label htmlFor="question-title" className="block text-sm font-bold">Título</label>
    <input id="question-title" name="title" value={title} onChange={event => setTitle(event.target.value)} required minLength={12} maxLength={140} className="-mt-3 w-full rounded-lg border border-line p-3 font-normal" placeholder="Ex.: Como escolher os limites de uma integral dupla?" />
    <div className="-mt-3 text-right text-xs text-slate-500">{title.length} / 140 caracteres</div>
    <label htmlFor="question-course" className="block text-sm font-bold">Curso</label>
    <select id="question-course" name="courseId" required value={courseId} onChange={event => { setCourseId(event.target.value); setSubjectId(''); }} className="-mt-3 w-full rounded-lg border border-line bg-white p-3 font-normal"><option value="" disabled>Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
    <label htmlFor="question-subject" className="block text-sm font-bold">Disciplina</label>
    <select id="question-subject" name="subjectId" required disabled={!courseId} value={subjectId} onChange={event => setSubjectId(event.target.value)} className="-mt-3 w-full rounded-lg border border-line bg-white p-3 font-normal disabled:cursor-not-allowed disabled:bg-slate-50"><option value="" disabled>{courseId ? 'Selecione uma disciplina' : 'Selecione primeiro um curso'}</option>{subjects.filter(subject => String(subject.course_id) === courseId).map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
    <label htmlFor="question-body" className="block text-sm font-bold">Descrição</label>
    <div className="-mt-3"><AcademicEditor id="question-body" value={body} onChange={setBody} minLength={30} placeholder="Explique sua dúvida, o contexto da aula e o que você já tentou…" /></div>
    <p className="text-xs leading-5 text-slate-500">Uma triagem automática simples bloqueia linguagem ofensiva e sinaliza conteúdo possivelmente fora do contexto acadêmico para revisão.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-4"><SubmitButton/><button type="button" onClick={discard} className="text-sm font-semibold text-slate-500 hover:text-ink">Descartar rascunho</button></div>
  </form>;
}

export function ClearQuestionDraft() {
  useEffect(() => { sessionStorage.removeItem(draftKey); }, []);
  return null;
}
