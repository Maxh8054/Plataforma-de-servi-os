/**
 * Exportação da Escala de Turno para Excel (.xlsx) — botão "Exportar Excel"
 * na própria aba Escala de Turno (EscalaModal).
 *
 * Gera um arquivo com 3 abas:
 *   Escala    — grade do mês: uma linha por dia, uma coluna por técnico,
 *               com o turno EFETIVO (atestado/férias/folga agendada/cobrindo X).
 *   Marcações — atestados, spots, ADMs e eventos que caem dentro do mês.
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

function entradasNoMes<T extends PeriodoX>(lista: T[] | undefined, primeiroISO: string, ultimoISO: string): T[] {
  return (lista || []).filter((e) => e.startDate && e.endDate && e.endDate >= primeiroISO && e.startDate <= ultimoISO);
}

export function montarPlanilhaEscala(opts: {
  ano: number;
  mes: number; // 0–11
  dados: DadosEscalaX | null;
  pessoas: PessoaX[];
}): XLSX.WorkBook {
  const { ano, mes, dados, pessoas } = opts;
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroISO = dataISO(ano, mes, 1);
  const ultimoISO = dataISO(ano, mes, diasNoMes);
  const agora = new Date();
  const exportadoEm = `${fmt2(agora.getDate())}/${fmt2(agora.getMonth() + 1)}/${agora.getFullYear()} ${fmt2(agora.getHours())}:${fmt2(agora.getMinutes())}`;

  const wb = XLSX.utils.book_new();

  /* ---- aba 1: ESCALA (grade do mês) ---- */
  const aoa: (string | number)[][] = [
    ['Escala de Turno — Lundin Mining'],
    [`${MES_NOMES[mes]} / ${ano}`],
    [`Exportado da aba Escala de Turno (ZAMine) em ${exportadoEm}`],
    [],
    ['Data', 'Dia da semana', ...pessoas.map((p) => `${p.letra} · ${p.nome}`)],
  ];
  for (let d = 1; d <= diasNoMes; d++) {
    const dia = new Date(ano, mes, d);
    const iso = dataISO(ano, mes, d);
    const linha: (string | number)[] = [fmtBR(iso), DIA_NOMES[dia.getDay()]];
    for (const p of pessoas) {
      const { turno, obs } = efetivoNoDia(dados, p.letra, iso);
      linha.push(obs ? `${ROTULO_TURNO[turno]} (${obs})` : ROTULO_TURNO[turno]);
    }
    aoa.push(linha);
  }
  const wsEscala = XLSX.utils.aoa_to_sheet(aoa);
  wsEscala['!cols'] = [{ wch: 11 }, { wch: 14 }, ...pessoas.map(() => ({ wch: 32 }))];
  XLSX.utils.book_append_sheet(wb, wsEscala, 'Escala');

  /* ---- aba 2: MARCAÇÕES (lançamentos do mês) ---- */
  const mar: (string | number)[][] = [
    ['Tipo', 'Letra', 'Colaborador', 'Início', 'Fim', 'Detalhe'],
  ];
  for (const p of pessoas) {
    const L = p.letra;
    for (const a of entradasNoMes(dados?.atestados?.[L], primeiroISO, ultimoISO)) {
      mar.push(['Atestado', L, p.nome, fmtBR(a.startDate), fmtBR(a.endDate), a.porHora ? `${a.horas}h` : '11h/dia']);
    }
    for (const s of entradasNoMes(dados?.spots?.[L], primeiroISO, ultimoISO)) {
      mar.push(['Spot', L, p.nome, fmtBR(s.startDate), fmtBR(s.endDate), `${s.horasPorDia}h/dia`]);
    }
    for (const a of entradasNoMes(dados?.adms?.[L], primeiroISO, ultimoISO)) {
      mar.push(['ADM', L, p.nome, fmtBR(a.startDate), fmtBR(a.endDate), `${a.horaInicio || '—'} às ${a.horaFim || '—'}`]);
    }
    for (const e of entradasNoMes(dados?.eventos?.[L], primeiroISO, ultimoISO)) {
      const detalhe = `${e.operacao === 'adicionar' ? '+' : '-'}${e.horas}h${e.tipo === 'backup' && e.backupOf ? ` · cobrindo ${e.backupOf}` : ''}`;
      mar.push([MAIUSCULA(e.tipo), L, p.nome, fmtBR(e.startDate), fmtBR(e.endDate), detalhe]);
    }
  }
  const wsMarc = XLSX.utils.aoa_to_sheet(mar.length > 1 ? mar : [['Tipo', 'Letra', 'Colaborador', 'Início', 'Fim', 'Detalhe'], ['—', '', 'Nenhuma marcação neste mês', '', '', '']]);
  wsMarc['!cols'] = [{ wch: 14 }, { wch: 7 }, { wch: 30 }, { wch: 11 }, { wch: 11 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsMarc, 'Marcações');

  /* ---- aba 3: RESUMO (dias por turno e horas previstas) ---- */
  const res: (string | number)[][] = [
    ['Letra', 'Colaborador', 'Manhã (dias)', 'Noite (dias)', 'Folga (dias)', 'Atestado (dias)', 'Férias (dias)', 'Folga agendada (dias)', 'Dias trabalhados', 'Horas previstas (11h/turno)'],
  ];
  for (const p of pessoas) {
    const cnt = { 'Manhã': 0, 'Noite': 0, 'Folga': 0, 'Atestado': 0, 'Férias': 0, 'Folga agendada': 0 };
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = dataISO(ano, mes, d);
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
export function baixarExcelEscala(opts: { ano: number; mes: number; dados: DadosEscalaX | null; pessoas: PessoaX[] }): string {
  const wb = montarPlanilhaEscala(opts);
  const nome = `escala-${MES_NOMES[opts.mes].toLowerCase()}-${opts.ano}.xlsx`;
  XLSX.writeFile(wb, nome);
  return nome;
}
