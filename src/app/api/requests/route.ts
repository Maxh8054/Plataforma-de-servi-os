import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

const ADMIN_EMAIL = 'max-r@zaminebrasil.com';

function hashPassword(password: string, email: string): string {
  return createHash('sha256').update(`${password}:${email}`).digest('hex');
}

// POST - Create Request
export async function POST(request: NextRequest) {
  try {
    const { type, email, data } = await request.json();

    if (!type || !email || !data) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    if (!['registration', 'password_change'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de solicitação inválido' },
        { status: 400 }
      );
    }

    await db.request.create({
      data: {
        type,
        email: email.toLowerCase().trim(),
        data: typeof data === 'string' ? data : JSON.stringify(data),
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao criar solicitação' },
      { status: 500 }
    );
  }
}

// GET - List Requests (Admin Only)
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.nextUrl.searchParams.get('adminEmail');

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const status = request.nextUrl.searchParams.get('status');
    const where = status ? { status } : {};

    const requests = await db.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar solicitações' },
      { status: 500 }
    );
  }
}

// PUT - Approve/Reject Request
export async function PUT(request: NextRequest) {
  try {
    const { requestId, action, adminEmail } = await request.json();

    if (!adminEmail || adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Ação inválida' },
        { status: 400 }
      );
    }

    const req = await db.request.findUnique({ where: { id: requestId } });
    if (!req) {
      return NextResponse.json(
        { success: false, error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    if (action === 'reject') {
      await db.request.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });
      return NextResponse.json({ success: true });
    }

    // Approve
    const requestData = JSON.parse(req.data);

    if (req.type === 'registration') {
      const existingUser = await db.user.findUnique({
        where: { email: req.email },
      });
      if (existingUser) {
        await db.request.update({
          where: { id: requestId },
          data: { status: 'rejected' },
        });
        return NextResponse.json({
          success: false,
          error: 'Email já cadastrado',
        });
      }

      const hashedPassword = hashPassword(
        requestData.password || '2026',
        req.email
      );
      await db.user.create({
        data: {
          email: req.email,
          name: requestData.name || null,
          password: hashedPassword,
          role: requestData.role || 'user',
          department: requestData.department || null,
        },
      });
    } else if (req.type === 'password_change') {
      const user = await db.user.findUnique({
        where: { email: req.email },
      });
      if (!user) {
        await db.request.update({
          where: { id: requestId },
          data: { status: 'rejected' },
        });
        return NextResponse.json({
          success: false,
          error: 'Usuário não encontrado',
        });
      }

      const hashedPassword = hashPassword(
        requestData.newPassword || '2026',
        req.email
      );
      await db.user.update({
        where: { email: req.email },
        data: { password: hashedPassword },
      });
    }

    await db.request.update({
      where: { id: requestId },
      data: { status: 'approved' },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
