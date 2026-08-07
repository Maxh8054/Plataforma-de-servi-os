import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`check-email:${ip}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
    }

    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, role: true, isFirstAccess: true, isActive: true, lockedUntil: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    if (!user.isActive) {
      return NextResponse.json({ exists: true, disabled: true });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return NextResponse.json({ exists: true, locked: true });
    }

    return NextResponse.json({
      exists: true,
      isFirstAccess: user.isFirstAccess,
      name: user.name,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
