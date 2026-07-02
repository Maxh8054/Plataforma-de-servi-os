import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/zab-flow/demandas/[id]/extend-deadline - Extend deadline for demanda
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const demandaId = parseInt(id, 10);

    if (isNaN(demandaId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const existing = await db.zabDemanda.findUnique({
      where: { id: demandaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Demanda não encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { novaDataLimite, motivo, usuarioId } = body;

    if (!novaDataLimite) {
      return NextResponse.json(
        { error: 'novaDataLimite é obrigatória' },
        { status: 400 }
      );
    }

    const oldDataLimite = existing.dataLimite;

    const updated = await db.zabDemanda.update({
      where: { id: demandaId },
      data: {
        dataLimite: novaDataLimite,
        dataAtualizacao: new Date().toISOString(),
      },
    });

    // Create audit record
    await db.zabAudit.create({
      data: {
        acao: 'EXTEND_DEADLINE',
        tabela: 'zab_demandas',
        registroId: demandaId,
        dadosAntigos: JSON.stringify({ dataLimite: oldDataLimite }),
        dadosNovos: JSON.stringify({
          dataLimite: novaDataLimite,
          motivo: motivo || 'Não informado',
        }),
        usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error extending deadline:', error);
    return NextResponse.json(
      { error: 'Erro ao estender prazo' },
      { status: 500 }
    );
  }
}
