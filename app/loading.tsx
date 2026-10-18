export default function AppLoading() {
  return <div className="mx-auto max-w-5xl animate-pulse px-5 py-8 md:px-10" aria-busy="true"><div className="h-3 w-32 rounded bg-slate-200"/><div className="mt-4 h-8 w-72 max-w-full rounded-md bg-slate-200"/><div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100"/><div className="mt-8 space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-lg border border-line bg-white"/>)}</div><span className="sr-only">Carregando conteúdo</span></div>;
}
