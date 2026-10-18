import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { database, getUser, hashToken, one, type User } from './store';

const cookieName = 'academia_session';
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = one<{ user_id: string }>('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at > ?',hashToken(token),new Date().toISOString());
  const user = session ? getUser(session.user_id) : null;
  return user ? { ...user } : null;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  database().prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token),userId,new Date(Date.now()+7*86400000).toISOString());
  (await cookies()).set(cookieName,token,{ httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', path:'/', maxAge:7*86400 });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) database().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
  jar.delete(cookieName);
}
