import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSessionToken, validateSession, unauthorized, isAdminRole } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

/**
 * Inspeções de Segurança — banco central (substitui o localStorage dos dispositivos).
 *
 * Regras:
 *  - Leitura: qualquer usuário autenticado (sistema público interno)
 *  - Criação: qualquer usuário autenticado — o autor fica gravado no registro
 *  - Edição/exclusão: somente o AUTOR do registro ou um ADMIN
 *  - Toda operação grava em audit_logs (quem, IP, o quê)
 */

/** Tamanho máximo de uma foto em base64 (~1.1MB) */
const MAX_PHOTO_B64 = 1_500_000;

interface InspectionRow {
  id: number;
  areaName: string;
  inspectionDate: string;
  deadlineDate: string;
  location: string | null;
  riskLevel: string;
  observations: string | null;
  status: string;
  completionPercentage: number;
  checklistData: Prisma.JsonValue | null;
  photos: Prisma.JsonValue | null;
  areaPhoto: string | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: Date;
}

/** Converte o registro do banco para o formato que o app HTML espera */
function toAppShape(r: InspectionRow) {
  return {
    id: r.id,
    areaName: r.areaName,
    areaPhoto: r.areaPhoto,
    date: r.inspectionDate,
    deadlineDate: r.deadlineDate,
    location: r.location,
    riskLevel: r.riskLevel,
    observations: r.observations,
    photos: r.photos ?? [],
    checklistData: r.checklistData ?? {},
    status: r.status,
    completionPercentage: r.completionPercentage,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    timestamp: r.createdAt.toISOString(),
  };
}

/** Status e % derivados das fotos (mesmas regras do app) */
function derivePhotoStats(photos: unknown): { status: string; completionPercentage: number; photoCount: number } {
  const list = Array.isArray(photos) ? (photos as Record<string, unknown>[]) : [];
  const total = list.length;
  const resolved = list.filter((p) => p && p.resolved === true).length;
  const status = total === 0 ? 'pending' : resolved === 0 ? 'pending' : resolved === total ? 'completed' : 'in-progress';
  const completionPercentage = total === 0 ? 0 : Math.round((resolved / total) * 100);
  return { status, completionPercentage, photoCount: total };
}

function validatePayload(body: Record<string, unknown>): { error: string } | { ok: true } {
  const areaName = typeof body.areaName === 'string' ? body.areaName.trim() : '';
  const inspectionDate = typeof body.date === 'string' ? body.date.trim() : '';
  const deadlineDate = typeof body.deadlineDate === 'string' ? body.deadlineDate.trim() : '';
  const riskLevel = typeof body.riskLevel === 'string' ? body.riskLevel : '';
  const photos = Array.isArray(body.photos) ? body.photos : [];

  if (!areaName) return { error: 'Nome da área é obrigatório' };
  if (areaName.length > 200) return { error: 'Nome da área muito longo' };
  if (!inspectionDate) return { error: 'Data da inspeção é obrigatória' };
  if (!deadlineDate) return { error: 'Prazo para conclusão é obrigatório' };
  if (!['low', 'medium', 'high'].includes(riskLevel)) return { error: 'Nível de risco inválido' };
  if (photos.length === 0) return { error: 'Pelo menos uma foto é obrigatória' };
  if (photos.length > 30) return { error: 'Máximo de 30 fotos por inspeção' };

  for (const p of photos) {
    const src = p && typeof p === 'object' && 'src' in p ? String((p as { src: unknown }).src) : '';
    if (src.startsWith('data:') && src.length > MAX_PHOTO_B64) {
      return { error: 'Uma das fotos é grande demais. Tente uma foto mais leve.' };
    }
  }
  return { ok: true };
}

// GET — lista todas as inspeções (qualquer usuário autenticado)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return unauthorized();

  const rows = await db.inspection.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ inspections: rows.map(toAppShape) });
}

// POST — cria nova inspeção (qualquer usuário autenticado; autor fica gravado)
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

  const v = validatePayload(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const photos = Array.isArray(body.photos) ? (body.photos as Prisma.InputJsonValue[]) : [];
  const stats = derivePhotoStats(photos);
  const checklistData = (body.checklistData ?? {}) as Prisma.InputJsonValue;

  try {
    const created = await db.inspection.create({
      data: {
        areaName: String(body.areaName).trim(),
        inspectionDate: String(body.date).trim(),
        deadlineDate: String(body.deadlineDate).trim(),
        location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null,
        riskLevel: String(body.riskLevel),
        observations: typeof body.observations === 'string' && body.observations.trim() ? body.observations.trim() : null,
        status: stats.status,
        completionPercentage: stats.completionPercentage,
        checklistData,
        photos,
        areaPhoto: typeof body.areaPhoto === 'string' && body.areaPhoto.startsWith('data:') ? body.areaPhoto : null,
        authorId: user.id,
        authorName: user.name,
        authorEmail: user.email,
      },
    });

    auditLog({
      action: 'inspection_created',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Área: ${created.areaName} | Risco: ${created.riskLevel} | Fotos: ${stats.photoCount}`,
    });

    return NextResponse.json({ inspection: toAppShape(created) }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar inspeção:', error);
    return NextResponse.json({ error: 'Erro ao salvar a inspeção no banco' }, { status: 500 });
  }
}

// PUT — atualiza inspeção existente (autor ou admin)
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const existing = await db.inspection.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Inspeção não encontrada' }, { status: 404 });

  const isOwner = existing.authorId === user.id || existing.authorEmail === user.email;
  if (!isOwner && !isAdminRole(user.role)) {
    auditLog({
      action: 'inspection_update_denied',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Tentou editar inspeção #${id} (${existing.areaName}) de outro usuário`,
      severity: 'warning',
    });
    return NextResponse.json({ error: 'Somente o autor da inspeção ou um admin pode editá-la' }, { status: 403 });
  }

  const v = validatePayload(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const photos = Array.isArray(body.photos) ? (body.photos as Prisma.InputJsonValue[]) : [];
  const stats = derivePhotoStats(photos);
  const checklistData = (body.checklistData ?? {}) as Prisma.InputJsonValue;

  try {
    const updated = await db.inspection.update({
      where: { id },
      data: {
        areaName: String(body.areaName).trim(),
        inspectionDate: String(body.date).trim(),
        deadlineDate: String(body.deadlineDate).trim(),
        location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null,
        riskLevel: String(body.riskLevel),
        observations: typeof body.observations === 'string' && body.observations.trim() ? body.observations.trim() : null,
        status: stats.status,
        completionPercentage: stats.completionPercentage,
        checklistData,
        photos,
        areaPhoto: typeof body.areaPhoto === 'string' && body.areaPhoto.startsWith('data:') ? body.areaPhoto : null,
      },
    });

    auditLog({
      action: 'inspection_updated',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Área: ${updated.areaName} | Status: ${updated.status} (${updated.completionPercentage}%)`,
    });

    return NextResponse.json({ inspection: toAppShape(updated) });
  } catch (error) {
    console.error('Erro ao atualizar inspeção:', error);
    return NextResponse.json({ error: 'Erro ao atualizar a inspeção no banco' }, { status: 500 });
  }
}

// DELETE — exclui inspeção (autor ou admin)
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

  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const existing = await db.inspection.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Inspeção não encontrada' }, { status: 404 });

  const isOwner = existing.authorId === user.id || existing.authorEmail === user.email;
  if (!isOwner && !isAdminRole(user.role)) {
    auditLog({
      action: 'inspection_delete_denied',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Tentou excluir inspeção #${id} (${existing.areaName}) de outro usuário`,
      severity: 'warning',
    });
    return NextResponse.json({ error: 'Somente o autor da inspeção ou um admin pode excluí-la' }, { status: 403 });
  }

  try {
    await db.inspection.delete({ where: { id } });
    auditLog({
      action: 'inspection_deleted',
      userId: user.id,
      userEmail: user.email ?? undefined,
      userName: user.name ?? undefined,
      ip: getClientIp(request),
      details: `Área: ${existing.areaName} (inspeção #${id}, criada por ${existing.authorName ?? '—'})`,
      severity: 'warning',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao excluir inspeção:', error);
    return NextResponse.json({ error: 'Erro ao excluir a inspeção do banco' }, { status: 500 });
  }
}
