import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

function hashPassword(password: string, email: string): string {
  return createHash('sha256').update(`${password}:${email}`).digest('hex');
}

// POST - Login
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { authorized: false, error: 'Email e senha são obrigatórios' },
        { status: 200 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedPassword = hashPassword(password, normalizedEmail);

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { authorized: false, error: 'Email ou senha incorretos' },
        { status: 200 }
      );
    }

    if (user.password !== hashedPassword) {
      return NextResponse.json(
        { authorized: false, error: 'Email ou senha incorretos' },
        { status: 200 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { authorized: false, error: 'Conta desativada' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      authorized: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json(
      { authorized: false, error: 'Erro interno do servidor' },
      { status: 200 }
    );
  }
}

// GET - Session Check
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ authorized: false }, { status: 200 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ authorized: false }, { status: 200 });
    }

    return NextResponse.json({
      authorized: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ authorized: false }, { status: 200 });
  }
}
