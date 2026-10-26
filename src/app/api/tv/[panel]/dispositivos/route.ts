import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin, permissoesDoUsuario } from '@/lib/tv';
import { aparelhoParaResposta, ensureTabelasMonitor } from '@/lib/tv-monitor';
import { csvResponse, csvData, csvCarimbo } from '@/lib/csv';

/**
 * GET /api/tv/[panel]/dispositivos — aparelhos (TVs) deste painel, com
 * status online/offline. Visível para admin e para quem tem ao menos uma
 * permissão de edição no painel (é a mesma gente que usa o editor).
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
  if (!admin) {
    const perms = await permissoesDoUsuario(panel, user.email);
    if (!perms.length) {
      return NextResponse.json({ error: 'Sem acesso a este painel' }, { status: 403 });
    }
  }

  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ dispositivos: [], aviso: 'Monitoramento indisponível agora' });
    }
    const rows = await db.tvDispositivo.findMany({
      where: { panelSlug: panel },
      orderBy: { ultimaVez: 'desc' },
      take: 50,
    });

    // download CSV das TVs conectadas (chip "TVs conectadas" do editor)
    if (request.nextUrl.searchParams.get('formato') === 'csv') {
      return csvResponse(
        `tvs-${panel}-${csvCarimbo()}.csv`,
        ['Aparelho', 'Status', 'Última vez', 'Canal', 'Telas na rotação'],
        rows.map((r) => {
          const a = aparelhoParaResposta(r);
          return [a.id, a.online ? 'Online' : 'Offline', csvData(a.ultimaVez), a.canal, a.telas ?? ''];
        })
      );
    }

    return NextResponse.json({ dispositivos: rows.map(aparelhoParaResposta) });
  } catch (e) {
    console.error('[tv/dispositivos] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ dispositivos: [], aviso: 'Monitoramento indisponível agora' });
  }
}
