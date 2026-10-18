'use client';

import { AlertCircle } from 'lucide-react';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-xl px-5 py-16 text-center" role="alert"><AlertCircle className="mx-auto text-coral" size={32}/><h1 className="mt-4 text-2xl font-black text-ink">Não foi possível carregar esta página</h1><p className="mt-2 text-sm text-slate-500">Tente novamente. Se o problema continuar, volte à página inicial e refaça o caminho.</p><button onClick={reset} className="mt-5 rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white">Tentar novamente</button></div>;
}
