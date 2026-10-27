import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { auditLog } from '@/lib/audit-log';
import { hashSecret } from '@/lib/email';

const MAX_2FA_ATTEMPTS = 5;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

/**
 * POST /api/auth/2fa/verify
 * Segunda etapa do login: valida o código de 6 dígitos e emite a sessão.
 * O challengeToken sozinho não vale nada — só com o código correto.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const rl = rateLimit(`2faverify:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { challengeToken, code } = await request.json();
    if (!challengeToken || !code) {
      return NextResponse.json({ error: 'Informe o código de verificação.' }, { status: 400 });
    }

    const normalizedCode = String(code).replace(/\D/g, '');
    const tokenHash = hashSecret(String(challengeToken), 'challenge');

    const challenge = await db.twoFactorChallenge.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Sessão de verificação inválida. Faça login novamente.', expired: true }, { status: 401 });
    }

    if (new Date(challenge.expiresAt) < new Date()) {
      await db.twoFactorChallenge.delete({ where: { id: challenge.id } });
      auditLog({ action: 'twofactor_code_failed', userId: challenge.userId, userEmail: challenge.user.email, ip, details: 'Código expirado' });
      return NextResponse.json({ error: 'Código expirado. Faça login novamente.', expired: true }, { status: 401 });
    }

    if (challenge.attempts >= MAX_2FA_ATTEMPTS) {
      await db.twoFactorChallenge.delete({ where: { id: challenge.id } });
      auditLog({
        action: 'twofactor_code_failed',
        userId: challenge.userId,
        userEmail: challenge.user.email,
        ip,
        details: `Excedeu ${MAX_2FA_ATTEMPTS} tentativas — desafio invalidado`,
      });
      return NextResponse.json({ error: 'Muitas tentativas incorretas. Faça login novamente.', expired: true }, { status: 429 });
    }

    if (hashSecret(normalizedCode, challenge.userId) !== challenge.codeHash) {
      await db.twoFactorChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      const left = MAX_2FA_ATTEMPTS - (challenge.attempts + 1);
      auditLog({
        action: 'twofactor_code_failed',
        userId: challenge.userId,
        userEmail: challenge.user.email,
        ip,
        details: `Código incorreto (tentativa ${challenge.attempts + 1}/${MAX_2FA_ATTEMPTS})`,
      });
      return NextResponse.json(
        {
          error:
            left > 0
              ? `Código incorreto. Restam ${left} tentativa(s).`
              : 'Código incorreto. Faça login novamente.',
          expired: left <= 0,
        },
        { status: 401 }
      );
    }

    // Código correto → invalida o desafio e emite a sessão
    await db.twoFactorChallenge.delete({ where: { id: challenge.id } });

    const user = challenge.user;
    const sessionToken = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

    await db.user.update({
      where: { id: user.id },
      data: { sessionToken, tokenExpiresAt, loginAttempts: 0, lockedUntil: null },
    });

    auditLog({ action: 'login_success', userId: user.id, userEmail: user.email, userName: user.name ?? undefined, ip, details: 'Login com 2FA' });

    try {
      const cookieStore = await import('next/headers').then((m) => m.cookies());
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
  } catch {
    return NextResponse.json({ error: 'Erro ao verificar o código' }, { status: 500 });
  }
}
