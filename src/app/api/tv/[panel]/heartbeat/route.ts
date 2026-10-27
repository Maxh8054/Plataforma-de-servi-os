import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido } from '@/lib/tv';
import {
  ensureTabelasMonitor,
  dispensarAparelhosVelhos,
  snapshotAutoSeNecessario,
} from '@/lib/tv-monitor';

const DEV_RE = /^[A-Za-z0-9-]{4,24}$/;

/**
 * POST /api/tv/[panel]/heartbeat — a TV se anuncia a cada ~2,5 min:
 * deviceId (salvo no aparelho), canal em uso e nº de telas na rotação.
 * Público (a TV não faz login), painel validado. Também dispara o
 * backup automático do dia (1x/dia, dentro da própria rota).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  let body: { d?: string; c?: string; t?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const deviceId = String(body.d || '').trim();
  if (!DEV_RE.test(deviceId)) {
    return NextResponse.json({ error: 'deviceId inválido' }, { status: 400 });
  }
  const canal = String(body.c ?? '').slice(0, 60);
  const telas = Number.isFinite(body.t) ? Math.max(0, Math.min(999, Math.round(body.t as number))) : null;

  try {
    if (!(await ensureTabelasMonitor())) {
      // banco indisponível: a TV não pode travar por causa do heartbeat
      return NextResponse.json({ ok: false }, { status: 202 });
    }
    await db.tvDispositivo.upsert({
      where: { panelSlug_deviceId: { panelSlug: panel, deviceId } },
      create: { panelSlug: panel, deviceId, canal, telas, ua: (request.headers.get('user-agent') || '').slice(0, 180) },
      update: { canal, telas, ultimaVez: new Date() },
    });
    // limpeza e backup do dia: ocasionais, sem atrasar a resposta de forma perceptível
    if (Math.random() < 0.02) void dispensarAparelhosVelhos();
    void snapshotAutoSeNecessario(panel);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[tv/heartbeat] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
