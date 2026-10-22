import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';
import { TZ_PADRAO, computarEscalaAutoSeguro, hojeNoFuso } from '@/lib/escala-auto';
import { computarSegurancaAuto } from '@/lib/seguranca-auto';
import { carregarRelatorios, janelaPadrao } from '@/lib/relatorio-tecnico';

function safeJson(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * GET /api/tv/[panel]/content — conteúdo NO AR do painel (só o aprovado).
 * Público: a TV da oficina não precisa de login. Edições pendentes NÃO aparecem aqui.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  try {
    const tz = request.nextUrl.searchParams.get('tz') ?? TZ_PADRAO;
    const [secoes, config, escalaAuto, segurancaAuto, relatorios] = await Promise.all([
      db.tvSection.findMany({ where: { panelSlug: panel } }),
      db.tvPanelConfig.findUnique({ where: { panelSlug: panel } }),
      computarEscalaAutoSeguro(request.nextUrl.searchParams.get('tz') ?? TZ_PADRAO),
      // dias sem afastamento automáticos — mesmo contador da tela inicial da
      // plataforma (data-base lida DO BANCO); a TV mostra sozinha, sem
      // lançamento de data no editor
      computarSegurancaAuto(panel, tz),
      // entregas do relatório técnico (por técnico/dia) marcadas na plataforma —
      // janela ontem..amanhã; a TV usa no slide da escala. Falha não derruba o painel
      carregarRelatorios(janelaPadrao(tz).ontem, janelaPadrao(tz).amanha),
    ]);

    const secoesObj: Record<string, unknown> = {};
    for (const s of secoes) {
      const data = safeJson(s.data);
      // só entra no ar o que tem conteúdo aprovado de fato (objeto com chaves);
      // linhas criadas apenas para abrigar pendência (data vazio) ficam de fora
      if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data as object).length > 0) {
        secoesObj[s.sectionKey] = data;
      }
    }

    return NextResponse.json(
      {
        secoes: secoesObj,
        config: (safeJson(config?.data ?? null) as Record<string, unknown> | null) ?? {},
        // data de hoje (YYYY-MM-DD) no fuso pedido — a TV usa no slide de
        // aniversariantes para o "HOJE" bater com o fuso da operação, mesmo
        // que o relógio do aparelho esteja errado
        hoje: hojeNoFuso(request.nextUrl.searchParams.get('tz') ?? TZ_PADRAO),
        // escala de turno automática (equipes A/B/C/D da plataforma) — a TV
        // mostra sozinha os técnicos de ontem, hoje e amanhã; null se falhar
        escalaAuto,
        // entregas do relatório técnico por dia/técnico (marcadas na plataforma)
        relatorios,
        // dias sem afastamento automáticos (contador oficial da plataforma)
        segurancaAuto,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[tv/content] erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar painel' }, { status: 500 });
  }
}
