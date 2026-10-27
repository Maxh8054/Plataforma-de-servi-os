import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validatePassword, isCommonPassword } from '@/lib/password-strength';
import { auditLog } from '@/lib/audit-log';
import { emailProviderConfigured, hashSecret } from '@/lib/email';

const FIRST_ACCESS_RATE_MAX = 5;
const FIRST_ACCESS_RATE_WINDOW = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

/**
 * POST /api/auth/first-access
 * Define a senha de uma conta em primeiro acesso (isFirstAccess=true, sem senha).
 *
 * Segurança: contas SEM senha (cadastro aprovado pelo admin ou senha resetada)
 * exigem um CÓDIGO DE 6 DÍGITOS enviado por email — assim só quem tem acesso
 * ao email do usuário consegue definir a senha (proteção contra takeover).
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`first-access:${ip}`, FIRST_ACCESS_RATE_MAX, FIRST_ACCESS_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
    }

    const { email, password, code } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Senha fraca: ' + validation.errors.join(', ') }, { status: 400 });
    }
    if (isCommonPassword(password)) {
      return NextResponse.json({ error: 'Senha muito comum.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 });
    }

    if (!user.isFirstAccess) {
      return NextResponse.json({ error: 'Conta já configurada. Use a opção de recuperação de senha.' }, { status: 400 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Conta desativada.' }, { status: 403 });
    }

    // ===== Código de email obrigatório quando a conta não tem senha =====
    const needsCode = !user.password && emailProviderConfigured();
    if (needsCode) {
      const normalizedCode = String(code ?? '').replace(/\D/g, '');
      if (!normalizedCode) {
        return NextResponse.json(
          { error: 'Informe o código de 6 dígitos enviado por email.', codeRequired: true },
          { status: 400 }
        );
      }

      const challenge = await db.twoFactorChallenge.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!challenge) {
        return NextResponse.json(
          { error: 'Nenhum código válido. Solicite um novo código.', codeRequired: true, expired: true },
          { status: 400 }
        );
      }

      if (new Date(challenge.expiresAt) < new Date()) {
        await db.twoFactorChallenge.delete({ where: { id: challenge.id } });
        return NextResponse.json(
          { error: 'Código expirado. Solicite um novo código.', codeRequired: true, expired: true },
          { status: 400 }
        );
      }

      if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
        await db.twoFactorChallenge.delete({ where: { id: challenge.id } });
        return NextResponse.json(
          { error: 'Muitas tentativas incorretas. Solicite um novo código.', codeRequired: true, expired: true },
          { status: 429 }
        );
      }

      if (hashSecret(normalizedCode, user.id) !== challenge.codeHash) {
        await db.twoFactorChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        const left = MAX_CODE_ATTEMPTS - (challenge.attempts + 1);
        return NextResponse.json(
          {
            error:
              left > 0
                ? `Código incorreto. Restam ${left} tentativa(s).`
                : 'Código incorreto. Solicite um novo código.',
            codeRequired: true,
            expired: left <= 0,
          },
          { status: 401 }
        );
      }

      // Código correto → invalida o desafio
      await db.twoFactorChallenge.delete({ where: { id: challenge.id } });
    }

    const bcryptHash = await hash(password, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: bcryptHash,
        isFirstAccess: false,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    auditLog({
      action: 'first_access_password_set',
      userId: user.id,
      userEmail: user.email,
      userName: user.name ?? undefined,
      ip,
      details: needsCode ? 'Senha definida com código de email' : undefined,
    });

    return NextResponse.json({ success: true, message: 'Senha definida com sucesso! Agora faça login.' });
  } catch (error) {
    console.error('[first-access] falhou:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
