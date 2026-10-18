'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createAnswer } from '@/app/actions';
import { AcademicEditor } from './academic-editor';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? 'Publicando…' : 'Publicar resposta'}</button>;
}

export function AnswerComposer({ questionId, answered }: { questionId: string; answered: boolean }) {
  const key = `conecta-answer-draft-${questionId}`;
  const [body, setBody] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (answered) sessionStorage.removeItem(key);
    else setBody(sessionStorage.getItem(key) || '');
    setReady(true);
  }, [answered, key]);
  useEffect(() => { if (ready && !answered) sessionStorage.setItem(key, body); }, [body, ready, answered, key]);
  return <form action={createAnswer} className="mt-8 rounded-xl border border-line bg-white p-5 md:p-6">
    <input type="hidden" name="questionId" value={questionId}/>
    <label htmlFor="answer-body" className="mb-3 block text-sm font-bold">Sua resposta</label>
    <AcademicEditor id="answer-body" value={body} onChange={setBody} minLength={10} placeholder="Explique o raciocínio e ajude a comunidade…" />
    <div className="mt-4 flex flex-wrap items-center gap-4"><SubmitButton/><button type="button" onClick={() => { sessionStorage.removeItem(key); setBody(''); }} className="text-sm font-semibold text-slate-500">Descartar rascunho</button></div>
  </form>;
}
