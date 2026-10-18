'use client';

import { useRef, useState } from 'react';
import { AcademicContent } from './academic-content';

type Props = { value: string; onChange: (value: string) => void; minLength: number; id: string; placeholder: string };

export function AcademicEditor({ value, onChange, minLength, id, placeholder }: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const field = useRef<HTMLTextAreaElement>(null);

  function insert(before: string, after = '', sample = 'texto') {
    const textarea = field.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = value.slice(start, end) || sample;
    const next = value.slice(0, start) + before + selection + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selection.length);
    });
  }

  return <div className="overflow-hidden rounded-xl border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50 px-3 py-2">
      <div className="flex gap-1" role="tablist" aria-label="Modo do editor">
        <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'write' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>Escrever</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'preview' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>Prévia</button>
      </div>
      <span className="text-xs text-slate-500">{value.length.toLocaleString('pt-BR')} / 10.000 caracteres</span>
    </div>
    {tab === 'write' ? <>
      <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2" aria-label="Formatação Markdown">
        <button type="button" onClick={() => insert('**', '**', 'destaque')} className="editor-tool" title="Negrito">Negrito</button>
        <button type="button" onClick={() => insert('*', '*', 'ênfase')} className="editor-tool" title="Itálico">Itálico</button>
        <button type="button" onClick={() => insert('- ', '', 'item')} className="editor-tool" title="Lista">Lista</button>
        <button type="button" onClick={() => insert('[', '](https://exemplo.com)', 'descrição')} className="editor-tool" title="Link">Link</button>
        <button type="button" onClick={() => insert('`', '`', 'código')} className="editor-tool" title="Código">Código</button>
        <button type="button" onClick={() => insert('$', '$', 'x^2')} className="editor-tool" title="Fórmula LaTeX">Fórmula</button>
      </div>
      <textarea ref={field} id={id} name="body" value={value} onChange={event => onChange(event.target.value)} required minLength={minLength} maxLength={10000} className="min-h-64 w-full resize-y border-0 p-4 text-sm leading-7 outline-none focus:outline-none" placeholder={placeholder} aria-describedby={`${id}-hint`} />
    </> : <div role="tabpanel" className="min-h-64 p-4">{value.trim() ? <AcademicContent>{value}</AcademicContent> : <p className="text-sm text-slate-500">A prévia aparece aqui enquanto você escreve.</p>}<input type="hidden" name="body" value={value}/></div>}
    <p id={`${id}-hint`} className="border-t border-line px-4 py-2 text-xs text-slate-500">Markdown, listas, links, blocos de código e fórmulas em $LaTeX$. Imagens externas não são exibidas.</p>
  </div>;
}
