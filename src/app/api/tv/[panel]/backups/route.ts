import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin } from '@/lib/tv';
import { capturarSnapshot, ensureTabelasMonitor } from '@/lib/tv-monitor';
import { csvResponse, csvData, csvCarimbo } from '@/lib/csv';

function safeJson(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Backups do painel TV.
 *
 * GET            — lista os snapshots (id, origem, data, tamanho) — admin
 * GET ?id=...    — devolve o pack completo { secoes, config } para download — admin
 * POST {acao:"criar"}     — snapshot manual agora — admin
 * POST {acao:"restaurar",id} — aplica o pack no painel (vai pro ar na hora) — admin
 *
 * O snapshot AUTOMÁTICO do dia é criado sozinho (heartbeat) e o PRÉ-EDIÇÃO
 * é gravado antes de cada salvar (rotas de secoes/config).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });

  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ error: 'Banco indisponível' }, { status: 503 });
    }
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
      const b = await db.tvBackup.findFirst({ where: { id, panelSlug: panel } });
      if (!b) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
      const pack = safeJson(b.dados);
      return NextResponse.json({
        id: b.id,
        origem: b.origem,
        criadoEm: b.criadoEm,
        pack: pack && typeof pack === 'object' ? pack : {},
      });
    }
    const rows = await db.tvBackup.findMany({
      where: { panelSlug: panel },
      orderBy: { criadoEm: 'desc' },
      take: 40,
      select: { id: true, origem: true, criadoEm: true, dados: true },
    });

    // download CSV da lista de backups (aba Cópia de segurança do editor)
    if (request.nextUrl.searchParams.get('formato') === 'csv') {
      const origemTxt = (o: string) => (o === 'auto' ? 'Automático' : o === 'pre-edicao' ? 'Pré-edição' : 'Manual');
      return csvResponse(
        `backups-${panel}-${csvCarimbo()}.csv`,
        ['Data', 'Origem', 'Tamanho (KB)', 'Id'],
        rows.map((r) => [csvData(r.criadoEm), origemTxt(r.origem), Math.round((r.dados.length / 1024) * 10) / 10, r.id])
      );
    }

    return NextResponse.json({
      backups: rows.map((r) => ({
        id: r.id,
        origem: r.origem,
        criadoEm: r.criadoEm,
        tamanho: r.dados.length,
      })),
    });
  } catch (e) {
    console.error('[tv/backups] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ error: 'Erro ao listar backups' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });

  let body: { acao?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ error: 'Banco indisponível' }, { status: 503 });
    }

    if (body.acao === 'criar') {
      const id = await capturarSnapshot(panel, 'manual');
      if (!id) return NextResponse.json({ error: 'Não foi possível criar o backup' }, { status: 500 });
      auditLog({
        action: 'tv_backup_manual',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        details: `painel=${panel} backup=${id}`,
      });
      return NextResponse.json({ ok: true, id });
    }

    if (body.acao === 'restaurar' && body.id) {
      const b = await db.tvBackup.findFirst({ where: { id: body.id, panelSlug: panel } });
      if (!b) return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
      const pack = safeJson(b.dados) as { secoes?: Record<string, unknown>; config?: unknown } | null;
      if (!pack || typeof pack !== 'object' || !pack.secoes || typeof pack.secoes !== 'object') {
        return NextResponse.json({ error: 'Backup corrompido' }, { status: 422 });
      }

      // cópia de segurança do estado ATUAL antes de restaurar (nunca restaura sem saída)
      await capturarSnapshot(panel, 'pre-edicao');

      const agora = new Date();
      const autor = user.name || user.email;
      let restauradas = 0;
      for (const [sectionKey, data] of Object.entries(pack.secoes)) {
        if (!/^[a-z][a-zA-Z]{2,20}$/.test(sectionKey)) continue;
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        await db.tvSection.upsert({
          where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey } },
          create: {
            panelSlug: panel,
            sectionKey,
            data: JSON.stringify(data),
            atualizadoEm: agora,
            atualizadoPorId: user.id,
            atualizadoPorNome: `${autor} (restauração)`,
          },
          update: {
            data: JSON.stringify(data),
            atualizadoEm: agora,
            atualizadoPorId: user.id,
            atualizadoPorNome: `${autor} (restauração)`,
          },
        });
        restauradas++;
      }
      if (pack.config && typeof pack.config === 'object' && !Array.isArray(pack.config)) {
        await db.tvPanelConfig.upsert({
          where: { panelSlug: panel },
          create: {
            panelSlug: panel,
            data: JSON.stringify(pack.config),
            atualizadoEm: agora,
            atualizadoPorId: user.id,
            atualizadoPorNome: `${autor} (restauração)`,
          },
          update: {
            data: JSON.stringify(pack.config),
            atualizadoEm: agora,
            atualizadoPorId: user.id,
            atualizadoPorNome: `${autor} (restauração)`,
          },
        });
      }
      auditLog({
        action: 'tv_backup_restaurado',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        details: `painel=${panel} backup=${b.id} abas=${restauradas} origem=${b.origem} de=${b.criadoEm.toISOString()}`,
        severity: 'warning',
      });
      return NextResponse.json({ ok: true, abas: restauradas });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (e) {
    console.error('[tv/backups] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ error: 'Erro no backup' }, { status: 500 });
  }
}
