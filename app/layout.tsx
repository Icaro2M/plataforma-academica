import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';

export const metadata: Metadata = { title: 'Conecta Academia', description: 'Uma comunidade para aprender junto.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><div className="min-h-screen lg:flex"><Sidebar /><main className="min-w-0 flex-1">{children}</main></div></body></html>;
}
