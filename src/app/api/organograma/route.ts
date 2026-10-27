import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionToken, validateSession, isAdminRole } from '@/lib/auth';

/**
 * Organograma da plataforma (botão "Organograma" no rodapé).
 *
 * GET  — usuário autenticado: retorna a lista de pessoas (do banco; sem registro,
 *        usa o layout padrão em código) com as FOTOS RESOLVIDAS AUTOMATICAMENTE
 *        PELO NOME a partir do cadastro de colaboradores do painel TV
 *        (aba Aniversariantes → TvAsset, servidas em /api/tv/assets/[id]).
 * POST — somente admin: salva a lista completa (editar/adicionar/remover pessoas
 *        quando a equipe crescer).
 */

export const dynamic = 'force-dynamic';

export type OrganogramaPosicao = 'linha' | 'acima' | 'abaixo' | 'base';

export type OrganogramaPessoa = {
  id: string;
  nome: string;
  cargo: string;
  posicao: OrganogramaPosicao;
  fileira: number; // só faz sentido para acima/abaixo: coluna depois da linha do meio
  ligacao: 'continua' | 'tracejada';
  vaga: boolean;
};

export type OrganogramaPessoaApi = OrganogramaPessoa & { fotoUrl: string | null };

// Layout padrão (mesmo desenho do arquivo de referência enviado pelo Max):
// 3 cartões na linha central + colunas de cima/baixo + base lateral de mecânicos.
// Vale enquanto ninguém tiver salvo nada no banco; depois o banco manda.
const PESSOAS_PADRAO: OrganogramaPessoa[] = [
  { id: 'p-julio', nome: 'Julio Sanches', cargo: 'Service Manager', posicao: 'linha', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-wallysson', nome: 'Wallysson Santos', cargo: 'Service Coordinator', posicao: 'linha', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-fabricio', nome: 'Fabricio Cesar', cargo: 'Service Supervisor', posicao: 'linha', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-emerson', nome: 'Emerson Alexandre', cargo: 'Field Technical Specialist', posicao: 'abaixo', fileira: 1, ligacao: 'continua', vaga: false },
  { id: 'p-ranielly', nome: 'Ranielly Souza', cargo: 'Administrative Assistant', posicao: 'acima', fileira: 2, ligacao: 'continua', vaga: false },
  { id: 'p-girlene', nome: 'Girlene Nogueira', cargo: 'Safety Technician', posicao: 'abaixo', fileira: 2, ligacao: 'continua', vaga: false },
  { id: 'p-vaga', nome: '', cargo: 'Specialist Technician', posicao: 'acima', fileira: 3, ligacao: 'continua', vaga: true },
  { id: 'p-marlon', nome: 'Marlon Mendes', cargo: 'Sales Department', posicao: 'abaixo', fileira: 3, ligacao: 'tracejada', vaga: false },
  { id: 'p-max', nome: 'Max Rufino', cargo: 'Service Assistant', posicao: 'acima', fileira: 4, ligacao: 'continua', vaga: false },
  { id: 'p-marcos-rosa', nome: 'Marcos Rosa', cargo: 'Warehouse Assistant', posicao: 'abaixo', fileira: 4, ligacao: 'continua', vaga: false },
  { id: 'p-weslley', nome: 'Weslley Ferreira', cargo: 'Mechanical Technician', posicao: 'base', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-marcos-paulo', nome: 'Marcos Paulo', cargo: 'Mechanical Technician', posicao: 'base', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-marcelo', nome: 'Marcelo Gonçalves', cargo: 'Mechanical Technician', posicao: 'base', fileira: 0, ligacao: 'continua', vaga: false },
  { id: 'p-higor', nome: 'Higor Ataides', cargo: 'Mechanical Technician', posicao: 'base', fileira: 0, ligacao: 'continua', vaga: false },
];

const POSICOES: OrganogramaPosicao[] = ['linha', 'acima', 'abaixo', 'base'];

/** Normaliza um nome em tokens: MAIÚSCULAS, sem acento, só letras (Sanches → [SANCHES]) */
function tokens(nome: string): string[] {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

type Colaborador = { nome: string; toks: string[]; fotoId: string };

/** Cadastro de colaboradores com foto: aba Aniversariantes do painel TV (goias) */
async function carregarColaboradores(): Promise<Colaborador[]> {
  const sec = await db.tvSection.findUnique({
    where: { panelSlug_sectionKey: { panelSlug: 'goias', sectionKey: 'aniversarios' } },
    select: { data: true },
  });
  if (!sec) return [];
  let itens: Array<{ nome?: string; foto?: string }> = [];
  try {
    const parsed = JSON.parse(sec.data || '{}');
    itens = Array.isArray(parsed.itens) ? parsed.itens : [];
  } catch {
    return [];
  }
  const cols: Colaborador[] = [];
  for (const it of itens) {
    const nome = String(it?.nome || '').trim();
    const foto = String(it?.foto || '').trim();
    if (!nome || !foto) continue;
    // foto vem como "/api/tv/assets/<id>" ou "<id>"
    const m = foto.match(/([a-z0-9]{20,40})\/?$/i);
    if (!m) continue;
    cols.push({ nome, toks: tokens(nome), fotoId: m[1] });
  }
  return cols;
}

/**
 * Casamento por nome: todos os tokens do nome do organograma precisam existir
 * no nome completo do colaborador (ex.: "Max Rufino" ⊆ "MAX HENRIQUE ... RUFINO").
 * Fallback: primeiro token único (ex.: "Fabricio Cesar" → FABRICIO CEZAR DE ALMEIDA).
 * Empate: o nome completo mais curto (menos tokens).
 */
function resolverFoto(pessoa: OrganogramaPessoa, cols: Colaborador[]): string | null {
  if (pessoa.vaga) return null;
  const q = tokens(pessoa.nome);
  if (!q.length) return null;
  const candidatos = cols.filter((c) => q.every((t) => c.toks.includes(t)));
  let escolhido: Colaborador | undefined;
  if (candidatos.length) {
    escolhido = candidatos.sort((a, b) => a.toks.length - b.toks.length)[0];
  } else {
    const primeiro = q[0];
    const pelosPrimeiros = cols.filter((c) => c.toks[0] === primeiro);
    if (pelosPrimeiros.length === 1) escolhido = pelosPrimeiros[0];
  }
  return escolhido ? `/api/tv/assets/${escolhido.fotoId}` : null;
}

function parsePessoas(raw: string): OrganogramaPessoa[] | null {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return null;
    const out: OrganogramaPessoa[] = [];
    for (const p of arr) {
      if (!p || typeof p !== 'object') continue;
      const posicao = String(p.posicao || '');
      if (!POSICOES.includes(posicao as OrganogramaPosicao)) continue;
      const fileiraN = Math.max(0, Math.min(24, parseInt(p.fileira, 10) || 0));
      out.push({
        id: String(p.id || `p-${out.length + 1}`).slice(0, 40),
        nome: String(p.nome || '').trim().slice(0, 80),
        cargo: String(p.cargo || '').trim().slice(0, 80),
        posicao: posicao as OrganogramaPosicao,
        fileira: posicao === 'acima' || posicao === 'abaixo' ? Math.max(1, fileiraN) : 0,
        ligacao: p.ligacao === 'tracejada' ? 'tracejada' : 'continua',
        vaga: !!p.vaga,
      });
    }
    return out.length ? out.slice(0, 80) : null;
  } catch {
    return null;
  }
}

async function responder(user: { name: string | null; email: string } | null) {
  const registro = await db.organogramaData.findUnique({ where: { id: 1 } });
  const pessoas = (registro ? parsePessoas(registro.dados) : null) || PESSOAS_PADRAO;
  const cols = await carregarColaboradores();
  const comFotos: OrganogramaPessoaApi[] = pessoas.map((p) => ({
    ...p,
    fotoUrl: resolverFoto(p, cols),
  }));
  return NextResponse.json({
    pessoas: comFotos,
    atualizadoEm: registro?.atualizadoEm?.toISOString() || null,
    atualizadoPor: registro?.atualizadoPor || null,
    padrao: !registro,
  });
}

export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return responder({ name: user.name, email: user.email });
}

export async function POST(request: NextRequest) {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Somente administradores podem editar o organograma' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const pessoas = parsePessoas(JSON.stringify((body as { pessoas?: unknown[] })?.pessoas ?? []));
  if (!pessoas) {
    return NextResponse.json({ error: 'Lista de pessoas inválida (precisa de pelo menos uma pessoa)' }, { status: 400 });
  }
  // sanidade: precisa existir alguém na linha central para a espinha do desenho
  if (!pessoas.some((p) => p.posicao === 'linha')) {
    return NextResponse.json({ error: 'O organograma precisa de pelo menos uma pessoa na "Linha central"' }, { status: 400 });
  }

  const autor = user.name || user.email;
  await db.organogramaData.upsert({
    where: { id: 1 },
    create: { id: 1, dados: JSON.stringify(pessoas), atualizadoEm: new Date(), atualizadoPor: autor },
    update: { dados: JSON.stringify(pessoas), atualizadoEm: new Date(), atualizadoPor: autor },
  });

  return responder({ name: user.name, email: user.email });
}
