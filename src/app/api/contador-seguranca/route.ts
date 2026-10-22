import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';
import { DATA_BASE_SEGURANCA } from '@/lib/contador-seguranca';

export const dynamic = 'force-dynamic';

/** Regionais que possuem contador na tela inicial / painéis de TV */
const REGIONAIS = Object.keys(DATA_BASE_SEGURANCA); // goias, minas

function erro(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** Aceita o slug do painel ("goias") e o apelido do mapa da home ("go") */
function normalizarRegional(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (REGIONAIS.includes(s)) return s;
  if (s === 'go') return 'goias';
  if (s === 'mg') return 'minas';
  return null;
}

/**
 * GET /api/contador-seguranca — datas-base do contador "dias sem afastamento".
 * Público (não é dado sensível; a TV já consome o contador via content API).
 * Retorna mapa plano { goias: 'YYYY-MM-DD', minas: 'YYYY-MM-DD' } — banco na
 * frente, fallback do código quando a regional não tem registro.
 */
export async function GET() {
  const contadores: Record<string, string> = { ...DATA_BASE_SEGURANCA };
  try {
    const rows = await db.contadorSeguranca.findMany({ select: { regional: true, dataBase: true } });
    for (const r of rows) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.dataBase)) contadores[r.regional] = r.dataBase;
    }
  } catch {
    // banco indisponível — devolve o fallback
  }
  return NextResponse.json(contadores, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * PUT /api/contador-seguranca — atualiza a data-base de uma regional (só admin).
 * Body: { regional: 'goias'|'minas'|'go'|'mg', dataBase: 'YYYY-MM-DD' }
 * Fica no BANCO: sobrevive a deploy/commit novo, sem precisar editar código.
 */
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Só administrador pode alterar o contador de segurança');

  let body: { regional?: unknown; dataBase?: unknown };
  try {
    body = await request.json();
  } catch {
    return erro('JSON inválido');
  }

  const regional = normalizarRegional(body.regional);
  const dataBase = String(body.dataBase ?? '').trim();
  if (!regional) return erro('Regional desconhecida');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase)) return erro('Data inválida (use AAAA-MM-DD)');

  await db.contadorSeguranca.upsert({
    where: { regional },
    create: {
      regional,
      dataBase,
      atualizadoPorId: admin.id,
      atualizadoPorNome: admin.name ?? admin.email,
    },
    update: {
      dataBase,
      atualizadoPorId: admin.id,
      atualizadoPorNome: admin.name ?? admin.email,
    },
  });

  const contadores: Record<string, string> = { ...DATA_BASE_SEGURANCA };
  const rows = await db.contadorSeguranca.findMany({ select: { regional: true, dataBase: true } });
  for (const r of rows) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.dataBase)) contadores[r.regional] = r.dataBase;
  }
  return NextResponse.json({ ok: true, contadores }, { headers: { 'Cache-Control': 'no-store' } });
}
