'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createQuestion } from '@/app/actions';
import { AcademicEditor } from './academic-editor';

const draftKey = 'conecta-question-draft-v1';
type SubjectOption = { id: number; name: string; course_name: string; institution_name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Publicando…' : 'Publicar pergunta'}</button>;
}

export function QuestionComposer({ subjects, selectedSubject, error }: { subjects: SubjectOption[]; selectedSubject: string; error?: string }) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(selectedSubject);
  const [body, setBody] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null') as { title?: string; subjectId?: string; body?: string } | null;
      if (saved) {
        setTitle(saved.title || '');
        setSubjectId(selectedSubject || saved.subjectId || '');
        setBody(saved.body || '');
      }
    } catch { /* Rascunho inválido é ignorado. */ }
    setReady(true);
  }, [selectedSubject]);

  useEffect(() => {
    if (ready) sessionStorage.setItem(draftKey, JSON.stringify({ title, subjectId, body }));
  }, [title, subjectId, body, ready]);

  function discard() {
    sessionStorage.removeItem(draftKey);
    setTitle(''); setSubjectId(selectedSubject); setBody('');
  }

  return <form action={createQuestion} className="mt-8 space-y-5 rounded-xl border border-line bg-white p-5 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">Escreva sua dúvida</p><span className="text-xs text-slate-500">Rascunho salvo neste navegador</span></div>
    <label htmlFor="question-title" className="block text-sm font-bold">Título</label>
    <input id="question-title" name="title" value={title} onChange={event => setTitle(event.target.value)} required minLength={12} maxLength={140} className="-mt-3 w-full rounded-lg border border-line p-3 font-normal" placeholder="Ex.: Como escolher os limites de uma integral dupla?" />
    <div className="-mt-3 text-right text-xs text-slate-500">{title.length} / 140 caracteres</div>
    <label htmlFor="question-subject" className="block text-sm font-bold">Disciplina</label>
    <select id="question-subject" name="subjectId" required value={subjectId} onChange={event => setSubjectId(event.target.value)} className="-mt-3 w-full rounded-lg border border-line bg-white p-3 font-normal"><option value="" disabled>Selecione uma disciplina</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.institution_name} · {subject.course_name} · {subject.name}</option>)}</select>
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
