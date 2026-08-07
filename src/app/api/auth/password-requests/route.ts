import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

const REQUEST_EXPIRY_DAYS = 7;

async function expireOldPendingRequests() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REQUEST_EXPIRY_DAYS);
  const expired = await db.passwordResetRequest.findMany({
    where: { status: 'pending', createdAt: { lt: cutoff } },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const req of expired) {
    await db.passwordResetRequest.update({
      where: { id: req.id },
      data: { status: 'rejected', newGeneratedPassword: '', desiredPassword: '', resolvedAt: new Date(), resolvedBy: 'system-expiry' },
    });
    auditLog({ action: 'password_request_expired', userId: req.userId, userEmail: req.user.email, userName: req.user.name });
  }
}

export async function GET(request: Request) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden();

  await expireOldPendingRequests();

  const requests = await db.passwordResetRequest.findMany({
    where: { status: 'pending' }, orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const resolved = await db.passwordResetRequest.findMany({
    where: { status: { in: ['approved', 'rejected'] } }, orderBy: { resolvedAt: 'desc' }, take: 20,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const resolvedWithAdmin = await Promise.all(resolved.map(async (r) => {
    let resolvedByName = 'Sistema';
    if (r.resolvedBy && r.resolvedBy !== 'system-expiry') {
      const adminUser = await db.user.findUnique({ where: { id: r.resolvedBy }, select: { name: true } });
      if (adminUser) resolvedByName = adminUser.name;
    }
    return { ...r, resolvedByName };
  }));

  const lockedUsers = await db.user.findMany({
    where: { lockedUntil: { gt: new Date() } },
    select: { id: true, name: true, email: true, loginAttempts: true, lockedUntil: true },
  });

  return NextResponse.json({
    pending: requests.map(r => ({ id: r.id, userId: r.userId, userName: r.user.name, userEmail: r.user.email, createdAt: r.createdAt })),
    resolved: resolvedWithAdmin.map(r => ({ id: r.id, userId: r.userId, userName: r.user.name, userEmail: r.user.email, status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt, resolvedByName: r.resolvedByName })),
    lockedUsers: lockedUsers.map(u => ({ id: u.id, name: u.name, email: u.email, lockedUntil: u.lockedUntil })),
  });
}

export async function POST(request: Request) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden();

  const ip = getClientIp(request);
  const body = await request.json();
  const { action } = body;

  if (action === 'unlock') {
    const { userId } = body;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    await db.user.update({ where: { id: userId }, data: { loginAttempts: 0, lockedUntil: null, sessionToken: null, tokenExpiresAt: null } });
    auditLog({ action: 'user_unlocked', userId: admin.id, userEmail: admin.email, userName: admin.name, ip, details: `Unlocked ${user.name}` });
    return NextResponse.json({ success: true, message: `${user.name} desbloqueado!` });
  }

  if (action === 'delete') {
    const { requestId } = body;
    await db.passwordResetRequest.delete({ where: { id: requestId } });
    return NextResponse.json({ success: true });
  }

  if (action === 'deleteAll') {
    const result = await db.passwordResetRequest.deleteMany({ where: { status: { in: ['approved', 'rejected'] } } });
    return NextResponse.json({ success: true, message: `${result.count} registro(s) removido(s).` });
  }

  const { requestId } = body;
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }

  const resetRequest = await db.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!resetRequest || resetRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }

  if (action === 'approve') {
    await db.user.update({
      where: { id: resetRequest.userId },
      data: { password: resetRequest.newGeneratedPassword, loginAttempts: 0, lockedUntil: null, sessionToken: null, tokenExpiresAt: null },
    });
    await db.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'approved', desiredPassword: '', newGeneratedPassword: '', resolvedAt: new Date(), resolvedBy: admin.id },
    });
    auditLog({ action: 'password_approved', userId: admin.id, userName: admin.name, ip, details: `Approved password reset for ${resetRequest.userId}` });
    return NextResponse.json({ success: true, message: 'Senha atualizada!' });
  } else {
    await db.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', newGeneratedPassword: '', desiredPassword: '', resolvedAt: new Date(), resolvedBy: admin.id },
    });
    auditLog({ action: 'password_rejected', userId: admin.id, userName: admin.name, ip, details: `Rejected password reset for ${resetRequest.userId}` });
    return NextResponse.json({ success: true, message: 'Solicitação rejeitada.' });
  }
}
