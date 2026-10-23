import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser, tvAdmin } from '@/lib/tv';
import { TV_PANEIS, slugsDePaineis, infoPainel } from '@/lib/tv-panels';

/**
 * GET /api/tv/panels — painéis de TV que o usuário logado pode acessar.
 * Hierarquia ESTADO → LOCAL (ex.: "minas-araxa"): cada painel tem conteúdo,
 * canais, permissões e controle próprios. Admin: acesso a todos os painéis do
 * registro (src/lib/tv-panels.ts). Usuário comum: apenas os painéis em que tem
 * ao menos uma concessão de permissão (aba) cadastrada para o e-mail dele.
 */
export async function GET(request: NextRequest) {
  // Sessão obrigatória (cookie ou header x-zamine-token) — igual às demais rotas /api/tv/*
  const user = await tvUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  }

  // Admin enxerga todos os painéis do registro (mesma regra das abas do editor)
  if (tvAdmin(user)) {
    return NextResponse.json({ admin: true, panels: slugsDePaineis() });
  }

  // Usuário comum: painéis DISTINTOS que tenham ao menos 1 concessão para o e-mail,
  // cruzados com o registro oficial (slug sem registro não tem página/rota — não expor)
  try {
    const concessoes = await db.tvPermissao.findMany({
      // e-mail é comparado em minúsculas, mesmo padrão de permissoesDoUsuario em src/lib/tv.ts
      where: { userEmail: user.email.toLowerCase() },
      select: { panelSlug: true },
    });
    const panels = Array.from(new Set(concessoes.map((c) => c.panelSlug)))
      .filter((s) => !!infoPainel(s))
      .sort((a, b) => {
        // ordem estável e amigável: pela ordem do registro (estado, depois local)
        const ia = TV_PANEIS.findIndex((p) => p.slug === a);
        const ib = TV_PANEIS.findIndex((p) => p.slug === b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    return NextResponse.json({ admin: false, panels });
  } catch (e) {
    console.error('[api/tv/panels] Erro ao buscar painéis permitidos:', e);
    return NextResponse.json({ error: 'Erro ao buscar painéis' }, { status: 500 });
  }
}
