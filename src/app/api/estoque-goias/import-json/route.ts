import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/estoque-goias/import-json — restore full backup from JSON file
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const text = await file.text();
    const data = JSON.parse(text);

    const pecas = data.pecas || {};
    const retiradas = data.retiradas || [];
    const pesquisas = data.pesquisas || [];
    const logins = data.logins || [];

    await db.estoqueGoias.upsert({
      where: { id: 1 },
      update: {
        pecas: JSON.stringify(pecas),
        retiradas: JSON.stringify(retiradas),
        pesquisas: JSON.stringify(pesquisas),
        logins: JSON.stringify(logins),
      },
      create: {
        id: 1,
        pecas: JSON.stringify(pecas),
        retiradas: JSON.stringify(retiradas),
        pesquisas: JSON.stringify(pesquisas),
        logins: JSON.stringify(logins),
      },
    });

    return NextResponse.json({ ok: true, pecas, retiradas, pesquisas, logins });
  } catch (err) {
    console.error('Estoque import-json error:', err);
    return NextResponse.json({ error: 'JSON inválido ou erro ao processar' }, { status: 500 });
  }
}