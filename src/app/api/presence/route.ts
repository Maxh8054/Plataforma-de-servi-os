import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden, validateSession } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;   // heartbeat nos últimos 2 min = online
const RECENT_WINDOW_MS = 15 * 60 * 1000;  // até 15 min = esteve aqui há pouco

/**
 * POST /api/presence — heartbeat de presença.
 * Body opcional: { view?: string } — nome da tela/aba acessada (logado na auditoria).
 */
export async function POST(request: Request) {
  try {
    const token = await getSessionToken(request);
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const rl = rateLimit(`presence:${user.id}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ success: true });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const body = await request.json().catch(() => ({}));
    const view = typeof body?.view === 'string' ? body.view.trim().slice(0, 80) : '';
    if (view) {
      const ip = getClientIp(request);
      auditLog({
        action: 'view_open',
        userId: user.id,
        userEmail: user.email,
        userName: user.name ?? undefined,
        ip,
        details: view,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/**
 * GET /api/presence — quem está online agora (admin).
 */
export async function GET(request: Request) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const now = Date.now();
    const users = await db.user.findMany({
      where: { isActive: true, lastSeenAt: { not: null } },
      select: { id: true, name: true, email: true, role: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
    });

    const online = users.filter(
      (u) => now - new Date(u.lastSeenAt as Date).getTime() <= ONLINE_WINDOW_MS
    );
    const recent = users.filter((u) => {
      const d = now - new Date(u.lastSeenAt as Date).getTime();
      return d > ONLINE_WINDOW_MS && d <= RECENT_WINDOW_MS;
    });

    return NextResponse.json({ success: true, online, recent, onlineCount: online.length });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar presença' },
      { status: 500 }
    );
  }
}
