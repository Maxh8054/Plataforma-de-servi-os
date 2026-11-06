/**
 * Exportação da Escala de Turno para Excel (.xlsx) — botão "Exportar Excel"
 * na própria aba Escala de Turno (EscalaModal).
 *
 * O usuário escolhe o período "data até data" (qualquer intervalo, mesmo
 * atravessando meses). Gera um arquivo com 3 abas:
 *   Escala    — grade do período: uma linha por dia, uma coluna por técnico,
 *               com o turno EFETIVO (atestado/férias/folga agendada/cobrindo X).
 *   Marcações — atestados, spots, ADMs e eventos que caem dentro do período.
 *               Se NÃO houver marcações nas datas escolhidas, puxa automaticamente
 *               das datas mais próximas que têm registro (com aviso na planilha).
 *   Resumo    — dias por turno e horas previstas (11h/turno) por técnico.
 *
 * Usa a MESMA regra de turno base do resto da plataforma (turnoBase de
 * escala-auto.ts — tabela Lundin + fallback do ciclo de 8 dias) e as MESMAS
 * observações do EscalaModal, então o Excel sai igualzinho ao que a aba mostra.
 */
import * as XLSX from 'xlsx';
import { turnoBase } from '@/lib/escala-auto';

export type ChavePessoa = 'A' | 'B' | 'C' | 'D' | 'E';

interface PeriodoX { startDate: string; endDate: string; }
export interface AtestadoX extends PeriodoX { porHora: boolean; horas: number; }
export interface SpotX extends PeriodoX { horasPorDia: number; }
export interface AdmX extends PeriodoX { horaInicio: string; horaFim: string; }
export interface EventoX extends PeriodoX {
  tipo: 'folga' | 'viagem' | 'treinamento' | 'férias' | 'backup';
  horas: number;
  operacao: 'adicionar' | 'subtrair';
  backupOf?: ChavePessoa;
}

export interface DadosEscalaX {
  atestados: Partial<Record<ChavePessoa, AtestadoX[]>>;
  spots: Partial<Record<ChavePessoa, SpotX[]>>;
  adms: Partial<Record<ChavePessoa, AdmX[]>>;
  eventos: Partial<Record<ChavePessoa, EventoX[]>>;
}

export interface PessoaX { letra: ChavePessoa; nome: string; }

/** Período "data até data" escolhido no diálogo do Exportar Excel (ISO aaaa-mm-dd). */
export interface PeriodoExport { deISO: string; ateISO: string; }

const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIA_NOMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const ROTULO_TURNO: Record<string, string> = {
  'Manhã': 'Manhã 07:00–19:00',
  'Noite': 'Noite 19:00–07:00',
  'Folga': 'Folga',
};

const fmt2 = (n: number) => String(n).padStart(2, '0');
const dataISO = (ano: number, mes0: number, dia: number) => `${ano}-${fmt2(mes0 + 1)}-${fmt2(dia)}`;
const fmtBR = (iso: string) => { const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

const MAIUSCULA = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const parseISO = (iso: string) => {
  const p = iso.split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
};
const addDias = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return dataISO(d.getFullYear(), d.getMonth(), d.getDate());
};
const diffDias = (a: string, b: string) =>
  Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
const isoValido = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Distância em dias entre o período [de..ate] e um lançamento [s..e] — 0 = cai dentro (ou atravessa). */
const distDoLanc = (s: string, e: string, de: string, ate: string) =>
  e < de ? diffDias(de, e) : s > ate ? diffDias(s, ate) : 0;

/** primeiro marcador que vale para a pessoa no dia — MESMA prioridade do efetivoNoDia do EscalaModal */
function efetivoNoDia(dados: DadosEscalaX | null, letra: ChavePessoa, iso: string): { turno: string; obs: string } {
  const at = (dados?.atestados?.[letra] || []).find((a) => a.startDate && a.endDate && iso >= a.startDate && iso <= a.endDate);
  if (at) return { turno: 'Folga', obs: 'Atestado' };
  const ev = (dados?.eventos?.[letra] || []).find((e) => e.startDate && e.endDate && iso >= e.startDate && iso <= e.endDate);
  if (ev?.tipo === 'férias') return { turno: 'Folga', obs: 'Férias' };
  if (ev?.tipo === 'folga') return { turno: 'Folga', obs: 'Folga agendada' };
  if (ev?.tipo === 'backup' && ev.backupOf) {
    return { turno: turnoBase(iso, ev.backupOf), obs: `Cobrindo ${ev.backupOf}` };
  }
  return { turno: turnoBase(iso, letra), obs: '' };
}

interface LinhaMar {
  tipo: string; letra: string; nome: string; ini: string; fim: string; det: string; dist: number;
}

export function montarPlanilhaEscala(opts: {
  /** modo antigo (mês inteiro) — usado quando não vem `periodo` */
  ano?: number;
  mes?: number; // 0–11
  /** modo novo: "data até data" escolhido pelo usuário */
  periodo?: PeriodoExport | null;
  dados: DadosEscalaX | null;
  pessoas: PessoaX[];
}): XLSX.WorkBook {
  const { dados, pessoas } = opts;

  // Resolve o período: "data até data" do diálogo, ou o mês inteiro (modo antigo)
  let deISO: string;
  let ateISO: string;
  if (isoValido(opts.periodo?.deISO) && isoValido(opts.periodo?.ateISO)) {
    deISO = opts.periodo!.deISO <= opts.periodo!.ateISO ? opts.periodo!.deISO : opts.periodo!.ateISO;
    ateISO = opts.periodo!.deISO <= opts.periodo!.ateISO ? opts.periodo!.ateISO : opts.periodo!.deISO;
  } else if (typeof opts.ano === 'number' && typeof opts.mes === 'number') {
    const diasNoMes = new Date(opts.ano, opts.mes + 1, 0).getDate();
    deISO = dataISO(opts.ano, opts.mes, 1);
    ateISO = dataISO(opts.ano, opts.mes, diasNoMes);
  } else {
    const hoje = new Date();
    deISO = ateISO = dataISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  }

  const mesesCobertos: string[] = [];
  for (let iso = deISO; iso <= ateISO; iso = addDias(iso, 1)) {
    const dt = parseISO(iso);
    const rot = `${MES_NOMES[dt.getMonth()]} / ${dt.getFullYear()}`;
    if (!mesesCobertos.includes(rot)) mesesCobertos.push(rot);
  }

  const agora = new Date();
  const exportadoEm = `${fmt2(agora.getDate())}/${fmt2(agora.getMonth() + 1)}/${agora.getFullYear()} ${fmt2(agora.getHours())}:${fmt2(agora.getMinutes())}`;

  const wb = XLSX.utils.book_new();

  /* ---- aba 1: ESCALA (grade do período) ---- */
  const aoa: (string | number)[][] = [
    ['Escala de Turno — Lundin Mining'],
    [`Período: ${fmtBR(deISO)} a ${fmtBR(ateISO)}`],
    [`Meses: ${mesesCobertos.join(' · ')}`],
    [`Exportado da aba Escala de Turno (ZAMine) em ${exportadoEm}`],
    [],
    ['Data', 'Dia da semana', ...pessoas.map((p) => `${p.letra} · ${p.nome}`)],
  ];
  for (let iso = deISO; iso <= ateISO; iso = addDias(iso, 1)) {
    const dia = parseISO(iso);
    const linha: (string | number)[] = [fmtBR(iso), DIA_NOMES[dia.getDay()]];
    for (const p of pessoas) {
      const { turno, obs } = efetivoNoDia(dados, p.letra, iso);
      const rot = ROTULO_TURNO[turno] || turno;
      linha.push(obs ? `${rot} (${obs})` : rot);
    }
    aoa.push(linha);
  }
  const wsEscala = XLSX.utils.aoa_to_sheet(aoa);
  wsEscala['!cols'] = [{ wch: 11 }, { wch: 14 }, ...pessoas.map(() => ({ wch: 32 }))];
  XLSX.utils.book_append_sheet(wb, wsEscala, 'Escala');

  /* ---- aba 2: MARCAÇÕES (lançamentos do período, com fallback "data mais perto que tem") ---- */
  const todas: LinhaMar[] = [];
  for (const p of pessoas) {
    const L = p.letra;
    for (const a of dados?.atestados?.[L] || []) {
      if (!a.startDate || !a.endDate) continue;
      todas.push({
        tipo: 'Atestado', letra: L, nome: p.nome, ini: a.startDate, fim: a.endDate,
        det: a.porHora ? `${a.horas}h` : '11h/dia',
        dist: distDoLanc(a.startDate, a.endDate, deISO, ateISO),
      });
    }
    for (const s of dados?.spots?.[L] || []) {
      if (!s.startDate || !s.endDate) continue;
      todas.push({
        tipo: 'Spot', letra: L, nome: p.nome, ini: s.startDate, fim: s.endDate,
        det: `${s.horasPorDia}h/dia`,
        dist: distDoLanc(s.startDate, s.endDate, deISO, ateISO),
      });
    }
    for (const a of dados?.adms?.[L] || []) {
      if (!a.startDate || !a.endDate) continue;
      todas.push({
        tipo: 'ADM', letra: L, nome: p.nome, ini: a.startDate, fim: a.endDate,
        det: `${a.horaInicio || '—'} às ${a.horaFim || '—'}`,
        dist: distDoLanc(a.startDate, a.endDate, deISO, ateISO),
      });
    }
    for (const e of dados?.eventos?.[L] || []) {
      if (!e.startDate || !e.endDate) continue;
      todas.push({
        tipo: MAIUSCULA(e.tipo), letra: L, nome: p.nome, ini: e.startDate, fim: e.endDate,
        det: `${e.operacao === 'adicionar' ? '+' : '-'}${e.horas}h${e.tipo === 'backup' && e.backupOf ? ` · cobrindo ${e.backupOf}` : ''}`,
        dist: distDoLanc(e.startDate, e.endDate, deISO, ateISO),
      });
    }
  }

  // Só as que caem no período; se não tiver NENHUMA, puxa da data mais próxima que tem registro
  let linhas = todas.filter((r) => r.dist === 0);
  let notaFallback = '';
  if (linhas.length === 0 && todas.length > 0) {
    const minDist = Math.min(...todas.map((r) => r.dist));
    if (minDist <= 366) {
      linhas = todas.filter((r) => r.dist === minDist);
      const ini = linhas.reduce((m, r) => (r.ini < m ? r.ini : m), linhas[0].ini);
      const fim = linhas.reduce((m, r) => (r.fim > m ? r.fim : m), linhas[0].fim);
      notaFallback =
        `Nenhuma marcação no período selecionado (${fmtBR(deISO)} a ${fmtBR(ateISO)}) — ` +
        `puxado da data mais próxima que tem registro: ${fmtBR(ini)} a ${fmtBR(fim)}.`;
    }
  }
  linhas.sort((x, y) => (x.ini < y.ini ? -1 : x.ini > y.ini ? 1 : x.letra.localeCompare(y.letra)));

  const mar: (string | number)[][] = [
    ['Tipo', 'Letra', 'Colaborador', 'Início', 'Fim', 'Detalhe'],
  ];
  if (notaFallback) mar.push([`⚠ ${notaFallback}`, '', '', '', '', '']);
  for (const r of linhas) mar.push([r.tipo, r.letra, r.nome, fmtBR(r.ini), fmtBR(r.fim), r.det]);
  if (linhas.length === 0) mar.push(['—', '', 'Nenhuma marcação encontrada', '', '', '']);

  const wsMarc = XLSX.utils.aoa_to_sheet(mar);
  wsMarc['!cols'] = [{ wch: 14 }, { wch: 7 }, { wch: 30 }, { wch: 11 }, { wch: 11 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsMarc, 'Marcações');

  /* ---- aba 3: RESUMO (dias por turno e horas previstas no período) ---- */
  const res: (string | number)[][] = [
    ['Letra', 'Colaborador', 'Manhã (dias)', 'Noite (dias)', 'Folga (dias)', 'Atestado (dias)', 'Férias (dias)', 'Folga agendada (dias)', 'Dias trabalhados', 'Horas previstas (11h/turno)'],
  ];
  for (const p of pessoas) {
    const cnt = { 'Manhã': 0, 'Noite': 0, 'Folga': 0, 'Atestado': 0, 'Férias': 0, 'Folga agendada': 0 };
    for (let iso = deISO; iso <= ateISO; iso = addDias(iso, 1)) {
      const { turno, obs } = efetivoNoDia(dados, p.letra, iso);
      if (obs && obs in cnt) cnt[obs as keyof typeof cnt] += 1;
      else if (turno in cnt) cnt[turno as keyof typeof cnt] += 1;
    }
    const trabalhados = cnt['Manhã'] + cnt['Noite'];
    res.push([
      p.letra, p.nome, cnt['Manhã'], cnt['Noite'], cnt['Folga'],
      cnt['Atestado'], cnt['Férias'], cnt['Folga agendada'],
      trabalhados, `${trabalhados * 11}h`,
    ]);
  }
  const wsRes = XLSX.utils.aoa_to_sheet(res);
  wsRes['!cols'] = [{ wch: 7 }, { wch: 30 }, ...Array(8).fill({ wch: 13 })];
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo');

  return wb;
}

/** Gera e baixa o arquivo. No navegador dispara o download; retorna o nome do arquivo. */
export function baixarExcelEscala(opts: {
  ano?: number;
  mes?: number;
  periodo?: PeriodoExport | null;
  dados: DadosEscalaX | null;
  pessoas: PessoaX[];
}): string {
  const wb = montarPlanilhaEscala(opts);
  const nome = opts.periodo?.deISO && opts.periodo?.ateISO
    ? `escala-${opts.periodo.deISO}_a_${opts.periodo.ateISO}.xlsx`
    : `escala-${MES_NOMES[opts.mes ?? new Date().getMonth()].toLowerCase()}-${opts.ano ?? new Date().getFullYear()}.xlsx`;
  XLSX.writeFile(wb, nome);
  return nome;
}
