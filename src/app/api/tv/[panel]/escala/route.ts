import { NextRequest, NextResponse } from 'next/server';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';
import { TZ_PADRAO } from '@/lib/escala-auto';
import { computarEscalaMesSeguro, computarEscalaAnoSeguro } from '@/lib/escala-mes';

/**
 * GET /api/tv/[panel]/escala — escala de turno da PLATAFORMA (equipes A/B/C/D)
 * para a tela interativa da TV (mesmo layout do Calendário):
 *
 *   ?ano=2026&mes=10  → mês completo (dias + horas Spot/ADM + relatórios)
 *   ?ano=2026         → ano inteiro (letras por dia, para os 12 minis)
 *
 * Público (a TV lê sem login), igual ao /content. Falha devolve erro 500 sem
 * derrubar a TV — a tela mostra o que já tem em cache.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const tz = request.nextUrl.searchParams.get('tz') ?? TZ_PADRAO;
  const ano = Number(request.nextUrl.searchParams.get('ano'));
  const mes = Number(request.nextUrl.searchParams.get('mes') ?? 0); // 1-12 (opcional)

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return NextResponse.json({ error: 'Ano inválido' }, { status: 400 });
  }
  if (mes && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
    return NextResponse.json({ error: 'Mês inválido' }, { status: 400 });
  }

  try {
    if (!mes) {
      const anoData = await computarEscalaAnoSeguro(ano, tz);
      if (!anoData) return NextResponse.json({ error: 'Erro ao calcular a escala do ano' }, { status: 500 });
      return NextResponse.json(anoData, { headers: { 'Cache-Control': 'no-store' } });
    }
    const mesData = await computarEscalaMesSeguro(ano, mes, tz);
    if (!mesData) return NextResponse.json({ error: 'Erro ao calcular a escala do mês' }, { status: 500 });
    return NextResponse.json(mesData, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Erro ao calcular a escala' }, { status: 500 });
  }
}
