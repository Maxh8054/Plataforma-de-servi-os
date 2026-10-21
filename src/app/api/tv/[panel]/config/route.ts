import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin } from '@/lib/tv';

/**
 * Configurações do painel (rotação, tempos, letreiro, cores, links).
 * GET — metadados da config (o conteúdo público já vem em /content).
 * PUT — somente admin, vai direto para o ar (config é responsabilidade do admin).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  const cfg = await db.tvPanelConfig.findUnique({ where: { panelSlug: panel } });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(cfg?.data ?? '{}') as Record<string, unknown>;
  } catch {
    data = {};
  }
  return NextResponse.json({
    config: data,
    atualizadoEm: cfg?.atualizadoEm ?? null,
    atualizadoPorNome: cfg?.atualizadoPorNome ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json(
      { error: 'Somente administradores podem alterar as configurações' },
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
    return NextResponse.json({ error: 'Configuração inválida' }, { status: 400 });
  }
  const json = JSON.stringify(body);
  if (json.length > 500_000) {
    return NextResponse.json({ error: 'Configuração grande demais' }, { status: 413 });
  }

  // Controle de concorrência (mesma proteção das abas): 409 se outra pessoa
  // salvou a config depois que este editor carregou. force=1 sobrescreve de propósito.
  const url = new URL(request.url);
  const baseEm = url.searchParams.get("baseEm");
  const force = url.searchParams.get("force") === "1";

  const atual = await db.tvPanelConfig.findUnique({
    where: { panelSlug: panel },
    select: { atualizadoEm: true, atualizadoPorNome: true },
  });
  if (!force && baseEm && atual?.atualizadoEm) {
    const serverMs = new Date(atual.atualizadoEm).getTime();
    const baseMs = new Date(baseEm).getTime();
    if (!Number.isNaN(baseMs) && serverMs > baseMs) {
      auditLog({
        action: 'tv_config_conflito',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        details: `painel=${panel} publicadoPor=${atual.atualizadoPorNome ?? "?"} em ${atual.atualizadoEm.toISOString()}`,
      });
      return NextResponse.json(
        {
          error: `Outro administrador salvou a configuração (${atual.atualizadoPorNome ?? "?"}) depois de você abrir o editor. Confirme para sobrescrever de propósito.`,
          conflict: true,
          atualizadoEm: atual.atualizadoEm,
          atualizadoPorNome: atual.atualizadoPorNome,
        },
        { status: 409 }
      );
    }
  }

  const agora = new Date();
  await db.tvPanelConfig.upsert({
    where: { panelSlug: panel },
    create: {
      panelSlug: panel,
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
    },
  });

  auditLog({
    action: 'tv_config_salva',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    details: `painel=${panel}`,
  });
  return NextResponse.json({ ok: true, noAr: true, atualizadoEm: agora.toISOString() });
}
