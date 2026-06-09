import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseDemanda(d: Record<string, unknown>) {
  return {
    ...d,
    atribuidos: safeJsonParse(d.atribuidos as string, []),
    anexosCriacao: safeJsonParse(d.anexosCriacao as string, []),
    anexosResolucao: safeJsonParse(d.anexosResolucao as string, []),
    comentariosUsuarios: safeJsonParse(d.comentariosUsuarios as string, []),
    diasSemana: safeJsonParse(d.diasSemana as string | null, null),
    isRotina: d.isRotina === 1 || d.isRotina === true,
  };
}

// GET /api/zab-flow/demandas/[id] - Get single demanda
export async function GET(
  _request: NextRequest,
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

    const demanda = await db.zabDemanda.findUnique({
      where: { id: demandaId },
    });

    if (!demanda) {
      return NextResponse.json(
        { error: 'Demanda não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      parseDemanda(demanda as unknown as Record<string, unknown>)
    );
  } catch (error) {
    console.error('Error getting demanda:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar demanda' },
      { status: 500 }
    );
  }
}

// PUT /api/zab-flow/demandas/[id] - Update demanda
export async function PUT(
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
    const {
      funcionarioId,
      nomeFuncionario,
      emailFuncionario,
      categoria,
      prioridade,
      complexidade,
      descricao,
      local,
      dataLimite,
      status,
      isRotina,
      diasSemana,
      comentarios,
      comentarioGestor,
      dataConclusao,
      atribuidos,
      anexosCriacao,
      anexosResolucao,
      comentarioReprovacaoAtribuicao,
      nomeDemanda,
      atualizadoPor,
      comentariosUsuarios,
    } = body;

    const updateData: Record<string, unknown> = {
      dataAtualizacao: new Date().toISOString(),
    };

    if (funcionarioId !== undefined) updateData.funcionarioId = parseInt(funcionarioId, 10);
    if (nomeFuncionario !== undefined) updateData.nomeFuncionario = nomeFuncionario;
    if (emailFuncionario !== undefined) updateData.emailFuncionario = emailFuncionario;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (prioridade !== undefined) updateData.prioridade = prioridade;
    if (complexidade !== undefined) updateData.complexidade = complexidade;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (local !== undefined) updateData.local = local;
    if (dataLimite !== undefined) updateData.dataLimite = dataLimite;
    if (status !== undefined) updateData.status = status;
    if (isRotina !== undefined) updateData.isRotina = isRotina ? 1 : 0;
    if (diasSemana !== undefined) updateData.diasSemana = diasSemana ? JSON.stringify(diasSemana) : null;
    if (comentarios !== undefined) updateData.comentarios = comentarios;
    if (comentarioGestor !== undefined) updateData.comentarioGestor = comentarioGestor;
    if (dataConclusao !== undefined) updateData.dataConclusao = dataConclusao;
    if (atribuidos !== undefined) updateData.atribuidos = JSON.stringify(atribuidos);
    if (anexosCriacao !== undefined) updateData.anexosCriacao = JSON.stringify(anexosCriacao);
    if (anexosResolucao !== undefined) updateData.anexosResolucao = JSON.stringify(anexosResolucao);
    if (comentarioReprovacaoAtribuicao !== undefined) updateData.comentarioReprovacaoAtribuicao = comentarioReprovacaoAtribuicao;
    if (nomeDemanda !== undefined) updateData.nomeDemanda = nomeDemanda;
    if (atualizadoPor !== undefined) updateData.atualizadoPor = parseInt(atualizadoPor, 10);
    if (comentariosUsuarios !== undefined) updateData.comentariosUsuarios = JSON.stringify(comentariosUsuarios);

    const updated = await db.zabDemanda.update({
      where: { id: demandaId },
      data: updateData,
    });

    // Create audit record with old/new data
    await db.zabAudit.create({
      data: {
        acao: 'UPDATE',
        tabela: 'zab_demandas',
        registroId: demandaId,
        dadosAntigos: JSON.stringify(existing),
        dadosNovos: JSON.stringify(updated),
        usuarioId: atualizadoPor ? parseInt(atualizadoPor, 10) : null,
      },
    });

    return NextResponse.json(
      parseDemanda(updated as unknown as Record<string, unknown>)
    );
  } catch (error) {
    console.error('Error updating demanda:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar demanda' },
      { status: 500 }
    );
  }
}

// DELETE /api/zab-flow/demandas/[id] - Delete demanda
export async function DELETE(
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

    // Create audit record before deleting
    await db.zabAudit.create({
      data: {
        acao: 'DELETE',
        tabela: 'zab_demandas',
        registroId: demandaId,
        dadosAntigos: JSON.stringify(existing),
        usuarioId: null,
      },
    });

    await db.zabDemanda.delete({
      where: { id: demandaId },
    });

    return NextResponse.json({ message: 'Demanda deletada com sucesso' });
  } catch (error) {
    console.error('Error deleting demanda:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar demanda' },
      { status: 500 }
    );
  }
}
