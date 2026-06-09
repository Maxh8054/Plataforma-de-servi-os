import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/zab-flow/notificacoes/[id] - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { lida } = body;

    const notification = await db.zabNotification.update({
      where: { id: parseInt(id, 10) },
      data: { lida: lida !== false ? 1 : 0 },
    });

    return NextResponse.json({
      ...notification,
      lida: notification.lida === 1,
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar notificação' },
      { status: 500 }
    );
  }
}

// DELETE /api/zab-flow/notificacoes/[id] - Delete a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.zabNotification.delete({
      where: { id: parseInt(id, 10) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir notificação' },
      { status: 500 }
    );
  }
}
