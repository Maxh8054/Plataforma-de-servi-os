import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/estoque-goias/import-excel — server-side Excel processing
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Dynamic import to avoid bundling issues in standalone
    const XLSX = await import('xlsx');
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (!rows.length) {
      return NextResponse.json({ error: 'Planilha vazia ou sem dados' }, { status: 400 });
    }

    // Load current pecas from DB
    let row;
    try {
      row = await db.estoqueGoias.findUnique({ where: { id: 1 } });
    } catch (dbErr) {
      console.error('DB error in import-excel:', dbErr);
      return NextResponse.json({ error: 'Erro de banco de dados — tabela não inicializada' }, { status: 500 });
    }
    const currentPecas: Record<string, Record<string, unknown>> = row ? JSON.parse(row.pecas) : {};

    let count = 0;
    for (const r of rows) {
      // Try all possible column name variations (case-insensitive, trimmed)
      const pn = String(
        r['PN'] || r['Pn'] || r['pn'] ||
        r['Código'] || r['Codigo'] || r['codigo'] ||
        r['Código PN'] || r['CODIGO'] || ''
      ).trim().toUpperCase();
      if (!pn) continue;

      const descricao = String(r['Descrição'] || r['Descricao'] || r['descricao'] || r['DESCRICAO'] || '').trim();
      const endereco = String(r['Endereço'] || r['Endereco'] || r['endereco'] || r['ENDEREÇO'] || '').trim();
      const coluna = String(r['Coluna'] || r['coluna'] || r['COLUNA'] || '').trim();
      const qtd = parseInt(String(r['Qtd'] || r['Quantidade'] || r['qtd'] || r['QTD'] || '0')) || 0;

      const existing = currentPecas[pn] || {};
      currentPecas[pn] = {
        pn,
        nome: existing.nome || descricao,
        descricao,
        endereco,
        coluna,
        qtd,
        unidade: existing.unidade || 'UN',
        categoria: existing.categoria || '',
        minimo: existing.minimo || 0,
      };
      count++;
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Nenhuma peça encontrada — verifique se a coluna "PN" existe' }, { status: 400 });
    }

    // Save updated pecas to DB
    await db.estoqueGoias.upsert({
      where: { id: 1 },
      update: { pecas: JSON.stringify(currentPecas) },
      create: {
        id: 1,
        pecas: JSON.stringify(currentPecas),
        retiradas: row?.retiradas ?? '[]',
        pesquisas: row?.pesquisas ?? '[]',
        logins: row?.logins ?? '[]',
      },
    });

    return NextResponse.json({ ok: true, count, pecas: currentPecas });
  } catch (err) {
    console.error('Estoque import-excel error:', err);
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro ao processar: ${msg}` }, { status: 500 });
  }
}