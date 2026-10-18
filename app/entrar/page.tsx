import Link from 'next/link';
import { redirect } from 'next/navigation';
import { login } from '@/app/actions';
import { currentUser } from '@/lib/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  return <div className="mx-auto max-w-md px-5 py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-coral">Acesso à comunidade</p><h1 className="mt-2 text-3xl font-black">Entrar</h1><p className="mt-2 text-sm text-slate-500">Sua conta pode perguntar e responder. Monitores e professores recebem um selo após verificação.</p><form action={login} className="mt-7 space-y-4 rounded-3xl border border-line bg-white p-6"><label className="block text-sm font-bold">E-mail<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-line p-3 font-normal"/></label><label className="block text-sm font-bold">Senha<input name="password" type="password" required className="mt-2 w-full rounded-xl border border-line p-3 font-normal"/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="w-full rounded-xl bg-ink p-3 text-sm font-bold text-white">Entrar</button></form><p className="mt-5 text-sm">Ainda não tem conta? <Link href="/cadastrar" className="font-bold text-teal">Cadastre-se</Link></p>{(process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1') && <div className="mt-8 rounded-2xl border border-line bg-white p-5 text-sm"><p className="font-bold">Contas para apresentação</p><p className="mt-2 text-slate-600">aluna@demo.local · monitor@demo.local · professora@demo.local · admin@demo.local</p>{!process.env.DEMO_PASSWORD && <p className="mt-2 text-slate-600">Senha local: <strong>demo12345</strong></p>}<p className="mt-2 text-xs text-slate-400">Estas contas existem apenas no modo de demonstração.</p></div>}</div>;
}
