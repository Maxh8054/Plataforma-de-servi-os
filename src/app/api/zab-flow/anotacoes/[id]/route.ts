import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/zab-flow/anotacoes/[id] - Update note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const existing = await db.zabNote.findUnique({
      where: { id: noteId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Anotação não encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { titulo, conteudo, cor, atribuidoA, audioData } = body;

    const updateData: Record<string, unknown> = {
      atualizadoEm: new Date().toISOString(),
    };

    if (titulo !== undefined) updateData.titulo = titulo;
    if (conteudo !== undefined) updateData.conteudo = conteudo;
    if (cor !== undefined) updateData.cor = cor;
    if (atribuidoA !== undefined) updateData.atribuidoA = atribuidoA ? parseInt(atribuidoA, 10) : null;
    if (audioData !== undefined) updateData.audioData = audioData;

    const updated = await db.zabNote.update({
      where: { id: noteId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating anotacao:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar anotação' },
      { status: 500 }
    );
  }
}

// DELETE /api/zab-flow/anotacoes/[id] - Delete note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const existing = await db.zabNote.findUnique({
      where: { id: noteId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Anotação não encontrada' },
        { status: 404 }
      );
    }

    await db.zabNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ message: 'Anotação deletada com sucesso' });
  } catch (error) {
    console.error('Error deleting anotacao:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar anotação' },
      { status: 500 }
    );
  }
}
