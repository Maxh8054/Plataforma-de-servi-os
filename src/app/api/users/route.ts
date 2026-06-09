import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

const ADMIN_EMAIL = 'max-r@zaminebrasil.com';

function hashPassword(password: string, email: string): string {
  return createHash('sha256').update(`${password}:${email}`).digest('hex');
}

// GET - List Users (Admin Only)
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.nextUrl.searchParams.get('adminEmail');

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, users });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar usuários' },
      { status: 500 }
    );
  }
}

// POST - Create User (Admin Only)
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, department, adminEmail } =
      await request.json();

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email já cadastrado' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password, normalizedEmail);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        password: hashedPassword,
        role: role || 'user',
        department: department || null,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}

// PUT - Update User (Admin Only)
export async function PUT(request: NextRequest) {
  try {
    const { userId, updates, adminEmail } = await request.json();

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!userId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.department !== undefined)
      updateData.department = updates.department;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.password !== undefined) {
      // Get user email for password hashing
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        updateData.password = hashPassword(updates.password, user.email);
      }
    }

    await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE - Delete User (Admin Only)
export async function DELETE(request: NextRequest) {
  try {
    let userId: string | undefined;
    let adminEmail: string | undefined;

    // Try to get from body first (for DELETE with body)
    try {
      const body = await request.json();
      userId = body.userId;
      adminEmail = body.adminEmail;
    } catch {
      // Fallback to query params
      userId = request.nextUrl.searchParams.get('userId') || undefined;
      adminEmail = request.nextUrl.searchParams.get('adminEmail') || undefined;
    }

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir usuário' },
      { status: 500 }
    );
  }
}
