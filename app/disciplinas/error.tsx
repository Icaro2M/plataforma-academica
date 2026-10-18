'use client';

export default function SubjectsError({ reset }: { error: Error; reset: () => void }) {
  return <div className="mx-auto max-w-3xl px-5 py-16 text-center"><h1 className="font-display text-xl font-bold text-brand">Não foi possível carregar as disciplinas</h1><p className="mt-2 text-sm text-muted">Tente novamente. Se o problema continuar, reinicie o servidor local.</p><button onClick={reset} className="mt-5 rounded-md bg-brand px-4 py-2 text-xs font-semibold text-white">Tentar novamente</button></div>;
}
