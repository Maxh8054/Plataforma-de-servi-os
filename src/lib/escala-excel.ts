/**
 * Exportação da Escala de Turno para Excel (.xlsx) — botão "Exportar Excel"
 * na própria aba Escala de Turno (EscalaModal).
 *
 * LAYOUT: igual ao do "Gerador Escala 4x4" (Escala de Revezamento):
 *   - Cabeçalho com a logo Zamine + título grande mesclados (A1:AG1);
 *   - Um bloco por mês (dentro do período "data até data" escolhido):
 *       NOVEMBRO/2026 | Horário / Dia | 07:00 às 19:00 | 19:00 às 07:00 | Folga | Folga
 *     com uma coluna por dia (número, dia da semana e as LETRAS em cada turno);
 *   - Cores por letra (A verde, B amarelo, C ciano, D laranja), formatação
 *     condicional igual à do gerador;
 *   - Atestados, férias, folgas agendadas e "cobrindo X" viram ANOTAÇÃO na
 *     célula (canto vermelho no Excel), com o nome do colaborador;
 *   - Legenda no rodapé (letra colorida + nome);
 *   - Página paisagem ajustada à largura, grade oculta, área de impressão.
 *
 * Fonte dos dados: a MESMA regra do resto da plataforma (turnoBase de
 * escala-auto.ts — tabela Lundin + fallback do ciclo de 8 dias) e as MESMAS
 * observações do EscalaModal — não precisa carregar arquivo nenhum.
 */
import ExcelJS from 'exceljs';
import { turnoBase } from '@/lib/escala-auto';
import { ESCALA_LOGO_BASE64 } from '@/lib/escala-logo';

export type ChavePessoa = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

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

/* ---- constantes do layout (idênticas ao Gerador Escala 4x4) ---- */
const MESES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const WD = ['dom','seg','ter','qua','qui','sex','sáb'];
const COLORS: Record<string, string> = { A: '90CF50', B: 'FFFF00', C: '00AFEF', D: 'F4AF83', E: 'D9A7E0', F: 'C9C9C9' };
const ROWS = ['07:00 às 19:00', '19:00 às 07:00', 'Folga', 'Folga'];

const fmt2 = (n: number) => String(n).padStart(2, '0');
const dataISO = (ano: number, mes0: number, dia: number) => `${ano}-${fmt2(mes0 + 1)}-${fmt2(dia)}`;
const parseISO = (iso: string) => {
  const p = iso.split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
};
const isoValido = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const capitalizar = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
/** nome curto da legenda — mesma regra do gerador (2 primeiras palavras quando há 3+) */
const nomeCurto = (nome: string) => {
  const p = (nome || '').trim().split(/\s+/);
  return p.length > 2 ? `${p[0]} ${p[1]}` : nome;
};

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

/** Monta as 4 linhas do dia (manhã / noite / folga / folga) com as LETRAS, igual ao gerador. */
function linhasDoDia(
  dados: DadosEscalaX | null,
  pessoas: PessoaX[],
  iso: string,
  nomes: Record<string, string>,
): { vals: string[]; notas: string[] } {
  const mm: string[] = [];
  const nn: string[] = [];
  const ff: string[] = [];
  const obsPorLetra: Record<string, string> = {};
  for (const p of pessoas) {
    const { turno, obs } = efetivoNoDia(dados, p.letra, iso);
    if (obs) obsPorLetra[p.letra] = obs;
    if (turno === 'Manhã') mm.push(p.letra);
    else if (turno === 'Noite') nn.push(p.letra);
    else ff.push(p.letra);
  }
  const vals = [mm.join('/'), nn.join('/'), ff[0] || '', ff.slice(1).join('/')];
  const notas = vals.map((v) => {
    if (!v) return '';
    return v
      .split('/')
      .map((l) => (obsPorLetra[l] ? `${nomes[l] || l}: ${obsPorLetra[l]}` : ''))
      .filter(Boolean)
      .join(' | ');
  });
  return { vals, notas };
}

function mesesDoPeriodo(deISO: string, ateISO: string): { y: number; m: number; diaDe: number; diaAte: number }[] {
  const out: { y: number; m: number; diaDe: number; diaAte: number }[] = [];
  let cur = parseISO(deISO);
  const fim = parseISO(ateISO);
  while (cur <= fim) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const ultimoDia = new Date(y, m + 1, 0).getDate();
    const diaDe = out.length === 0 ? cur.getDate() : 1;
    const ehMesFinal = y === fim.getFullYear() && m === fim.getMonth();
    out.push({ y, m, diaDe, diaAte: ehMesFinal ? fim.getDate() : ultimoDia });
    cur = new Date(y, m + 1, 1);
  }
  return out;
}

function tituloDoPeriodo(deISO: string, ateISO: string): string {
  const meses = mesesDoPeriodo(deISO, ateISO);
  const a = meses[0];
  const b = meses[meses.length - 1];
  const lab = (x: { m: number; y: number }) => `${capitalizar(MESES[x.m])} ${x.y}`;
  const periodo = meses.length === 1 ? lab({ m: a.m, y: a.y }) : `${lab({ m: a.m, y: a.y })} a ${lab({ m: b.m, y: b.y })}`;
  return `Escala de Revezamento (4x4) - ${periodo}`;
}

function colL(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ---- estilo compartilhado (idêntico ao gerador) ---- */
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const B = { top: thin, left: thin, bottom: thin, right: thin };
const grey = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD8D8D8' } };

export async function montarWorkbookEscala(opts: {
  ano?: number;
  mes?: number; // 0–11 (modo antigo: mês inteiro)
  periodo?: PeriodoExport | null;
  dados: DadosEscalaX | null;
  pessoas: PessoaX[];
}): Promise<ExcelJS.Workbook> {
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

  const meses = mesesDoPeriodo(deISO, ateISO);
  const letras = pessoas.map((p) => p.letra);
  const nomes: Record<string, string> = {};
  pessoas.forEach((p) => { nomes[p.letra] = nomeCurto(p.nome); });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zamine';
  const nomePlanilha =
    meses.length === 1 ? `${capitalizar(MESES[meses[0].m])} ${meses[0].y}` : 'Escala 4x4';
  const ws = wb.addWorksheet(nomePlanilha, {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false, zoomScale: 70 }],
  });

  ws.getColumn(1).width = 25.3;
  for (let c = 2; c <= 32; c++) ws.getColumn(c).width = 6.6;
  ws.getColumn(33).width = 4;

  /* ---- título mesclado + logo (igual ao gerador) ---- */
  ws.mergeCells('A1:AG1');
  const t = ws.getCell('A1');
  t.value = tituloDoPeriodo(deISO, ateISO);
  t.font = { name: 'Calibri', size: 28, bold: true };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 117.9;
  const img = wb.addImage({ base64: ESCALA_LOGO_BASE64, extension: 'png' });
  ws.addImage(img, { tl: { col: 0.15, row: 0.1 }, ext: { width: 178, height: 108 } });
  [5.25, 6, 5.25, 18].forEach((h, i) => { ws.getRow(2 + i).height = h; });

  /* ---- um bloco por mês, começando na linha 6 (igual ao gerador) ---- */
  let r = 6;
  for (const { y, m, diaDe, diaAte } of meses) {
    const hdr = [`${MESES[m]}/${y}`, 'Horário / Dia', ...ROWS];
    hdr.forEach((v, i) => {
      const c = ws.getCell(r + i, 1);
      c.value = v;
      c.font = { name: 'Calibri', size: 16, bold: true };
      c.fill = grey;
      c.border = B;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r + i).height = 20.15;
    });

    for (let d = diaDe; d <= diaAte; d++) {
      const coluna = d + 1;
      const iso = dataISO(y, m, d);

      const a = ws.getCell(r, coluna);
      a.value = d;
      a.numFmt = '00';
      a.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
      a.fill = grey;
      a.border = B;
      a.alignment = { horizontal: 'center', vertical: 'middle' };

      const b = ws.getCell(r + 1, coluna);
      b.value = WD[parseISO(iso).getDay()];
      b.font = { name: 'Calibri', size: 16 };
      b.fill = grey;
      b.border = B;
      b.alignment = { horizontal: 'center', vertical: 'middle' };

      const { vals, notas } = linhasDoDia(dados, pessoas, iso, nomes);
      vals.forEach((v, i) => {
        const c = ws.getCell(r + 2 + i, coluna);
        c.value = v || null;
        c.font = { name: 'Arial', size: 16, bold: true };
        c.border = B;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        if (v && COLORS[v[0]]) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS[v[0]]}` } };
        if (v && notas[i]) c.note = notas[i];
      });
    }

    // formatação condicional por letra (igual ao gerador)
    const ref = `B${r + 2}:${colL(diaAte + 1)}${r + 5}`;
    ws.addConditionalFormatting({
      ref,
      rules: letras.filter((l) => COLORS[l]).reverse().map((l, i) => ({
        type: 'containsText',
        operator: 'containsText',
        text: l,
        priority: i + 1,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: `FF${COLORS[l]}` } } },
      })),
    });

    r += 7;
    ws.getRow(r - 1).height = 18;
  }

  /* ---- legenda (igual ao gerador) ---- */
  const lh = ws.getCell(r, 1);
  lh.value = 'Legenda';
  lh.font = { name: 'Calibri', size: 16, bold: true };
  lh.fill = grey;
  lh.border = B;
  lh.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 20.15;
  letras.forEach((l, i) => {
    const rr = r + 1 + i;
    ws.getRow(rr).height = 20.15;
    const a = ws.getCell(rr, 1);
    a.value = l;
    a.font = { name: 'Arial', size: 16, bold: true };
    a.border = B;
    a.alignment = { horizontal: 'center', vertical: 'middle' };
    if (COLORS[l]) a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS[l]}` } };
    ws.mergeCells(rr, 2, rr, 8);
    const bcell = ws.getCell(rr, 2);
    bcell.value = nomes[l] || '';
    bcell.font = { name: 'Arial', size: 16, bold: true };
    bcell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    for (let c = 2; c <= 8; c++) ws.getCell(rr, c).border = B;
  });

  ws.pageSetup.printArea = `A1:AF${r + letras.length}`;
  return wb;
}

function nomeArquivo(deISO: string, ateISO: string): string {
  const meses = mesesDoPeriodo(deISO, ateISO);
  const a = meses[0];
  const b = meses[meses.length - 1];
  const sufixo =
    meses.length > 1 ? `_A_${MESES[b.m]}_${b.y}` : '';
  return `ESCALA_DE_REVEZAMENTO_4X4_-_${MESES[a.m]}_${a.y}${sufixo}.xlsx`;
}

/** Gera e baixa o arquivo no navegador. Retorna o nome do arquivo. */
export async function baixarExcelEscala(opts: {
  ano?: number;
  mes?: number;
  periodo?: PeriodoExport | null;
  dados: DadosEscalaX | null;
  pessoas: PessoaX[];
}): Promise<string> {
  const wb = await montarWorkbookEscala(opts);
  const deISO = opts.periodo?.deISO || (opts.ano && typeof opts.mes === 'number' ? dataISO(opts.ano, opts.mes, 1) : '');
  const ateISO = opts.periodo?.ateISO || (opts.ano && typeof opts.mes === 'number'
    ? dataISO(opts.ano, opts.mes, new Date(opts.ano, opts.mes + 1, 0).getDate())
    : '');
  const nome = nomeArquivo(deISO || ateISO || dataISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), ateISO || deISO || dataISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return nome;
}
