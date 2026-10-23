import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser, tvAdmin } from '@/lib/tv';

/**
 * GET /api/tv/panels — painéis de TV que o usuário logado pode acessar.
 * Admin: acesso a todos os painéis. Usuário comum: apenas os painéis em que
 * tem ao menos uma concessão de permissão (aba) cadastrada para o e-mail dele.
 */
export async function GET(request: NextRequest) {
  // Sessão obrigatória (cookie ou header x-zamine-token) — igual às demais rotas /api/tv/*
  const user = await tvUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  }

  // Admin enxerga todos os painéis (mesma regra das abas do editor)
  if (tvAdmin(user)) {
    return NextResponse.json({ admin: true, panels: ['goias', 'minas'] });
  }

  // Usuário comum: painéis DISTINTOS que tenham ao menos 1 concessão para o e-mail
  try {
    const concessoes = await db.tvPermissao.findMany({
      // e-mail é comparado em minúsculas, mesmo padrão de permissoesDoUsuario em src/lib/tv.ts
      where: { userEmail: user.email.toLowerCase() },
      select: { panelSlug: true },
    });
    // dedupe de slugs + ordem estável (o que vier do banco, ordenado)
    const panels = Array.from(new Set(concessoes.map((c) => c.panelSlug))).sort();
    return NextResponse.json({ admin: false, panels });
  } catch (e) {
    console.error('[api/tv/panels] Erro ao buscar painéis permitidos:', e);
    return NextResponse.json({ error: 'Erro ao buscar painéis' }, { status: 500 });
  }
}
