export default function LoadingSubjects() {
  return <div aria-live="polite" className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8"><span className="sr-only">Carregando disciplinas</span><div className="h-7 w-64 animate-pulse rounded-md bg-[#e8ecf3]"/><div className="mt-6 h-20 animate-pulse rounded-lg bg-[#e8ecf3]"/><div className="mt-8 grid gap-3 md:grid-cols-2">{Array.from({length: 6}, (_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-[#e8ecf3]"/>)}</div></div>;
}
