/**
 * Relatório técnico da escala de turno — entrega por técnico (letra A–D) e por
 * dia (YYYY-MM-DD). O responsável marca na plataforma (Escala de Turno), e a TV
 * mostra o status no slide da escala (ontem/hoje). Tudo no banco
 * (model RelatorioTecnico): nada se perde em deploy/commit novo.
 */
import { db } from '@/lib/db';
import { TZ_PADRAO, hojeNoFuso } from '@/lib/escala-auto';

export interface EntregaRelatorio {
  entregue: boolean;
  /** ISO do último ajuste */
  atualizadoEm: string;
  atualizadoPor: string | null;
}

/** Mapa plano: { "YYYY-MM-DD": { A: EntregaRelatorio, ... } } */
export type MapaRelatorios = Record<string, Record<string, EntregaRelatorio>>;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(v: unknown): v is string {
  return typeof v === 'string' && RE_DATA.test(v);
}

/** soma n dias numa data string YYYY-MM-DD (imune a fuso) */
export function somarDias(dataStr: string, n: number): string {
  const d = new Date(`${dataStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Lê do banco as entregas de relatório técnico da janela [de, ate].
 * Nunca lança: em caso de erro devolve {} (a TV segue no ar sem os selos).
 */
export async function carregarRelatorios(de: string, ate: string): Promise<MapaRelatorios> {
  if (!dataValida(de) || !dataValida(ate) || de > ate) return {};
  try {
    const rows = await db.relatorioTecnico.findMany({
      where: { data: { gte: de, lte: ate } },
      select: { data: true, letra: true, entregue: true, atualizadoEm: true, atualizadoPor: true },
      orderBy: { data: 'asc' },
    });
    const mapa: MapaRelatorios = {};
    for (const r of rows) {
      mapa[r.data] ??= {};
      mapa[r.data][r.letra] = {
        entregue: r.entregue,
        atualizadoEm: r.atualizadoEm.toISOString(),
        atualizadoPor: r.atualizadoPor,
      };
    }
    return mapa;
  } catch (error) {
    console.error('[relatorio-tecnico] falha ao ler entregas:', error);
    return {};
  }
}

/** Janela padrão usada na TV e no GET público: ontem..amanhã (fuso da operação). */
export function janelaPadrao(tz: string = TZ_PADRAO): { ontem: string; hoje: string; amanha: string } {
  const hoje = hojeNoFuso(tz || TZ_PADRAO);
  return { ontem: somarDias(hoje, -1), hoje, amanha: somarDias(hoje, 1) };
}
