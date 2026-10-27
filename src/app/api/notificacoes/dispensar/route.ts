import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser } from '@/lib/tv';
import { ensureTabelasMonitor } from '@/lib/tv-monitor';

const G = globalThis as typeof globalThis & { __notifDispensaPodaEm?: number };

/** Poda dispensas com mais de 90 dias (no máximo 1x por hora por processo). */
async function podarDispensas(): Promise<void> {
  const agora = Date.now();
  if (G.__notifDispensaPodaEm && agora - G.__notifDispensaPodaEm < 3600e3) return;
  G.__notifDispensaPodaEm = agora;
  try {
    await db.notificacaoDispensa.deleteMany({
      where: { criadoEm: { lt: new Date(agora - 90 * 86400e3) } },
    });
  } catch {
    /* best-effort */
  }
}

/**
 * POST /api/notificacoes/dispensar — limpar notificações do sino individualmente.
 * Body: { id: "..." } para uma, ou { ids: ["...","..."] } para várias ("Limpar todas").
 *
 * A dispensa fica guardada POR OCORRÊNCIA: o id do item muda quando o problema
 * é novo (a TV caiu de novo, nova pendência enviada, novo backup), então o aviso
 * volta a aparecer — dispensar nunca esconde ocorrências futuras.
 */
export async function POST(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  let body: { id?: string; ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const ids = (Array.isArray(body.ids) ? body.ids : [body.id])
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200)
    .slice(0, 60);
  if (!ids.length) return NextResponse.json({ error: 'Nada para dispensar' }, { status: 400 });

  try {
    if (!(await ensureTabelasMonitor())) {
      return NextResponse.json({ error: 'Indisponível agora' }, { status: 503 });
    }
    await db.notificacaoDispensa.createMany({
      data: [...new Set(ids)].map((itemKey) => ({ userEmail: user.email.toLowerCase(), itemKey })),
      skipDuplicates: true,
    });
    void podarDispensas();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[notificacoes/dispensar] erro:', (e as Error)?.message?.slice(0, 160));
    return NextResponse.json({ error: 'Não foi possível dispensar agora' }, { status: 500 });
  }
}
