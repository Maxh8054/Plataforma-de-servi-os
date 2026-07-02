import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/estoque-goias — load all estoque data
export async function GET() {
  try {
    let row = await db.estoqueGoias.findUnique({ where: { id: 1 } });
    if (!row) {
      row = await db.estoqueGoias.create({
        data: { id: 1, pecas: '{}', retiradas: '[]', pesquisas: '[]', logins: '[]' },
      });
    }
    return NextResponse.json({
      pecas: JSON.parse(row.pecas),
      retiradas: JSON.parse(row.retiradas),
      pesquisas: JSON.parse(row.pesquisas),
      logins: JSON.parse(row.logins),
    });
  } catch (err) {
    console.error('Estoque GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar dados' }, { status: 500 });
  }
}

// POST /api/estoque-goias — save estoque data (partial or full)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pecas, retiradas, pesquisas, logins } = body;

    // Build update object with only provided fields
    const updateData: Record<string, string> = {};
    if (pecas !== undefined) updateData.pecas = JSON.stringify(pecas);
    if (retiradas !== undefined) updateData.retiradas = JSON.stringify(retiradas);
    if (pesquisas !== undefined) updateData.pesquisas = JSON.stringify(pesquisas);
    if (logins !== undefined) updateData.logins = JSON.stringify(logins);

    await db.estoqueGoias.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        pecas: updateData.pecas ?? '{}',
        retiradas: updateData.retiradas ?? '[]',
        pesquisas: updateData.pesquisas ?? '[]',
        logins: updateData.logins ?? '[]',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Estoque POST error:', err);
    return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 });
  }
}