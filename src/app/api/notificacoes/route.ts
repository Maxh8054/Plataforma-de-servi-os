import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser, tvAdmin } from '@/lib/tv';
import { TV_PANEIS, infoPainel } from '@/lib/tv-panels';
import { ensureTabelasMonitor, estaOnline } from '@/lib/tv-monitor';
import { TZ_PADRAO, hojeNoFuso } from '@/lib/escala-auto';

/**
 * GET /api/notificacoes — central de notificações (sino na plataforma).
 * Itens calculados na hora para os painéis que o usuário pode ver:
 *  - tv_offline: aparelho sem heartbeat há mais de 6 minutos
 *  - pendente: aba aguardando aprovação do admin
 *  - backup: backup automático concluído nas últimas 12h
 *  - expiracao: conteúdo que sai do ar nas próximas 48h
 * "novo" = aconteceu depois da última vez que o usuário abriu o sino.
 */
export async function GET(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  try {
    const admin = tvAdmin(user);
    let paineis: typeof TV_PANEIS;
    if (admin) {
      paineis = TV_PANEIS;
    } else {
      const concessoes = await db.tvPermissao.findMany({
        where: { userEmail: user.email.toLowerCase() },
        select: { panelSlug: true },
      });
      const slugs = new Set(concessoes.map((c) => c.panelSlug));
      paineis = TV_PANEIS.filter((p) => slugs.has(p.slug));
    }
    if (!paineis.length) return NextResponse.json({ itens: [], naoLidas: 0, admin });

    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ itens: [], naoLidas: 0, aviso: 'Notificações indisponíveis agora' });
    }

    const slugs = paineis.map((p) => p.slug);
    const nomePainel = (slug: string) => {
      const info = infoPainel(slug);
      return info ? (info.localNome === info.estadoNome ? info.estadoNome : `${info.localNome} · ${info.estadoNome}`) : slug;
    };

    const agora = Date.now();
    const dozeHoras = 12 * 3600e3;
    const quarentaEOito = 48 * 3600e3;
    const hoje = hojeNoFuso(TZ_PADRAO);
    const limiteFim = new Date(+new Date(`${hoje}T12:00:00Z`) + quarentaEOito);

    const [dispositivos, pendentes, backups, secoes, leitura] = await Promise.all([
      db.tvDispositivo.findMany({ where: { panelSlug: { in: slugs } }, orderBy: { ultimaVez: 'desc' }, take: 200 }),
      db.tvSection.findMany({
        where: { panelSlug: { in: slugs }, pendingData: { not: null } },
        select: { panelSlug: true, sectionKey: true, pendingPorNome: true, pendingEm: true },
      }),
      db.tvBackup.findMany({
        where: { panelSlug: { in: slugs }, origem: 'auto' },
        orderBy: { criadoEm: 'desc' },
        take: 50,
        select: { panelSlug: true, criadoEm: true },
      }),
      db.tvSection.findMany({ where: { panelSlug: { in: slugs } }, select: { panelSlug: true, sectionKey: true, data: true } }),
      db.notificacaoLeitura.findUnique({ where: { userEmail: user.email.toLowerCase() } }),
    ]);

    const itens: {
      id: string;
      tipo: string;
      panel: string;
      painelNome: string;
      titulo: string;
      descricao: string;
      desde: string;
      novo: boolean;
    }[] = [];

    // TVs offline (aparelho que SUMIU do ar — online deixa de ser notificado)
    for (const d of dispositivos) {
      if (estaOnline(d.ultimaVez)) continue;
      itens.push({
        id: `tv_offline|${d.panelSlug}|${d.deviceId}`,
        tipo: 'tv_offline',
        panel: d.panelSlug,
        painelNome: nomePainel(d.panelSlug),
        titulo: `TV offline — ${nomePainel(d.panelSlug)}`,
        descricao: `Aparelho ${d.deviceId}${d.canal ? ` (canal ${d.canal})` : ''} sem sinal desde ${new Date(d.ultimaVez).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
        desde: d.ultimaVez.toISOString(),
        novo: false,
      });
    }

    // pendências de aprovação
    for (const p of pendentes) {
      itens.push({
        id: `pendente|${p.panelSlug}|${p.sectionKey}`,
        tipo: 'pendente',
        panel: p.panelSlug,
        painelNome: nomePainel(p.panelSlug),
        titulo: `Aprovação pendente — ${nomePainel(p.panelSlug)}`,
        descricao: `Aba "${p.sectionKey}" aguardando aprovação${p.pendingPorNome ? ` (enviado por ${p.pendingPorNome})` : ''}.`,
        desde: (p.pendingEm ?? new Date()).toISOString(),
        novo: false,
      });
    }

    // backup automático concluído (só os das últimas 12h — não vira spam diário)
    for (const b of backups) {
      if (agora - new Date(b.criadoEm).getTime() > dozeHoras) continue;
      itens.push({
        id: `backup|${b.panelSlug}|${b.criadoEm.toISOString()}`,
        tipo: 'backup',
        panel: b.panelSlug,
        painelNome: nomePainel(b.panelSlug),
        titulo: `Backup automático concluído — ${nomePainel(b.panelSlug)}`,
        descricao: `Snapshot de segurança salvo às ${new Date(b.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Restaurável no editor do painel.`,
        desde: b.criadoEm.toISOString(),
        novo: false,
      });
    }

    // conteúdo expirando nas próximas 48h
    for (const s of secoes) {
      let dados: unknown;
      try {
        dados = JSON.parse(s.data);
      } catch {
        continue;
      }
      const itensAba = (dados as { itens?: unknown })?.itens;
      if (!Array.isArray(itensAba)) continue;
      for (const it of itensAba) {
        const fim = (it as { fim?: string })?.fim;
        if (!fim || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) continue;
        const tFim = +new Date(`${fim}T23:59:59-03:00`);
        if (Number.isNaN(tFim) || tFim < Date.now() || tFim > +limiteFim + 12 * 3600e3) continue;
        const tituloItem = String((it as { titulo?: string }).titulo || (it as { nome?: string }).nome || s.sectionKey);
        itens.push({
          id: `expiracao|${s.panelSlug}|${s.sectionKey}|${fim}|${tituloItem}`,
          tipo: 'expiracao',
          panel: s.panelSlug,
          painelNome: nomePainel(s.panelSlug),
          titulo: `Sai do ar em ${Math.max(0, Math.ceil((tFim - agora) / 86400e3))} dia(s) — ${nomePainel(s.panelSlug)}`,
          descricao: `"${tituloItem}" (aba ${s.sectionKey}) tem fim marcado para ${fim.split('-').reverse().join('/')}.`,
          desde: new Date(`${fim}T00:00:00-03:00`).toISOString(),
          novo: false,
        });
        break; // 1 aviso por aba é suficiente
      }
    }

    const ultimaVez = leitura ? new Date(leitura.ultimaVez).getTime() : 0;
    for (const it of itens) it.novo = +new Date(it.desde) > ultimaVez;
    itens.sort((a, b) => (a.novo === b.novo ? +new Date(b.desde) - +new Date(a.desde) : a.novo ? -1 : 1));

    return NextResponse.json({
      itens: itens.slice(0, 50),
      naoLidas: itens.filter((i) => i.novo).length,
      admin,
    });
  } catch (e) {
    console.error('[notificacoes] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ itens: [], naoLidas: 0, aviso: 'Notificações indisponíveis agora' });
  }
}
