import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser } from '@/lib/tv';
import { PESSOAS } from '@/lib/escala-auto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tv/nomes — nomes de pessoas da plataforma, para os seletores do
 * editor da TV (participantes de treinamento, instrutor, etc.).
 *
 * Exige login (qualquer usuário logado da plataforma pode listar NOMES — sem
 * email, sem papel, sem dado sensível). Junta:
 *   - usuários ativos da plataforma (User.name)
 *   - as pessoas fixas das equipes A/B/C/D da escala (PESSOAS)
 * Sem repetição e em ordem alfabética.
 */
export async function GET(request: NextRequest) {
  const u = await tvUser(request);
  if (!u) return NextResponse.json({ ok: false, error: 'Sessão expirada — entre de novo.' }, { status: 401 });

  try {
    const users = await db.user.findMany({
      where: { isActive: true },
      select: { name: true },
    });

    const set = new Set<string>();
    for (const x of users) {
      const n = String(x.name || '').trim();
      if (n) set.add(n);
    }
    for (const p of PESSOAS) {
      const n = String(p?.nome || '').trim();
      if (n) set.add(n);
    }

    const nomes = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return NextResponse.json({ ok: true, nomes });
  } catch {
    return NextResponse.json({ ok: false, error: 'Não foi possível carregar os nomes.' }, { status: 500 });
  }
}
