import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

// POST /api/estoque-goias/import-excel — server-side Excel processing
// Mobile-optimized: heavy XLSX parsing happens on server, not client
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    // Load current pecas from DB
    let row = await db.estoqueGoias.findUnique({ where: { id: 1 } });
    const currentPecas: Record<string, Record<string, unknown>> = row ? JSON.parse(row.pecas) : {};

    let count = 0;
    for (const r of rows) {
      const pn = String(r['PN'] || r['Pn'] || r['pn'] || '').trim().toUpperCase();
      if (!pn) continue;

      const existing = currentPecas[pn] || {};
      currentPecas[pn] = {
        pn,
        nome: existing.nome || String(r['Descrição'] || r['Descricao'] || '').trim(),
        descricao: String(r['Descrição'] || r['Descricao'] || '').trim(),
        endereco: String(r['Endereço'] || r['Endereco'] || '').trim(),
        coluna: String(r['Coluna'] || '').trim(),
        qtd: Number(r['Qtd'] || r['Quantidade'] || 0) || 0,
        unidade: existing.unidade || 'UN',
        categoria: existing.categoria || '',
        minimo: existing.minimo || 0,
      };
      count++;
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
    return NextResponse.json({ error: 'Erro ao processar planilha' }, { status: 500 });
  }
}