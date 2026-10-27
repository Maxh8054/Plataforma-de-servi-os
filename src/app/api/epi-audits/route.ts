import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSessionToken, validateSession, unauthorized, isAdminRole } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

/**
 * Auditorias de EPIs — banco central (substitui o localStorage dos dispositivos).
 *
 * Regras:
 *  - Leitura: qualquer usuário autenticado
 *  - Criação: qualquer usuário autenticado — autor gravado no registro
 *  - Exclusão individual: autor ou admin
 *  - Limpar TODO o histórico: somente admin (ação crítica, auditada)
 *  - Toda operação grava em audit_logs (quem, IP, o quê)
 */

interface EpiAuditRow {
  id: number;
  data: string;
  responsavel: string;
  funcao: string | null;
  colaborador: string;
  area: string;
  observacoes: string | null;
  epis: Prisma.JsonValue | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: Date;
}

function toAppShape(r: EpiAuditRow) {
  return {
    id: r.id,
    data: r.data,
    responsavel: r.responsavel,
    funcao: r.funcao,
    colaborador: r.colaborador,
    area: r.area,
    observacoes: r.observacoes,
    epis: r.epis ?? [],
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    timestamp: r.createdAt.toISOString(),
  };
}

// GET — lista todas as auditorias (qualquer usuário autenticado)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return unauthorized();

  const rows = await db.epiAudit.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ audits: rows.map(toAppShape) });
}

// POST — registra nova auditoria de EPIs
export async function POST(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const data = typeof body.data === 'string' ? body.data.trim() : '';
  const responsavel = typeof body.responsavel === 'string' ? body.responsavel.trim() : '';
  const colaborador = typeof body.colaborador === 'string' ? body.colaborador.trim() : '';
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  const epis = Array.isArray(body.epis) ? body.epis : [];

  if (!data) return NextResponse.json({ error: 'Data da auditoria é obrigatória' }, { status: 400 });
  if (!responsavel) return NextResponse.json({ error: 'Responsável é obrigatório' }, { status: 400 });
  if (!colaborador) return NextResponse.json({ error: 'Colaborador é obrigatório' }, { status: 400 });
  if (!area) return NextResponse.json({ error: 'Área é obrigatória' }, { status: 400 });
  if (epis.length === 0) return NextResponse.json({ error: 'Nenhum EPI informado' }, { status: 400 });

  try {
    const created = await db.epiAudit.create({
      data: {
        data,
        responsavel,
        funcao: typeof body.funcao === 'string' && body.funcao.trim() ? body.funcao.trim() : null,
        colaborador,
        area,
        observacoes: typeof body.observacoes === 'string' && body.observacoes.trim() ? body.observacoes.trim() : null,
        epis: epis as Prisma.InputJsonValue[],
        authorId: user.id,
        authorName: user.name,
        authorEmail: user.email,
      },
    });

    auditLog({
      action: 'epi_audit_created',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Colaborador: ${created.colaborador} | Área: ${created.area} | EPIs: ${epis.length}`,
    });

    return NextResponse.json({ audit: toAppShape(created) }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar auditoria EPI:', error);
    return NextResponse.json({ error: 'Erro ao salvar a auditoria no banco' }, { status: 500 });
  }
}

// DELETE — exclui registros selecionados ({ ids: [...] }) ou TODO o histórico ({ all: true }, só admin)
export async function DELETE(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // ---- Limpar tudo (só admin, ação crítica) ----
  if (body.all === true) {
    if (!isAdminRole(user.role)) {
      auditLog({
        action: 'epi_audits_clear_denied',
        userId: user.id,
        userEmail: user.email ?? undefined,
        userName: user.name ?? undefined,
        ip: getClientIp(request),
        details: 'Usuário não-admin tentou limpar TODO o histórico de auditorias de EPIs',
        severity: 'critical',
      });
      return NextResponse.json({ error: 'Somente um admin pode limpar todo o histórico' }, { status: 403 });
    }

    const { count } = await db.epiAudit.deleteMany({});
    auditLog({
      action: 'epi_audits_all_cleared',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Histórico de auditorias de EPIs apagado (${count} registros)`,
      severity: 'critical',
    });
    return NextResponse.json({ ok: true, deletedIds: [] });
  }

  // ---- Exclusão por ids (autor ou admin) ----
  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Nenhum registro selecionado' }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Muitos registros de uma vez' }, { status: 400 });
  }

  const targets = await db.epiAudit.findMany({ where: { id: { in: ids } } });
  if (targets.length === 0) {
    return NextResponse.json({ error: 'Registros não encontrados' }, { status: 404 });
  }

  const isAdmin = isAdminRole(user.role);
  const notOwned = targets.filter((t) => t.authorId !== user.id && t.authorEmail !== user.email);
  if (!isAdmin && notOwned.length > 0) {
    auditLog({
      action: 'epi_audit_delete_denied',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Tentou excluir ${notOwned.length} auditoria(s) de EPIs de outro usuário`,
      severity: 'warning',
    });
    return NextResponse.json(
      { error: 'Você só pode excluir auditorias que você mesmo registrou (ou pedir a um admin)' },
      { status: 403 },
    );
  }

  const targetIds = targets.map((t) => t.id);
  await db.epiAudit.deleteMany({ where: { id: { in: targetIds } } });

  auditLog({
    action: 'epi_audit_deleted',
    userId: user.id,
    userEmail: user.email ?? undefined,
    userName: user.name ?? undefined,
    ip: getClientIp(request),
    details: `${targetIds.length} auditoria(s) de EPIs excluída(s) (colaboradores: ${[...new Set(targets.map((t) => t.colaborador))].slice(0, 5).join(', ')})`,
    severity: 'warning',
  });

  return NextResponse.json({ ok: true, deletedIds: targetIds });
}
