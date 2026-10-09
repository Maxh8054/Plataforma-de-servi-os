import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import {
  emailProviderConfigured,
  generateChallengeToken,
  generateVerificationCode,
  hashSecret,
  sendVerificationEmail,
} from '@/lib/email';

/**
 * POST /api/auth/first-access/resend — Reenvia o código de primeiro acesso.
 * Resposta genérica de propósito (não revela se a conta existe/está configurada).
 * Rate limit: 3 por 10min por IP.
 */

const RESEND_RATE_MAX = 3;
const RESEND_RATE_WINDOW = 10 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

const GENERIC_MESSAGE = 'Se a conta estiver aguardando configuração, um novo código foi enviado.';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`fa-resend:${ip}`, RESEND_RATE_MAX, RESEND_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas solicitações. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.isActive || !user.isFirstAccess || !emailProviderConfigured()) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    const code = generateVerificationCode();
    await db.twoFactorChallenge.deleteMany({ where: { userId: user.id } });
    await db.twoFactorChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashSecret(generateChallengeToken(), 'challenge'),
        codeHash: hashSecret(code, user.id),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const delivery = await sendVerificationEmail(user.email, code, 'password-reset');

    auditLog({
      action: 'first_access_code_resent',
      userId: user.id,
      userEmail: user.email,
      userName: user.name ?? undefined,
      ip,
      details: delivery.sent ? undefined : 'Falha no envio do email',
    });

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE, emailSent: delivery.sent });
  } catch (err) {
    console.error('[first-access/resend] falhou:', err);
    return NextResponse.json({ error: 'Erro ao reenviar o código' }, { status: 500 });
  }
}
