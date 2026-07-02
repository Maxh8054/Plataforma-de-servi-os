import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zab-flow/anotacoes - List notes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const criadoPor = searchParams.get('criadoPor');
    const atribuidoA = searchParams.get('atribuidoA');

    const where: Record<string, unknown> = {};

    if (criadoPor) {
      where.criadoPor = parseInt(criadoPor, 10);
    }
    if (atribuidoA) {
      where.atribuidoA = parseInt(atribuidoA, 10);
    }

    const notes = await db.zabNote.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error listing anotacoes:', error);
    return NextResponse.json(
      { error: 'Erro ao listar anotações' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/anotacoes - Create note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { titulo, conteudo, cor, criadoPor, atribuidoA, audioData } = body;

    if (!titulo || !conteudo || !criadoPor) {
      return NextResponse.json(
        { error: 'titulo, conteudo e criadoPor são obrigatórios' },
        { status: 400 }
      );
    }

    const note = await db.zabNote.create({
      data: {
        titulo,
        conteudo,
        cor: cor || '#3498db',
        criadoPor: parseInt(criadoPor, 10),
        atribuidoA: atribuidoA ? parseInt(atribuidoA, 10) : null,
        audioData: audioData || null,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating anotacao:', error);
    return NextResponse.json(
      { error: 'Erro ao criar anotação' },
      { status: 500 }
    );
  }
}
