import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser } from '@/lib/tv';
import { ensureTabelasMonitor } from '@/lib/tv-monitor';

/**
 * POST /api/notificacoes/lido — marca o sino como visto (agora).
 * Salvo por usuário: o badge some e volta só com notificação NOVA.
 */
export async function POST(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ ok: false }, { status: 202 });
    }
    await db.notificacaoLeitura.upsert({
      where: { userEmail: user.email.toLowerCase() },
      create: { userEmail: user.email.toLowerCase(), ultimaVez: new Date() },
      update: { ultimaVez: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notificacoes/lido] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
