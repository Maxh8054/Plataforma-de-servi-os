import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';
import { TZ_PADRAO, computarEscalaAutoSeguro } from '@/lib/escala-auto';

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
    const [secoes, config, escalaAuto] = await Promise.all([
      db.tvSection.findMany({ where: { panelSlug: panel } }),
      db.tvPanelConfig.findUnique({ where: { panelSlug: panel } }),
      computarEscalaAutoSeguro(request.nextUrl.searchParams.get('tz') ?? TZ_PADRAO),
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
        // escala de turno automática (equipes A/B/C/D da plataforma) — a TV
        // mostra sozinha o técnico de hoje e de amanhã; null se falhar
        escalaAuto,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[tv/content] erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar painel' }, { status: 500 });
  }
}
