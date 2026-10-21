import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import {
  panelValido,
  respostaPanelInvalido,
  tvUser,
  tvAdmin,
  podeEditarSecao,
} from '@/lib/tv';

const SEC_RE = /^[a-z][a-zA-Z]{2,20}$/;
// abas administrativas têm rotas próprias (config) ou fluxo dedicado — nunca por aqui
const BLOQUEADAS = new Set(['config', 'aprovacoes', 'permissoes']);

function safeJson(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** GET — conteúdo completo da aba (no ar + pendente, com quem/ quando) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string; key: string }> }
) {
  const { panel, key } = await params;
  if (!panelValido(panel) || !SEC_RE.test(key) || BLOQUEADAS.has(key)) {
    return NextResponse.json({ error: 'Painel ou aba inválida' }, { status: 400 });
  }

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  const sec = await db.tvSection.findUnique({
    where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey: key } },
  });

  return NextResponse.json({
    sectionKey: key,
    data: (safeJson(sec?.data ?? null) as Record<string, unknown> | null) ?? {},
    atualizadoEm: sec?.atualizadoEm ?? null,
    atualizadoPorNome: sec?.atualizadoPorNome ?? null,
    pending: sec?.pendingData
      ? {
          em: sec.pendingEm,
          porNome: sec.pendingPorNome,
          data: safeJson(sec.pendingData) ?? {},
        }
      : null,
  });
}

/**
 * PUT — salva a aba.
 *  - Admin: vai direto para o ar (a TV atualiza na hora).
 *  - Editor com permissão na aba: fica PENDENTE até o admin aprovar —
 *    sem aprovação NÃO roda na TV.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string; key: string }> }
) {
  const { panel, key } = await params;
  if (!panelValido(panel) || !SEC_RE.test(key) || BLOQUEADAS.has(key)) {
    return NextResponse.json({ error: 'Painel ou aba inválida' }, { status: 400 });
  }

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  if (!(await podeEditarSecao(panel, user, key))) {
    return NextResponse.json(
      { error: 'Você não tem permissão para editar esta aba. Peça acesso ao administrador.' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Conteúdo da aba inválido' }, { status: 400 });
  }
  // tamanho máximo de segurança (500 KB por aba, sem contar imagens que ficam em tv_assets)
  if (JSON.stringify(body).length > 500_000) {
    return NextResponse.json({ error: 'Conteúdo grande demais' }, { status: 413 });
  }

  const admin = tvAdmin(user);
  const agora = new Date();
  const json = JSON.stringify(body);

  // Controle de concorrência: se outra pessoa publicou nesta aba depois que
  // este editor carregou o conteúdo (baseEm), devolve 409 em vez de
  // sobrescrever silenciosamente o trabalho alheio. force=1 publica de propósito.
  const url = new URL(request.url);
  const baseEm = url.searchParams.get("baseEm");
  const force = url.searchParams.get("force") === "1";

  if (admin) {
    // Admin aprova ao salvar: vai direto para o ar
    const antes = await db.tvSection.findUnique({
      where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey: key } },
      select: { data: true, atualizadoEm: true, atualizadoPorNome: true },
    });
    if (!force && baseEm && antes?.atualizadoEm) {
      const serverMs = new Date(antes.atualizadoEm).getTime();
      const baseMs = new Date(baseEm).getTime();
      if (!Number.isNaN(baseMs) && serverMs > baseMs) {
        auditLog({
          action: 'tv_secao_conflito',
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          details: `painel=${panel} aba=${key} publicadoPor=${antes.atualizadoPorNome ?? "?"} em ${antes.atualizadoEm.toISOString()}`,
        });
        return NextResponse.json(
          {
            error: `Outra pessoa publicou nesta aba (${antes.atualizadoPorNome ?? "?"}) depois de você abrir o editor. Confirme para sobrescrever de propósito.`,
            conflict: true,
            atualizadoEm: antes.atualizadoEm,
            atualizadoPorNome: antes.atualizadoPorNome,
          },
          { status: 409 }
        );
      }
    }
    await db.tvSection.upsert({
      where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey: key } },
      create: {
        panelSlug: panel,
        sectionKey: key,
        data: json,
        atualizadoEm: agora,
        atualizadoPorId: user.id,
        atualizadoPorNome: user.name || user.email,
      },
      update: {
        data: json,
        atualizadoEm: agora,
        atualizadoPorId: user.id,
        atualizadoPorNome: user.name || user.email,
        pendingData: null,
        pendingEm: null,
        pendingPorId: null,
        pendingPorNome: null,
      },
    });
    auditLog({
      action: 'tv_secao_publicada',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      details: `painel=${panel} aba=${key}`,
    });
    return NextResponse.json({ ok: true, noAr: true, atualizadoEm: agora.toISOString() });
  }

  // Editor com permissão: cria/atualiza a pendência (não altera o que está na TV)
  await db.tvSection.upsert({
    where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey: key } },
    create: {
      panelSlug: panel,
      sectionKey: key,
      data: '{}',
      pendingData: json,
      pendingEm: agora,
      pendingPorId: user.id,
      pendingPorNome: user.name || user.email,
    },
    update: {
      pendingData: json,
      pendingEm: agora,
      pendingPorId: user.id,
      pendingPorNome: user.name || user.email,
    },
  });
  auditLog({
    action: 'tv_secao_pendente',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    details: `painel=${panel} aba=${key}`,
  });
  return NextResponse.json({ ok: true, noAr: false, pending: true });
}
