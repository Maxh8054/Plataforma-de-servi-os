import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'zamine_session';
export const SESSION_MAX_AGE = 24 * 60 * 60;
export const AUTH_HEADER = 'x-zamine-token';

/**
 * Get session token from: Authorization header > cookie
 * Supports iframe contexts where cookies may be blocked
 */
export async function getSessionToken(request?: Request): Promise<string | null> {
  // 1. Try Authorization header (works in iframes)
  if (request) {
    const authHeader = request.headers.get(AUTH_HEADER);
    if (authHeader) return authHeader;
    // Also check standard Bearer header
    const bearer = request.headers.get('authorization');
    if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  }
  // 2. Fallback to cookie
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export function setSessionCookie(token: string): Record<string, string> {
  return { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${SESSION_MAX_AGE}` };
}

export function clearSessionCookie(): Record<string, string> {
  return { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0` };
}

export async function validateSession(token: string | null) {
  if (!token) return null;
  const user = await db.user.findUnique({
    where: { sessionToken: token },
    select: { id: true, name: true, email: true, role: true, tokenExpiresAt: true },
  });
  if (!user) return null;
  if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) < new Date()) {
    await db.user.update({ where: { id: user.id }, data: { sessionToken: null, tokenExpiresAt: null } });
    return null;
  }
  db.user.update({ where: { id: user.id }, data: { tokenExpiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) } }).catch(() => {});
  return user;
}

export async function requireAdmin(token: string | null) {
  const user = await validateSession(token);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: clearSessionCookie() });
}

export function forbidden(msg = 'Acesso restrito') {
  return NextResponse.json({ error: msg }, { status: 403 });
}
