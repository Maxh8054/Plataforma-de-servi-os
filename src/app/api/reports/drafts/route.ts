import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, validateSession, unauthorized } from '@/lib/auth';
import { auditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

/**
 * Rascunhos do Criar Relatórios (/relatorios) — persistência por LOGIN.
 *
 * Um rascunho por usuário + tipo de relatório ('home' | 'inspecao').
 * O cliente faz autosave contínuo (debounce) e também ao sair/recarregar
 * a página; ao abrir o app, o rascunho é restaurado — mesmo que a pessoa
 * esteja em outro computador, pois está amarrada ao login da plataforma.
 */

const VALID_TYPES = new Set(['home', 'inspecao']);

// GET — lista os rascunhos do usuário logado
export async function GET(request: NextRequest) {
  const user = await validateSession(await getSessionToken(request));
  if (!user) return unauthorized();

  const drafts = await db.reportDraft.findMany({
    where: { userId: user.id },
    select: { reportType: true, data: true, updatedAt: true },
  });

  return NextResponse.json({ drafts });
}

// PUT — autosave (upsert) do rascunho de um tipo
export async function PUT(request: NextRequest) {
  const user = await validateSession(await getSessionToken(request));
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const reportType: string | undefined = body?.reportType;

  if (!reportType || !VALID_TYPES.has(reportType) || typeof body?.data !== 'object' || body.data === null) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const data = JSON.stringify(body.data);

  const existing = await db.reportDraft.findUnique({
    where: { userId_reportType: { userId: user.id, reportType } },
    select: { id: true },
  });

  const draft = await db.reportDraft.upsert({
    where: { userId_reportType: { userId: user.id, reportType } },
    update: { data },
    create: { userId: user.id, reportType, data },
  });

  // Auditoria: primeira criação do rascunho (updates de autosave não poluem o log)
  if (!existing) {
    auditLog({
      action: 'report_draft_created',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      details: reportType,
    });
  }

  return NextResponse.json({ reportType: draft.reportType, updatedAt: draft.updatedAt });
}

// DELETE — descarta um rascunho (?reportType=home|inspecao)
export async function DELETE(request: NextRequest) {
  const user = await validateSession(await getSessionToken(request));
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('reportType');

  if (!reportType || !VALID_TYPES.has(reportType)) {
    return NextResponse.json({ error: 'reportType inválido' }, { status: 400 });
  }

  const deleted = await db.reportDraft.deleteMany({
    where: { userId: user.id, reportType },
  });

  if (deleted.count > 0) {
    auditLog({
      action: 'report_draft_deleted',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      details: reportType,
      severity: 'warning',
    });
  }

  return NextResponse.json({ success: true });
}
