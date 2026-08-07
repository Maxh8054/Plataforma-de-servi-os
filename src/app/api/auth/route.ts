import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { db } from '@/lib/db';

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
  // Fallback para SHA-256 legacy
  return hashPasswordSha256(password, email) === storedHash;
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

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
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

    if (!user.password) {
      return NextResponse.json(
        { authorized: false, error: 'Email ou senha incorretos' },
        { status: 200 }
      );
    }

    const isValid = await verifyPassword(password, normalizedEmail, user.password);

    if (!isValid) {
      // Incrementar tentativas de login
      await db.user.update({
        where: { id: user.id },
        data: { loginAttempts: { increment: 1 } },
      });
      return NextResponse.json(
        { authorized: false, error: 'Email ou senha incorretos' },
        { status: 200 }
      );
    }

    // Se a senha está em SHA-256, migrar para bcrypt
    if (!isBcryptHash(user.password)) {
      const bcryptHash = await hash(password, 10);
      await db.user.update({
        where: { id: user.id },
        data: {
          password: bcryptHash,
          loginAttempts: 0,
        },
      });
    } else {
      // Resetar tentativas de login
      await db.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0 },
      });
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