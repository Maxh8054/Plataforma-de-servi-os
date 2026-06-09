import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zab-flow/notificacoes - List notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json(
        { error: 'usuarioId é obrigatório' },
        { status: 400 }
      );
    }

    const notificacoes = await db.zabNotification.findMany({
      where: { usuarioId: parseInt(usuarioId, 10) },
      orderBy: { id: 'desc' },
      take: 50,
    });

    return NextResponse.json(notificacoes.map(n => ({
      ...n,
      lida: n.lida === 1,
    })));
  } catch (error) {
    console.error('Error listing notifications:', error);
    return NextResponse.json(
      { error: 'Erro ao listar notificações' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/notificacoes - Create a notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, titulo, mensagem, tipo, demandaId } = body;

    if (!usuarioId || !titulo || !mensagem) {
      return NextResponse.json(
        { error: 'usuarioId, titulo e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    const notification = await db.zabNotification.create({
      data: {
        usuarioId: parseInt(usuarioId, 10),
        titulo,
        mensagem,
        tipo: tipo || 'info',
        demandaId: demandaId ? parseInt(demandaId, 10) : null,
      },
    });

    return NextResponse.json({
      ...notification,
      lida: notification.lida === 1,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Erro ao criar notificação' },
      { status: 500 }
    );
  }
}

// PUT /api/zab-flow/notificacoes - Mark all as read for a user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, markAllRead } = body;

    if (markAllRead && usuarioId) {
      await db.zabNotification.updateMany({
        where: { usuarioId: parseInt(usuarioId, 10), lida: 0 },
        data: { lida: 1 },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar notificações' },
      { status: 500 }
    );
  }
}
