import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, validateSession } from '@/lib/auth';
import { hojeNoFuso, TZ_PADRAO } from '@/lib/escala-auto';

/**
 * Aniversariantes da plataforma (botão "Aniversariantes" no rodapé).
 *
 * GET — usuário autenticado: retorna a equipe completa do cadastro de
 * colaboradores do painel TV (aba Aniversariantes, painel "goias") — o MESMO
 * cadastro que alimenta a TV — com nome, dia, mês, setor e FOTO (TvAsset,
 * servida em /api/tv/assets/[id]; nada em base64 no código).
 * Nada é digitado aqui: quem entra ou sai da equipe é editado no Painel TV
 * e esta tela reflete sozinha.
 * O mês em destaque e o "hoje" são calculados no servidor no fuso
 * America/Sao_Paulo (fuso da operação).
 */

export const dynamic = 'force-dynamic';

const MES_POR_NOME: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export type AniversarianteApi = {
  nome: string;
  dia: number;
  mes: number;
  setor: string;
  fotoUrl: string | null;
};

/** aceita o nome do mês como vem do editor da TV ("Dezembro", "DEZEMBRO"…) ou número */
function normalizarMes(valor: unknown): number {
  const s = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (MES_POR_NOME[s]) return MES_POR_NOME[s];
  const n = parseInt(s, 10);
  return n >= 1 && n <= 12 ? n : 0;
}

/** fallback: mês derivado da data de nascimento (YYYY-MM-DD) */
function mesDoNascimento(valor: unknown): number {
  const m = String(valor ?? '').match(/^\d{4}-(\d{2})/);
  const n = m ? parseInt(m[1], 10) : 0;
  return n >= 1 && n <= 12 ? n : 0;
}

const RE_FOTO = /^\/api\/tv\/assets\/[a-z0-9]{20,40}$/i;

function parseItens(raw: string | null | undefined): AniversarianteApi[] {
  if (!raw) return [];
  let itens: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(raw) as { itens?: unknown };
    itens = Array.isArray(parsed?.itens) ? (parsed.itens as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
  const out: AniversarianteApi[] = [];
  for (const it of itens) {
    if (!it || typeof it !== 'object') continue;
    const nome = String(it.nome ?? '').replace(/\s+/g, ' ').trim();
    const dia = parseInt(String(it.dia ?? ''), 10);
    const mes = normalizarMes(it.mes) || mesDoNascimento(it.nascimento);
    if (!nome || !(dia >= 1 && dia <= 31) || !mes) continue; // pula linhas vazias/inválidas do cadastro
    const foto = String(it.foto ?? '').trim();
    out.push({
      nome: nome.slice(0, 80),
      dia,
      mes,
      setor: String(it.setor ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      fotoUrl: RE_FOTO.test(foto) ? foto : null,
    });
  }
  return out.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const [sec, hoje] = await Promise.all([
    db.tvSection.findUnique({
      where: { panelSlug_sectionKey: { panelSlug: 'goias', sectionKey: 'aniversarios' } },
      select: { data: true, atualizadoEm: true, atualizadoPorNome: true },
    }),
    Promise.resolve(hojeNoFuso(TZ_PADRAO)),
  ]);

  const pessoas = parseItens(sec?.data);
  const mesAtual = parseInt(hoje.slice(5, 7), 10);
  const diaHoje = parseInt(hoje.slice(8, 10), 10);

  return NextResponse.json(
    {
      mesAtual,
      diaHoje,
      pessoas,
      total: pessoas.length,
      atualizadoEm: sec?.atualizadoEm?.toISOString() || null,
      atualizadoPor: sec?.atualizadoPorNome || null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
