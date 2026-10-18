import { notFound } from 'next/navigation';
import { getUser } from '@/lib/store';
import { ProfileView } from '@/components/profile-view';
export default async function PublicProfilePage({ params }: { params: Promise<{id:string}> }) { const { id } = await params; const user = getUser(id); if (!user) notFound(); return <ProfileView user={user}/>; }
