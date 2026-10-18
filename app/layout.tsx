import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { AppHeader } from '@/components/app-header';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Conecta. | Comunidade acadêmica', description: 'Perguntas e respostas para aprender em comunidade.' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return <html lang="pt-BR"><body><div className="min-h-screen lg:flex"><Sidebar user={user}/><div className="min-w-0 flex-1"><AppHeader/><main id="conteudo" className="min-w-0">{children}</main></div></div></body></html>;
}
