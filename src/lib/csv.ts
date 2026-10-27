import { NextResponse } from 'next/server';

/**
 * CSV para download das abas (histórico, sino, TVs conectadas, backups).
 * Separador ";" e BOM UTF-8 — abre direto no Excel brasileiro sem importar nada.
 */

/** Escapa uma célula: separador, aspas e quebras de linha viram campo entre aspas. */
function celula(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Data/hora em pt-BR (dd/mm/aaaa hh:mm) — como o Excel BR espera. */
export function csvData(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(+dt)) return '';
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Sufixo de data/hora para o nome do arquivo (20260203-1542). */
export function csvCarimbo(d = new Date()): string {
  return d.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{2})(\d{2})$/, '$1-$2$3');
}

/** Monta a resposta de download CSV (BOM + ";"). */
export function csvResponse(nome: string, colunas: string[], linhas: unknown[][]): NextResponse {
  const corpo = [colunas, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  return new NextResponse(`\uFEFF${corpo}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
