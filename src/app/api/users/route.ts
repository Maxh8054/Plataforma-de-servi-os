import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

// GET - List Users (Admin Only - sessão real)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        isFirstAccess: true,
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

// POST - Create User (Admin Only - sessão real)
export async function POST(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const { email, password, name, role, department } = await request.json();

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

    const hashedPassword = await hash(password, 10);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        password: hashedPassword,
        role: role === 'ADMIN' || role === 'admin' ? 'admin' : 'user',
        department: department || null,
      },
    });

    auditLog({
      action: 'user_created',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Criou usuário ${normalizedEmail} (role: ${user.role})`,
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

// PUT - Update User (Admin Only - sessão real)
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const { userId, updates } = await request.json();

    if (!userId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined)
      updateData.role =
        updates.role === 'ADMIN' || updates.role === 'admin'
          ? 'admin'
          : 'user';
    if (updates.department !== undefined)
      updateData.department = updates.department;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.password !== undefined) {
      updateData.password = await hash(updates.password, 10);
      // senha trocada manualmente invalida sessões abertas
      updateData.sessionToken = null;
      updateData.tokenExpiresAt = null;
    }

    await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    auditLog({
      action: 'user_updated',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Atualizou usuário ${userId} (campos: ${Object.keys(updateData).join(', ')})`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE - Delete User (Admin Only - sessão real)
export async function DELETE(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    let userId: string | undefined;

    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      userId = request.nextUrl.searchParams.get('userId') || undefined;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    if (userId === admin.id) {
      return NextResponse.json(
        { success: false, error: 'Você não pode excluir a si mesmo' },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    await db.user.delete({ where: { id: userId } });

    auditLog({
      action: 'user_deleted',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Excluiu usuário ${target.email}`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir usuário' },
      { status: 500 }
    );
  }
}
