import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import { hashSecret } from '@/lib/email';

const MAX_CODE_ATTEMPTS = 5;

/**
 * POST /api/requests/verify
 * Confirma o código de 6 dígitos enviado por email durante o cadastro.
 * Ao confirmar, a solicitação entra na fila de aprovação do administrador.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rl = rateLimit(`regverify:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }

    const { email, code } = await request.json();
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Informe o email e o código recebido.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedCode = String(code).replace(/\D/g, '');

    const req = await db.request.findFirst({
      where: { type: 'registration', email: normalizedEmail, status: 'unverified' },
      orderBy: { createdAt: 'desc' },
    });

    if (!req) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma solicitação aguardando verificação. Faça uma nova solicitação.' },
        { status: 404 }
      );
    }

    const payload = JSON.parse(req.data || '{}') as {
      name?: string;
      department?: string | null;
      codeHash?: string;
      codeExpiresAt?: string;
      codeAttempts?: number;
    };

    // Código expirado (10 min)
    if (!payload.codeHash || !payload.codeExpiresAt || new Date(payload.codeExpiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, expired: true, error: 'Código expirado. Clique em reenviar para receber um novo.' },
        { status: 400 }
      );
    }

    // Excedeu tentativas → invalida a solicitação
    if ((payload.codeAttempts ?? 0) >= MAX_CODE_ATTEMPTS) {
      await db.request.update({ where: { id: req.id }, data: { status: 'expired' } });
      auditLog({
        action: 'registration_code_failed',
        userEmail: normalizedEmail,
        ip,
        details: 'Excedeu o limite de tentativas do código',
      });
      return NextResponse.json(
        { success: false, error: 'Limite de tentativas excedido. Faça uma nova solicitação.' },
        { status: 429 }
      );
    }

    if (hashSecret(normalizedCode, normalizedEmail) !== payload.codeHash) {
      const attempts = (payload.codeAttempts ?? 0) + 1;
      await db.request.update({
        where: { id: req.id },
        data: { data: JSON.stringify({ ...payload, codeAttempts: attempts }) },
      });
      const left = MAX_CODE_ATTEMPTS - attempts;
      auditLog({
        action: 'registration_code_failed',
        userEmail: normalizedEmail,
        ip,
        details: `Código incorreto (tentativa ${attempts}/${MAX_CODE_ATTEMPTS})`,
      });
      return NextResponse.json(
        {
          success: false,
          error: left > 0 ? `Código incorreto. Restam ${left} tentativa(s).` : 'Código incorreto. Limite de tentativas excedido.',
        },
        { status: 400 }
      );
    }

    // Código correto → segue para aprovação do admin
    await db.request.update({
      where: { id: req.id },
      data: {
        status: 'pending',
        data: JSON.stringify({ name: payload.name ?? null, department: payload.department ?? null }),
      },
    });

    auditLog({ action: 'registration_code_verified', userEmail: normalizedEmail, ip, details: 'Email verificado com código' });

    return NextResponse.json({
      success: true,
      message: 'Email verificado! Sua solicitação foi enviada para aprovação do administrador.',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar o código' },
      { status: 500 }
    );
  }
}
