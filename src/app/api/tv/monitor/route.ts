import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser, tvAdmin } from '@/lib/tv';
import { TV_PANEIS } from '@/lib/tv-panels';
import { aparelhoParaResposta, ensureTabelasMonitor, estaOnline } from '@/lib/tv-monitor';

/**
 * GET /api/tv/monitor — dashboard "TVs conectadas" (SÓ ADMIN DA PLATAFORMA).
 * Todos os painéis do registro com aparelhos online/offline, último backup
 * automático, última edição e pendências de aprovação.
 */
export async function GET(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });
  }

  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ error: 'Banco indisponível' }, { status: 503 });
    }
    const [dispositivos, backups, secoes, pendentes] = await Promise.all([
      db.tvDispositivo.findMany({ orderBy: { ultimaVez: 'desc' }, take: 300 }),
      db.tvBackup.findMany({ where: { origem: 'auto' }, orderBy: { criadoEm: 'desc' }, take: 200, select: { panelSlug: true, criadoEm: true } }),
      db.tvSection.groupBy({ by: ['panelSlug'], _max: { atualizadoEm: true } }),
      db.tvSection.findMany({
        where: { pendingData: { not: null } },
        select: { panelSlug: true, sectionKey: true, pendingPorNome: true, pendingEm: true },
        take: 200,
      }),
    ]);

    const paineis = TV_PANEIS.map((p) => {
      const devs = dispositivos.filter((d) => d.panelSlug === p.slug).map(aparelhoParaResposta);
      return {
        slug: p.slug,
        estado: p.estado,
        estadoNome: p.estadoNome,
        localNome: p.localNome,
        arquivo: p.arquivo,
        dispositivos: devs,
        online: devs.filter((d) => d.online).length,
        offline: devs.filter((d) => !d.online).length,
        ultimoBackup: backups.find((b) => b.panelSlug === p.slug)?.criadoEm ?? null,
        ultimaEdicao: secoes.find((s) => s.panelSlug === p.slug)?._max.atualizadoEm ?? null,
        pendencias: pendentes.filter((s) => s.panelSlug === p.slug).length,
      };
    });

    return NextResponse.json({
      paineis,
      resumo: {
        online: paineis.reduce((n, p) => n + p.online, 0),
        offline: paineis.reduce((n, p) => n + p.offline, 0),
        aparelhosConhecidos: dispositivos.length,
        onlineAgora: dispositivos.filter((d) => estaOnline(d.ultimaVez)).length,
      },
      geradoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[tv/monitor] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ error: 'Erro ao montar o monitor' }, { status: 500 });
  }
}
