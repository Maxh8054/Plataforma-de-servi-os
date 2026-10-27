import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin, permissoesDoUsuario } from '@/lib/tv';

/**
 * GET /api/tv/[panel]/pendencias — abas com alteração aguardando aprovação.
 * Admin vê todas; editor vê as pendências das abas que tem permissão de editar.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  const admin = tvAdmin(user);
  let sectionFilter: { in: string[] } | undefined;
  if (!admin) {
    const perms = await permissoesDoUsuario(panel, user.email);
    if (!perms.length) {
      return NextResponse.json({ error: 'Sem permissão neste painel' }, { status: 403 });
    }
    sectionFilter = { in: perms };
  }

  const rows = await db.tvSection.findMany({
    where: {
      panelSlug: panel,
      pendingData: { not: null },
      ...(sectionFilter ? { sectionKey: sectionFilter } : {}),
    },
    select: {
      sectionKey: true,
      pendingData: true,
      pendingEm: true,
      pendingPorNome: true,
    },
    orderBy: { pendingEm: 'desc' },
  });

  const pendencias = rows.map((r) => {
    let data: unknown = {};
    try {
      data = JSON.parse(r.pendingData ?? '{}');
    } catch {
      data = {};
    }
    return {
      sectionKey: r.sectionKey,
      em: r.pendingEm,
      porNome: r.pendingPorNome,
      data, // conteúdo pendente (para prévia no painel de aprovações)
    };
  });

  return NextResponse.json({ pendencias });
}
