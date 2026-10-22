/**
 * Dias sem afastamento automáticos para o painel da TV.
 *
 * Puxa o contador oficial da plataforma (src/lib/contador-seguranca.ts —
 * a mesma data-base do contador exibido na tela inicial), de modo que a TV
 * mostre sozinha o número certo, sem ninguém cadastrar data no editor.
 *
 * A aritmética de datas é feita em strings "YYYY-MM-DD" (imune a fuso),
 * no mesmo padrão da escala automática.
 */
import { dataBaseDeAsync, diasDesde, TZ_SEGURANCA } from '@/lib/contador-seguranca';

export interface SegurancaAuto {
  modo: 'auto';
  tz: string;
  /** dias completos desde a data-base (mesmo número da plataforma) */
  dias: number;
  /** data-base (YYYY-MM-DD) — "contando desde" */
  desde: string;
  geradoEm: string; // ISO
}

/** Contador automático da regional (data-base DO BANCO); null se não houver contador. */
export async function computarSegurancaAuto(
  panelSlug: string,
  tz: string = TZ_SEGURANCA,
): Promise<SegurancaAuto | null> {
  const desde = await dataBaseDeAsync(panelSlug);
  if (!desde) return null;
  return {
    modo: 'auto',
    tz: tz || TZ_SEGURANCA,
    dias: diasDesde(desde, tz),
    desde,
    geradoEm: new Date().toISOString(),
  };
}
