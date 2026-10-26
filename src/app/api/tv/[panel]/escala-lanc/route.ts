import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, podeEditarSecao } from '@/lib/tv';
import { PESSOAS } from '@/lib/escala-auto';

/**
 * Lançamentos da ESCALA DE TURNO editáveis pelo próprio painel da TV
 * (aba Escala de turno → "Lançamentos da plataforma"):
 *
 *   GET  → atestados, spots (com horas/dia), ADMs, eventos + entregas do
 *          RELATÓRIO DE TURNO (por dia/técnico) + pessoas das equipes A-D
 *   POST → salva tudo no MESMO lugar de onde a plataforma e a TV já leem
 *          (EscalaData + RelatorioTecnico), com auditoria.
 *
 * Permissão: admin OU permissão de edição da aba "escala" do painel.
 */

export const dynamic = 'force-dynamic';

const LETRAS = ['A', 'B', 'C', 'D'];
const TIPOS_EVENTO = ['folga', 'viagem', 'treinamento', 'férias', 'backup'];
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{1,2}:\d{2}$/;

type Linha = Record<string, unknown>;

const dataOk = (v: unknown): v is string => typeof v === 'string' && RE_DATA.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const horaOk = (v: unknown): v is string => typeof v === 'string' && RE_HORA.test(v);
const letraOk = (v: unknown): v is string => typeof v === 'string' && LETRAS.includes(v);

function intervalo(x: Linha): { person: string; startDate: string; endDate: string } | null {
  if (!letraOk(x.person) || !dataOk(x.startDate) || !dataOk(x.endDate) || x.startDate > x.endDate) return null;
  return { person: x.person, startDate: x.startDate, endDate: x.endDate };
}

function limparLista(arr: unknown, tipo: string): Linha[] {
  if (!Array.isArray(arr)) return [];
  const out: Linha[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const x = raw as Linha;
    const base = intervalo(x);
    if (!base) continue;
    if (tipo === 'spots') {
      const h = Number(x.horasPorDia);
      out.push({ ...base, ...(Number.isFinite(h) && h > 0 ? { horasPorDia: Math.round(h * 10) / 10 } : {}) });
    } else if (tipo === 'adms') {
      const hi = horaOk(x.horaInicio) ? x.horaInicio : '';
      const hf = horaOk(x.horaFim) ? x.horaFim : '';
      out.push({ ...base, ...(hi && hf ? { horaInicio: hi, horaFim: hf } : {}) });
    } else if (tipo === 'eventos') {
      const tipoEv = typeof x.tipo === 'string' && TIPOS_EVENTO.includes(x.tipo) ? x.tipo : 'folga';
      const backupOf = tipoEv === 'backup' && letraOk(x.backupOf) && x.backupOf !== base.person ? x.backupOf : undefined;
      out.push({ ...base, tipo: tipoEv, ...(backupOf ? { backupOf } : {}) });
    } else {
      out.push({ ...base });
    }
  }
  return out;
}

/** entregas do relatório de turno salvas no banco (janela generosa: tudo que existe) */
async function lerRelatorios() {
  const rows = await db.relatorioTecnico.findMany({
    orderBy: [{ data: 'desc' }, { letra: 'asc' }],
    take: 600,
    select: { data: true, letra: true, entregue: true, atualizadoEm: true, atualizadoPor: true },
  });
  return rows.map((r) => ({
    data: r.data,
    letra: r.letra,
    entregue: r.entregue,
    atualizadoEm: r.atualizadoEm.toISOString(),
    atualizadoPor: r.atualizadoPor,
  }));
}

async function lerLancamentos() {
  const rec = await db.escalaData.findUnique({ where: { id: 1 } });
  const vazio = { atestados: [], spots: [], adms: [], eventos: [] };
  if (!rec) return vazio;
  try {
    const dados = JSON.parse(rec.dados) as Partial<typeof vazio>;
    return {
      atestados: Array.isArray(dados.atestados) ? dados.atestados : [],
      spots: Array.isArray(dados.spots) ? dados.spots : [],
      adms: Array.isArray(dados.adms) ? dados.adms : [],
      eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
    };
  } catch {
    return vazio;
  }
}

/**
 * GET /api/tv/[panel]/escala-lanc — dados para o editor (abas Lançamentos).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma.' }, { status: 401 });
  if (!(await podeEditarSecao(panel, user, 'escala'))) {
    return NextResponse.json({ error: 'Você não tem permissão para editar a escala deste painel.' }, { status: 403 });
  }
  try {
    const [lancamentos, relatorios] = await Promise.all([lerLancamentos(), lerRelatorios()]);
    return NextResponse.json({ lancamentos, relatorios, pessoas: PESSOAS }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[tv/escala-lanc] erro ao ler:', error);
    return NextResponse.json({ error: 'Erro ao carregar os lançamentos da escala.' }, { status: 500 });
  }
}

interface CorpoLanc {
  lancamentos?: { atestados?: unknown; spots?: unknown; adms?: unknown; eventos?: unknown };
  relatorios?: unknown;
  removerRelatorios?: unknown;
}

/**
 * POST /api/tv/[panel]/escala-lanc — salva lançamentos + entregas de relatório.
 * Body: { lancamentos:{atestados,spots,adms,eventos}, relatorios:[{data,letra,entregue}], removerRelatorios:[{data,letra}] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma.' }, { status: 401 });
  if (!(await podeEditarSecao(panel, user, 'escala'))) {
    return NextResponse.json({ error: 'Você não tem permissão para editar a escala deste painel.' }, { status: 403 });
  }

  let body: CorpoLanc = {};
  try {
    body = await request.json();
  } catch {
    /* body vazio */
  }

  try {
    const lanc = body.lancamentos ?? {};
    const limpos = {
      atestados: limparLista(lanc.atestados, 'atestados'),
      spots: limparLista(lanc.spots, 'spots'),
      adms: limparLista(lanc.adms, 'adms'),
      eventos: limparLista(lanc.eventos, 'eventos'),
    };

    // entregas de relatório: válidas → upsert; pedir remoção → delete
    const relatoriosIn = Array.isArray(body.relatorios) ? (body.relatorios as Linha[]) : [];
    const paraSalvar: { data: string; letra: string; entregue: boolean }[] = [];
    for (const r of relatoriosIn) {
      if (!r || typeof r !== 'object') continue;
      if (!dataOk(r.data) || !letraOk(r.letra) || typeof r.entregue !== 'boolean') continue;
      paraSalvar.push({ data: r.data, letra: r.letra, entregue: r.entregue });
    }
    const paraRemover: { data: string; letra: string }[] = [];
    if (Array.isArray(body.removerRelatorios)) {
      for (const r of body.removerRelatorios as Linha[]) {
        if (!r || typeof r !== 'object') continue;
        if (!dataOk(r.data) || !letraOk(r.letra)) continue;
        paraRemover.push({ data: r.data, letra: r.letra });
      }
    }

    await db.$transaction([
      db.escalaData.upsert({
        where: { id: 1 },
        update: { dados: JSON.stringify(limpos) },
        create: { id: 1, dados: JSON.stringify(limpos) },
      }),
      ...paraSalvar.map((r) =>
        db.relatorioTecnico.upsert({
          where: { data_letra: r },
          update: { entregue: r.entregue, atualizadoPor: user.name || user.email },
          create: { data: r.data, letra: r.letra, entregue: r.entregue, atualizadoPor: user.name || user.email },
        })
      ),
      ...paraRemover.map((r) =>
        db.relatorioTecnico.deleteMany({ where: { data: r.data, letra: r.letra } })
      ),
    ]);

    auditLog({
      action: 'tv_config_salva',
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      details: `painel=${panel} lançamentos da escala (atestados ${limpos.atestados.length}, spots ${limpos.spots.length}, adms ${limpos.adms.length}, eventos ${limpos.eventos.length}, relatórios ${paraSalvar.length}${paraRemover.length ? `, removidos ${paraRemover.length}` : ''})`,
    });

    const [lancamentos, relatorios] = await Promise.all([lerLancamentos(), lerRelatorios()]);
    return NextResponse.json({ ok: true, lancamentos, relatorios, pessoas: PESSOAS });
  } catch (error) {
    console.error('[tv/escala-lanc] erro ao salvar:', error);
    return NextResponse.json({ error: 'Erro ao salvar os lançamentos da escala.' }, { status: 500 });
  }
}
