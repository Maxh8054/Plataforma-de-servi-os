import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/zab-flow/auth - Login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const usuario = await db.zabUsuario.findFirst({
      where: { email },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Plaintext password comparison (matching the original app)
    if (usuario.senha !== senha) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Parse conquistas before returning
    let conquistas: string[] = [];
    try {
      conquistas = JSON.parse(usuario.conquistas);
    } catch {
      conquistas = [];
    }

    return NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      nivel: usuario.nivel,
      pontos: usuario.pontos,
      conquistas,
      role: usuario.role,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    });
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
