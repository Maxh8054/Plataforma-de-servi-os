import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zab-flow/feedbacks - List feedbacks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const funcionarioId = searchParams.get('funcionarioId');

    const where: Record<string, unknown> = {};

    if (funcionarioId) {
      where.funcionarioId = parseInt(funcionarioId, 10);
    }

    const feedbacks = await db.zabFeedback.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error('Error listing feedbacks:', error);
    return NextResponse.json(
      { error: 'Erro ao listar feedbacks' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/feedbacks - Create feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { funcionarioId, gestorId, tipo, mensagem } = body;

    if (!funcionarioId || !tipo || !mensagem) {
      return NextResponse.json(
        { error: 'funcionarioId, tipo e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    const feedback = await db.zabFeedback.create({
      data: {
        funcionarioId: parseInt(funcionarioId, 10),
        gestorId: gestorId ? parseInt(gestorId, 10) : 99,
        tipo,
        mensagem,
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { error: 'Erro ao criar feedback' },
      { status: 500 }
    );
  }
}
