import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';

/**
 * POST /api/tv/[panel]/erros — a TV reporta problemas sozinha (público, sem login):
 * erro de JavaScript, falha ao carregar conteúdo, foto quebrada etc.
 * O editor vê esses avisos na aba Histórico do painel — em vez de descobrir tarde.
 *
 * Antivandalismo/anti-spam:
 *  - tamanho máximo de texto
 *  - mensagem idêntica repetida em menos de 10 min é ignorada
 *  - registros de erro com mais de 45 dias são apagados na gravação
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  let body: { mensagem?: string; onde?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const mensagem = String(body.mensagem ?? '').trim().slice(0, 400);
  const onde = String(body.onde ?? '').trim().slice(0, 200);
  if (!mensagem) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });

  try {
    const dezMin = new Date(Date.now() - 10 * 60 * 1000);
    const dup = await db.auditLog.findFirst({
      where: {
        action: 'tv_erro',
        details: { contains: mensagem.slice(0, 120) },
        createdAt: { gte: dezMin },
      },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ ok: true, dedupe: true });

    await db.auditLog.create({
      data: {
        action: 'tv_erro',
        details: `painel=${panel} ${mensagem}${onde ? ` — ${onde}` : ''}`,
        severity: 'warning',
      },
    });

    // casa de limpeza: erros de TV com mais de 45 dias não servem para nada
    await db.auditLog.deleteMany({
      where: { action: 'tv_erro', createdAt: { lt: new Date(Date.now() - 45 * 24 * 3600 * 1000) } },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[tv/erros] erro:', error);
    return NextResponse.json({ error: 'Erro ao registrar' }, { status: 500 });
  }
}
