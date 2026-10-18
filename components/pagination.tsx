import Link from 'next/link';
import type { Route } from 'next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, hrefForPage }: { page: number; totalPages: number; hrefForPage: (page: number) => Route }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Paginação" className="mt-5 flex items-center justify-between gap-3 text-xs">
    {page > 1 ? <Link href={hrefForPage(page - 1)} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink hover:border-accent"><ChevronLeft size={14}/> Anterior</Link> : <span/>}
    <span className="text-muted">Página <strong className="text-ink">{page}</strong> de {totalPages}</span>
    {page < totalPages ? <Link href={hrefForPage(page + 1)} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-2 font-semibold text-ink hover:border-accent">Próxima <ChevronRight size={14}/></Link> : <span/>}
  </nav>;
}
