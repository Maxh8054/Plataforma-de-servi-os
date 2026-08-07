import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validatePassword, isCommonPassword } from '@/lib/password-strength';
import { auditLog } from '@/lib/audit-log';

const FORGOT_RATE_MAX = 5;
const FORGOT_RATE_WINDOW = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`forgot:${ip}`, FORGOT_RATE_MAX, FORGOT_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas solicitações. Aguarde.' }, { status: 429 });
    }

    const { email, newPassword } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    if (!newPassword) return NextResponse.json({ error: 'Nova senha é obrigatória' }, { status: 400 });

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Senha fraca: ' + validation.errors.join(', ') }, { status: 400 });
    }
    if (isCommonPassword(newPassword)) {
      return NextResponse.json({ error: 'Senha muito comum.' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      auditLog({ action: 'password_request', userEmail: email, ip, details: 'User not found' });
      return NextResponse.json({ message: 'Se o email estiver cadastrado, solicitação enviada.' });
    }

    const existingPending = await db.passwordResetRequest.findFirst({
      where: { userId: user.id, status: 'pending' },
    });
    if (existingPending) {
      return NextResponse.json({ message: 'Solicitação pendente. Aguarde aprovação.', alreadyRequested: true });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // FIX C3: Não salvar senha em texto puro no banco
    await db.passwordResetRequest.create({
      data: {
        userId: user.id,
        newGeneratedPassword: hashedPassword,
        // desiredPassword NÃO é mais armazenado
        status: 'pending',
      },
    });

    auditLog({ action: 'password_request', userId: user.id, userEmail: user.email, userName: user.name, ip });
    return NextResponse.json({ message: 'Solicitação enviada! Aguarde aprovação.', requested: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
