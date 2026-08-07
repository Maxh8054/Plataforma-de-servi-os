import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(str: string, fallback: unknown) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// PUT /api/zab-flow/usuarios/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nome, email, senha, nivel, pontos, conquistas, role } = body;

    // Check if user exists
    const existing = await db.zabUsuario.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Check unique constraints if nome or email is being changed
    if (nome && nome !== existing.nome) {
      const duplicateNome = await db.zabUsuario.findFirst({
        where: { nome, id: { not: userId } },
      });
      if (duplicateNome) {
        return NextResponse.json(
          { error: 'Já existe um usuário com este nome' },
          { status: 409 }
        );
      }
    }

    if (email && email !== existing.email) {
      const duplicateEmail = await db.zabUsuario.findFirst({
        where: { email, id: { not: userId } },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Já existe um usuário com este email' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nome !== undefined) updateData.nome = nome;
    if (email !== undefined) updateData.email = email;
    if (senha !== undefined) updateData.senha = senha;
    if (nivel !== undefined) updateData.nivel = nivel;
    if (pontos !== undefined) updateData.pontos = pontos;
    if (conquistas !== undefined) updateData.conquistas = JSON.stringify(conquistas);
    if (role !== undefined) updateData.role = role;

    const updated = await db.zabUsuario.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      conquistas: safeJsonParse(updated.conquistas, []),
    });
  } catch (error) {
    console.error('Error updating usuario:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE /api/zab-flow/usuarios/[id] - Delete user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const existing = await db.zabUsuario.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    await db.zabUsuario.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting usuario:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar usuário' },
      { status: 500 }
    );
  }
}
