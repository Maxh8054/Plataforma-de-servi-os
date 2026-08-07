import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'crypto';
import { rateLimit, getClientIp, trackFailedLogin, isIpBlockedForBruteForce } from '@/lib/rate-limit';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { auditLog } from '@/lib/audit-log';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 10;
const LOGIN_RATE_WINDOW = 15 * 60 * 1000;

function hashPasswordSha256(password: string, email: string): string {
  return createHash('sha256').update(`${password}:${email}`).digest('hex');
}

function isBcryptHash(hashedPassword: string): boolean {
  return hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2a$');
}

async function verifyPassword(password: string, email: string, storedHash: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    return compare(password, storedHash);
  }
  return hashPasswordSha256(password, email) === storedHash;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (isIpBlockedForBruteForce(ip)) {
      auditLog({ action: 'brute_force_blocked', ip, details: 'IP blocked for trying too many different accounts' });
      return NextResponse.json({ error: 'Acesso temporariamente bloqueado.' }, { status: 429 });
    }

    const rl = rateLimit(`login:${ip}`, LOGIN_RATE_MAX, LOGIN_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      trackFailedLogin(ip, email);
      auditLog({ action: 'login_failed', userEmail: email, ip });
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return NextResponse.json({ error: 'Conta temporariamente bloqueada.', locked: true }, { status: 403 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Conta desativada.' }, { status: 403 });
    }

    // First access - user has no password yet
    if (user.isFirstAccess || !user.password) {
      return NextResponse.json({ error: 'first_access', isFirstAccess: true }, { status: 401 });
    }

    const isValid = await verifyPassword(password, normalizedEmail, user.password);
    if (!isValid) {
      const bruteResult = trackFailedLogin(ip, user.email);
      const newAttempts = user.loginAttempts + 1;
      const updateData: Record<string, unknown> = { loginAttempts: newAttempts };

      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        updateData.loginAttempts = 0;
        auditLog({ action: 'user_locked', userId: user.id, userEmail: user.email, userName: user.name, ip });
      } else {
        auditLog({ action: 'login_failed', userId: user.id, userEmail: user.email, userName: user.name, ip });
      }
      await db.user.update({ where: { id: user.id }, data: updateData });

      if (bruteResult.blocked) {
        return NextResponse.json({ error: 'Acesso temporariamente bloqueado.' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    const sessionToken = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

    // Migrate SHA-256 to bcrypt on successful login
    if (!isBcryptHash(user.password)) {
      const bcryptHash = await hash(password, 10);
      await db.user.update({
        where: { id: user.id },
        data: { sessionToken, tokenExpiresAt, loginAttempts: 0, lockedUntil: null, password: bcryptHash },
      });
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { sessionToken, tokenExpiresAt, loginAttempts: 0, lockedUntil: null },
      });
    }

    auditLog({ action: 'login_success', userId: user.id, userEmail: user.email, userName: user.name, ip });

    try {
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
    } catch {
      // Cookie setting may fail in some environments
    }

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: sessionToken,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
