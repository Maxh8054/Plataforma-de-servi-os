import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(str: string, fallback: unknown) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// GET /api/zab-flow/usuarios - List all users
export async function GET() {
  try {
    const usuarios = await db.zabUsuario.findMany({
      orderBy: { id: 'asc' },
    });

    // Parse conquistas from JSON string to array
    const parsed = usuarios.map((u) => ({
      ...u,
      conquistas: safeJsonParse(u.conquistas, []),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error listing usuarios:', error);
    return NextResponse.json(
      { error: 'Erro ao listar usuários' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/usuarios - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, senha, nivel, pontos, conquistas, role } = body;

    // Validate required fields
    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Check for unique nome
    const existingNome = await db.zabUsuario.findFirst({
      where: { nome },
    });
    if (existingNome) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este nome' },
        { status: 409 }
      );
    }

    // Check for unique email
    const existingEmail = await db.zabUsuario.findFirst({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este email' },
        { status: 409 }
      );
    }

    const usuario = await db.zabUsuario.create({
      data: {
        nome,
        email,
        senha,
        nivel: nivel || 'Junior',
        pontos: pontos || 0,
        conquistas: JSON.stringify(conquistas || []),
        role: role || 'funcionario',
      },
    });

    return NextResponse.json(
      {
        ...usuario,
        conquistas: safeJsonParse(usuario.conquistas, []),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating usuario:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
