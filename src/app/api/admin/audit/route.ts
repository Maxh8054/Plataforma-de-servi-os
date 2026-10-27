import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';

// GET - Consultar logs de auditoria (Admin - sessão real)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const sp = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10) || 100, 300);
    const skip = Math.max(parseInt(sp.get('skip') || '0', 10) || 0, 0);
    const email = sp.get('email')?.trim();
    const action = sp.get('action')?.trim();

    const where: Record<string, unknown> = {};
    if (email) {
      where.userEmail = { contains: email, mode: 'insensitive' as const };
    }
    if (action) {
      where.action = action;
    }
    // ?suspicious=1 → apenas eventos estranhos (severity warning/critical)
    if (sp.get('suspicious') === '1') {
      where.severity = { not: 'info' };
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      select: {
        id: true,
        action: true,
        userEmail: true,
        userName: true,
        ip: true,
        details: true,
        severity: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, logs });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar logs de auditoria' },
      { status: 500 }
    );
  }
}
