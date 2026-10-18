import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ProfileView } from '@/components/profile-view';
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{error?:string;success?:string}> }) { const user = await currentUser(); if (!user) redirect('/entrar'); return <ProfileView user={user} own {...await searchParams}/>; }
