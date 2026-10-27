/**
 * Escala de turno automática para o painel da TV.
 *
 * Puxa a escala base (ciclo de 8 dias da Lundin Mining — equipes A/B/C/D) e
 * aplica os lançamentos da plataforma (atestados, spots, ADMs, eventos:
 * folga/viagem/treinamento/férias/backup) exatamente com as mesmas regras do
 * EscalaModal, para que a TV mostre sozinha:
 *   - técnico do dia (diurno e noturno)
 *   - técnico de amanhã
 *   - quem está de folga / atestado / férias
 *   - quem está cobrindo quem (backup)
 *
 * Toda a aritmética de datas é feita em strings "YYYY-MM-DD" (imune a fuso).
 */
import { escalaLundinMap } from '@/data/escala-lundin';
import { db } from '@/lib/db';

export type TurnoBase = 'Manhã' | 'Noite' | 'Folga';

export interface PessoaEscala {
  letra: string;
  nome: string;
}

export interface StatusPessoaDia extends PessoaEscala {
  /** turno efetivo após lançamentos */
  efetivo: TurnoBase;
  /** trabalha nesse dia? */
  trabalha: boolean;
  /** motivo quando não trabalha: Atestado, Férias, Folga agendada, Folga */
  motivo?: string;
  /** selo extra exibido na TV (viagem, treinamento, ADM, spot, cobrindo X) */
  selo?: string;
  /** letra da pessoa que esta está cobrindo (backup) */
  cobrindoDe?: string;
}

export interface DiaEscala {
  data: string; // YYYY-MM-DD
  diaSemana: string;
  destaque: 'hoje' | 'amanha' | 'ontem' | null;
  diurno: StatusPessoaDia[];
  noturno: StatusPessoaDia[];
  fora: StatusPessoaDia[]; // folga/atestado/férias
}

export interface EscalaAuto {
  modo: 'auto';
  tz: string;
  hoje: string; // YYYY-MM-DD
  geradoEm: string; // ISO
  dias: DiaEscala[]; // ontem + hoje + amanhã + próximos 4 dias
}

/* ---------- pessoas (mesma atribuição do EscalaModal) ---------- */

export const PESSOAS: PessoaEscala[] = [
  { letra: 'A', nome: 'Weslley Siqueira' },
  { letra: 'B', nome: 'Higor Ataides' },
  { letra: 'C', nome: 'Marcos Paulo' },
  { letra: 'D', nome: 'Marcelo' },
];

const nomeDe = (letra: string): string =>
  PESSOAS.find((p) => p.letra === letra)?.nome ?? letra;

/* ---------- datas em string (imune a fuso) ---------- */

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** data de hoje (YYYY-MM-DD) no fuso informado (ex.: "America/Sao_Paulo") */
export function hojeNoFuso(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // fuso inválido → São Paulo (fuso da operação)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}

function addDias(dataStr: string, n: number): string {
  const d = new Date(`${dataStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function diaSemanaDe(dataStr: string): string {
  const d = new Date(`${dataStr}T12:00:00Z`);
  return DIAS_SEMANA[d.getUTCDay()] ?? '';
}

/** dataStr está dentro do intervalo [inicio, fim]? (strings YYYY-MM-DD) */
export function emIntervalo(dataStr: string, inicio?: string | null, fim?: string | null): boolean {
  if (!inicio || !fim || !RE_DATA.test(inicio) || !RE_DATA.test(fim)) return false;
  return dataStr >= inicio && dataStr <= fim;
}

/* ---------- turno base (Lundin + fallback ciclo 8 dias) ---------- */

/** Turno BASE do ciclo (sem lançamentos): 'Manhã' | 'Noite' | 'Folga'.
 *  Exportado para a contagem de horas do mês (escala-mes.ts). */
export function turnoBase(dataStr: string, letra: string): TurnoBase {
  const noMapa = escalaLundinMap.get(`${dataStr}_${letra}`);
  if (noMapa) {
    if (noMapa.Turno === '07:00 – 19:00') return 'Manhã';
    if (noMapa.Turno === '19:00 – 07:00') return 'Noite';
    return 'Folga';
  }
  // fallback: mesmo ciclo de 8 dias usado no EscalaModal (datas fora de maio/2026–jan/2027)
  const [y, m, d] = dataStr.split('-').map(Number);
  const start = new Date(Date.UTC(2026, 4, 1)); // 01/05/2026
  const cur = new Date(Date.UTC(y, m - 1, d));
  const diffDays = Math.round((cur.getTime() - start.getTime()) / 86400000);
  const cycleDay = ((diffDays % 8) + 8) % 8;
  const phaseIndex = Math.floor((cycleDay + 1) / 2) % 4;
  // Phase 0 (cycle day 7,0): D=Manhã, A=Noite, C/B=Folga
  // Phase 1 (cycle day 1-2): B=Manhã, D=Noite, A/C=Folga
  // Phase 2 (cycle day 3-4): C=Manhã, B=Noite, D/A=Folga
  // Phase 3 (cycle day 5-6): A=Manhã, C=Noite, B/D=Folga
  const phases: { manha: string; noite: string; folga: string[] }[] = [
    { manha: 'D', noite: 'A', folga: ['C', 'B'] },
    { manha: 'B', noite: 'D', folga: ['A', 'C'] },
    { manha: 'C', noite: 'B', folga: ['D', 'A'] },
    { manha: 'A', noite: 'C', folga: ['B', 'D'] },
  ];
  const ph = phases[phaseIndex];
  if (ph.manha === letra) return 'Manhã';
  if (ph.noite === letra) return 'Noite';
  return 'Folga';
}

/* ---------- lançamentos da plataforma (EscalaData) ---------- */

interface Atestado { person: string; startDate: string; endDate: string; }
interface Spot { person: string; startDate: string; endDate: string; horasPorDia?: number; }
interface ADM { person: string; startDate: string; endDate: string; horaInicio?: string; horaFim?: string; }
interface Evento {
  person: string;
  tipo: 'folga' | 'viagem' | 'treinamento' | 'férias' | 'backup';
  startDate: string;
  endDate: string;
  backupOf?: string;
}
interface EscalaParsed {
  atestados: Atestado[];
  spots: Spot[];
  adms: ADM[];
  eventos: Evento[];
}

const LISTA_VAZIA: EscalaParsed = { atestados: [], spots: [], adms: [], eventos: [] };

async function carregarLancamentos(): Promise<EscalaParsed> {
  try {
    const rec = await db.escalaData.findUnique({ where: { id: 1 } });
    if (!rec) return LISTA_VAZIA;
    const dados = JSON.parse(rec.dados) as Partial<EscalaParsed>;
    return {
      atestados: Array.isArray(dados.atestados) ? dados.atestados : Object.values(dados.atestados ?? {}).flat(),
      spots: Array.isArray(dados.spots) ? dados.spots : Object.values(dados.spots ?? {}).flat(),
      adms: Array.isArray(dados.adms) ? dados.adms : Object.values(dados.adms ?? {}).flat(),
      eventos: Array.isArray(dados.eventos) ? dados.eventos : Object.values(dados.eventos ?? {}).flat(),
    };
  } catch (error) {
    console.error('[escala-auto] erro ao ler EscalaData (seguindo sem lançamentos):', error);
    return LISTA_VAZIA;
  }
}
/** leitura dos lançamentos para quem monta mês/ano fora daqui */
export const lancamentosDaPlataforma = carregarLancamentos;

/* ---------- regras por pessoa/dia (espelham o EscalaModal) ---------- */

function statusDePessoa(
  letra: string,
  dataStr: string,
  lanc: EscalaParsed,
): StatusPessoaDia {
  const base = turnoBase(dataStr, letra);
  const out: StatusPessoaDia = { letra, nome: nomeDe(letra), efetivo: base, trabalha: base !== 'Folga' };

  const atestado = lanc.atestados.find((a) => a.person === letra && emIntervalo(dataStr, a.startDate, a.endDate));
  const evento = lanc.eventos.find((e) => e.person === letra && emIntervalo(dataStr, e.startDate, e.endDate));
  const spot = lanc.spots.find((s) => s.person === letra && emIntervalo(dataStr, s.startDate, s.endDate));
  const adm = lanc.adms.find((a) => a.person === letra && emIntervalo(dataStr, a.startDate, a.endDate));

  // 1) atestado → não trabalha (mesma regra do modal)
  if (atestado) {
    out.trabalha = false;
    out.motivo = 'Atestado';
    return out;
  }
  // 2) férias → não trabalha
  if (evento?.tipo === 'férias') {
    out.trabalha = false;
    out.motivo = 'Férias';
    return out;
  }
  // 3) folga agendada → não trabalha
  if (evento?.tipo === 'folga') {
    out.trabalha = false;
    out.motivo = 'Folga agendada';
    return out;
  }
  // 4) backup → assume o turno da pessoa coberta (mesma regra do modal)
  if (evento?.tipo === 'backup' && evento.backupOf && evento.backupOf !== letra) {
    const alvo = evento.backupOf;
    const baseAlvo = turnoBase(dataStr, alvo);
    out.efetivo = baseAlvo;
    out.trabalha = baseAlvo !== 'Folga';
    out.cobrindoDe = alvo;
    out.selo = `Cobrindo ${alvo} — ${nomeDe(alvo)}`;
    return out;
  }
  // 5) selos informativos (turno mantido): viagem, treinamento, ADM, spot
  const selos: string[] = [];
  if (evento?.tipo === 'viagem') selos.push('Viagem');
  if (evento?.tipo === 'treinamento') selos.push('Treinamento');
  if (adm) selos.push(`ADM${adm.horaInicio && adm.horaFim ? ` ${adm.horaInicio}–${adm.horaFim}` : ''}`);
  if (spot) selos.push(`Spot${spot.horasPorDia ? ` ${spot.horasPorDia}h` : ''}`);
  if (selos.length) out.selo = selos.join(' · ');
  return out;
}

/* ---------- montagem do dia ---------- */

function montarDia(dataStr: string, destaque: 'hoje' | 'amanha' | 'ontem' | null, lanc: EscalaParsed): DiaEscala {
  const status = PESSOAS.map((p) => statusDePessoa(p.letra, dataStr, lanc));
  return {
    data: dataStr,
    diaSemana: diaSemanaDe(dataStr),
    destaque,
    diurno: status.filter((s) => s.trabalha && s.efetivo === 'Manhã'),
    noturno: status.filter((s) => s.trabalha && s.efetivo === 'Noite'),
    fora: status.filter((s) => !s.trabalha),
  };
}
export { montarDia };

export const TZ_PADRAO = 'America/Sao_Paulo';

/** Calcula a escala automática de ONTEM até hoje+5 no fuso informado.
 *  A TV mostra ontem/hoje/amanhã (o relatório técnico do turno de ontem é
 *  entregue na manhã seguinte — por isso ontem continua relevante). */
export async function computarEscalaAuto(tz: string = TZ_PADRAO): Promise<EscalaAuto> {
  const hoje = hojeNoFuso(tz || TZ_PADRAO);
  const lanc = await carregarLancamentos();
  const dias: DiaEscala[] = [];
  for (let i = -1; i < 6; i++) {
    const dataStr = addDias(hoje, i);
    dias.push(montarDia(dataStr, i === -1 ? 'ontem' : i === 0 ? 'hoje' : i === 1 ? 'amanha' : null, lanc));
  }
  return {
    modo: 'auto',
    tz: tz || TZ_PADRAO,
    hoje,
    geradoEm: new Date().toISOString(),
    dias,
  };
}

/**
 * Versão à prova de falhas para o GET /content: se algo der errado,
 * retorna null e a TV continua no ar com o resto do conteúdo.
 */
export async function computarEscalaAutoSeguro(tz?: string): Promise<EscalaAuto | null> {
  try {
    return await computarEscalaAuto(tz);
  } catch (error) {
    console.error('[escala-auto] falha ao calcular escala automática:', error);
    return null;
  }
}
