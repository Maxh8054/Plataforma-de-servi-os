import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, validateSession, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';
import { auditLog } from '@/lib/audit-log';

export async function GET(request: Request) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

export async function POST(request: Request) {
  const token = await getSessionToken(request);
  let userName: string | null = null;
  if (token) {
    const user = await validateSession(token);
    if (user) userName = user.name;
  }
  if (!token) return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });

  await db.user.updateMany({ where: { sessionToken: token }, data: { sessionToken: null, tokenExpiresAt: null } });
  auditLog({ action: 'logout', userName });

  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true });
}
