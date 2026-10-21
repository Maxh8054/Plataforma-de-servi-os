import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';

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
  _request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  try {
    const [secoes, config] = await Promise.all([
      db.tvSection.findMany({ where: { panelSlug: panel } }),
      db.tvPanelConfig.findUnique({ where: { panelSlug: panel } }),
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
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[tv/content] erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar painel' }, { status: 500 });
  }
}
