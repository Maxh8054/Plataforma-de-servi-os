import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, validateSession } from '@/lib/auth';
import { TZ_PADRAO } from '@/lib/escala-auto';
import {
  carregarRelatorios,
  dataValida,
  janelaPadrao,
} from '@/lib/relatorio-tecnico';

export const dynamic = 'force-dynamic';

/** Técnicos da escala (letras) — mesma atribuição do EscalaModal/escala-auto */
const LETRAS = new Set(['A', 'B', 'C', 'D']);

function erro(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * GET /api/relatorio-tecnico?de=AAAA-MM-DD&ate=AAAA-MM-DD
 * Público: devolve as entregas marcadas no banco
 * { "YYYY-MM-DD": { A: { entregue, atualizadoEm, atualizadoPor } } }.
 * Sem query: janela ontem..amanhã (fuso America/Sao_Paulo).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const janela = janelaPadrao(TZ_PADRAO);
  const de = dataValida(q.get('de')) ? (q.get('de') as string) : janela.ontem;
  const ate = dataValida(q.get('ate')) ? (q.get('ate') as string) : janela.amanha;
  const mapa = await carregarRelatorios(de, ate);
  return NextResponse.json(
    { de, ate, relatorios: mapa },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * PUT /api/relatorio-tecnico — marca/troca a entrega de UM técnico num dia.
 * Body: { data: 'YYYY-MM-DD', letra: 'A'|'B'|'C'|'D', entregue: boolean }
 * Precisa de sessão (a tela é interna); grava quem marcou — fica no banco,
 * então deploy/commit novo não perde nada.
 */
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) return erro('Sessão expirada — faça login novamente', 401);

  let body: { data?: unknown; letra?: unknown; entregue?: unknown };
  try {
    body = await request.json();
  } catch {
    return erro('JSON inválido');
  }

  const data = body.data;
  const letra = String(body.letra ?? '').trim().toUpperCase();
  if (!dataValida(data)) return erro('Data inválida (use AAAA-MM-DD)');
  if (!LETRAS.has(letra)) return erro('Letra inválida (use A, B, C ou D)');
  if (typeof body.entregue !== 'boolean') return erro('Informe "entregue" como verdadeiro ou falso');

  await db.relatorioTecnico.upsert({
    where: { data_letra: { data, letra } },
    create: {
      data,
      letra,
      entregue: body.entregue,
      atualizadoPor: user.name ?? user.email,
    },
    update: {
      entregue: body.entregue,
      atualizadoPor: user.name ?? user.email,
    },
  });

  // devolve a janela atualizada (ontem..amanhã) para a tela já refletir
  const janela = janelaPadrao(TZ_PADRAO);
  const mapa = await carregarRelatorios(janela.ontem, janela.amanha);
  return NextResponse.json(
    { ok: true, janela, relatorios: mapa },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
