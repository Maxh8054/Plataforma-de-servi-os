import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { validatePassword, isCommonPassword } from '@/lib/password-strength';
import { auditLog } from '@/lib/audit-log';

const FIRST_ACCESS_RATE_MAX = 5;
const FIRST_ACCESS_RATE_WINDOW = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`first-access:${ip}`, FIRST_ACCESS_RATE_MAX, FIRST_ACCESS_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
    }

    const { email, password } = await request.json();
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

    const bcryptHash = await hash(password, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: bcryptHash,
        isFirstAccess: false,
      },
    });

    auditLog({ action: 'first_access_password_set', userId: user.id, userEmail: user.email, userName: user.name, ip });

    return NextResponse.json({ success: true, message: 'Senha definida com sucesso! Agora faça login.' });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
