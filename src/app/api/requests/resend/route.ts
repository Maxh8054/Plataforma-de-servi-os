import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import { emailProviderConfigured, generateVerificationCode, hashSecret, sendVerificationEmail } from '@/lib/email';

/**
 * POST /api/requests/resend
 * Reenvia um novo código de verificação para uma solicitação ainda não verificada.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Máximo 3 reenvios por email a cada 15 min
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Informe o email.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const rl = rateLimit(`regresend:${ip}:${normalizedEmail}`, 3, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Muitos reenvios. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }

    if (!emailProviderConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Envio de email não configurado.' },
        { status: 503 }
      );
    }

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

    const payload = JSON.parse(req.data || '{}') as Record<string, unknown>;

    const code = generateVerificationCode();
    const newPayload = {
      ...payload,
      codeHash: hashSecret(code, normalizedEmail),
      codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      codeAttempts: 0,
    };

    const delivery = await sendVerificationEmail(normalizedEmail, code, 'registration');
    if (!delivery.sent && !delivery.simulated) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível reenviar o email. Tente novamente em instantes.' },
        { status: 502 }
      );
    }

    await db.request.update({
      where: { id: req.id },
      data: { data: JSON.stringify(newPayload) },
    });

    auditLog({
      action: 'registration_code_sent',
      userEmail: normalizedEmail,
      ip,
      details: delivery.simulated ? 'Reenvio — MODO SIMULADO' : 'Reenvio do código',
    });

    return NextResponse.json({ success: true, message: 'Novo código enviado para o seu email.' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao reenviar o código' },
      { status: 500 }
    );
  }
}
