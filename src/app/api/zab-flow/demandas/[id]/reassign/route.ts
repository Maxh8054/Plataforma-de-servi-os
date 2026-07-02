import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/zab-flow/demandas/[id]/reassign - Reassign demanda to another user
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
    const { novoFuncionarioId, novoNome, novoEmail, usuarioId } = body;

    if (!novoFuncionarioId || !novoNome || !novoEmail) {
      return NextResponse.json(
        { error: 'novoFuncionarioId, novoNome e novoEmail são obrigatórios' },
        { status: 400 }
      );
    }

    const oldAssignment = {
      funcionarioId: existing.funcionarioId,
      nomeFuncionario: existing.nomeFuncionario,
      emailFuncionario: existing.emailFuncionario,
    };

    const updated = await db.zabDemanda.update({
      where: { id: demandaId },
      data: {
        funcionarioId: parseInt(novoFuncionarioId, 10),
        nomeFuncionario: novoNome,
        emailFuncionario: novoEmail,
        dataAtualizacao: new Date().toISOString(),
      },
    });

    // Create audit record
    await db.zabAudit.create({
      data: {
        acao: 'REASSIGN',
        tabela: 'zab_demandas',
        registroId: demandaId,
        dadosAntigos: JSON.stringify(oldAssignment),
        dadosNovos: JSON.stringify({
          funcionarioId: parseInt(novoFuncionarioId, 10),
          nomeFuncionario: novoNome,
          emailFuncionario: novoEmail,
        }),
        usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error reassigning demanda:', error);
    return NextResponse.json(
      { error: 'Erro ao reatribuir demanda' },
      { status: 500 }
    );
  }
}
