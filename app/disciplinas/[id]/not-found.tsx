import Link from 'next/link';
import { BookOpenText } from 'lucide-react';

export default function SubjectNotFound() {
  return <div className="mx-auto max-w-3xl px-5 py-16 text-center"><BookOpenText size={28} className="mx-auto text-[#9aa9be]"/><h1 className="mt-3 font-display text-xl font-bold text-brand">Disciplina não encontrada</h1><p className="mt-2 text-sm text-muted">Ela pode ter sido removida ou o endereço está incorreto.</p><Link href="/disciplinas" className="mt-5 inline-block rounded-md bg-brand px-4 py-2 text-xs font-semibold text-white">Voltar ao catálogo</Link></div>;
}
