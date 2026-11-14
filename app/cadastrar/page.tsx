import Link from 'next/link';
import { redirect } from 'next/navigation';
import { register } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { getCourses, getInstitutions } from '@/lib/store';
import { InstitutionCourseFields } from '@/components/institution-course-fields';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  const [institutions, courses] = await Promise.all([getInstitutions(), getCourses()]);
  return <div className="mx-auto max-w-xl px-5 py-12"><p className="text-xs font-bold uppercase tracking-[.2em] text-coral">Participe</p><h1 className="mt-2 text-3xl font-black">Criar conta</h1><p className="mt-2 text-sm text-slate-500">Comece como aluno. A coordenação pode verificar seu vínculo como monitor ou professor.</p><form action={register} className="mt-7 grid gap-4 rounded-lg border border-line bg-white p-6"><label className="text-sm font-bold">Nome<input name="name" required minLength={3} className="mt-2 w-full rounded-lg border border-line p-3 font-normal"/></label><label className="text-sm font-bold">E-mail<input name="email" type="email" required className="mt-2 w-full rounded-lg border border-line p-3 font-normal"/></label><label className="text-sm font-bold">Senha (mínimo 8 caracteres)<input name="password" type="password" required minLength={8} className="mt-2 w-full rounded-lg border border-line p-3 font-normal"/></label><InstitutionCourseFields institutions={institutions.map(({ id, name, acronym }) => ({ id, name, acronym }))} courses={courses.map(({ id, institution_id, name }) => ({ id, institution_id, name }))}/>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="rounded-lg bg-ink p-3 text-sm font-bold text-white">Criar conta</button></form><p className="mt-5 text-sm">Já tem conta? <Link href="/entrar" className="font-bold text-teal">Entrar</Link></p></div>;
}
