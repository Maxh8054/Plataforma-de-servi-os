import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin } from '@/lib/tv';

/**
 * POST /api/tv/[panel]/secoes/[key]/aprovacao  { acao: "aprovar" | "rejeitar" }
 * Somente admin. Aprovar = conteúdo pendente vai para o ar (a TV atualiza).
 * Rejeitar = descarta a pendência (a TV continua com o que já estava).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string; key: string }> }
) {
  const { panel, key } = await params;
  if (!panelValido(panel) || !/^[a-z][a-zA-Z]{2,20}$/.test(key)) {
    return NextResponse.json({ error: 'Painel ou aba inválida' }, { status: 400 });
  }

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json({ error: 'Somente administradores podem aprovar' }, { status: 403 });
  }

  let acao = '';
  try {
    const body = (await request.json()) as { acao?: string };
    acao = String(body.acao || '');
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (acao !== 'aprovar' && acao !== 'rejeitar') {
    return NextResponse.json({ error: 'Ação inválida (aprovar|rejeitar)' }, { status: 400 });
  }

  const sec = await db.tvSection.findUnique({
    where: { panelSlug_sectionKey: { panelSlug: panel, sectionKey: key } },
  });
  if (!sec?.pendingData) {
    return NextResponse.json({ error: 'Não há alteração pendente nesta aba' }, { status: 404 });
  }

  if (acao === 'aprovar') {
    await db.tvSection.update({
      where: { id: sec.id },
      data: {
        // quem editou vira o autor registrado da publicação
        data: sec.pendingData,
        atualizadoEm: sec.pendingEm ?? new Date(),
        atualizadoPorId: sec.pendingPorId,
        atualizadoPorNome: sec.pendingPorNome,
        pendingData: null,
        pendingEm: null,
        pendingPorId: null,
        pendingPorNome: null,
      },
    });
    auditLog({
      action: 'tv_secao_aprovada',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      details: `painel=${panel} aba=${key} editor=${sec.pendingPorNome ?? '?'}`,
    });
    return NextResponse.json({ ok: true, aprovado: true });
  }

  await db.tvSection.update({
    where: { id: sec.id },
    data: {
      pendingData: null,
      pendingEm: null,
      pendingPorId: null,
      pendingPorNome: null,
    },
  });
  auditLog({
    action: 'tv_secao_rejeitada',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    details: `painel=${panel} aba=${key} editor=${sec.pendingPorNome ?? '?'}`,
  });
  return NextResponse.json({ ok: true, rejeitado: true });
}
