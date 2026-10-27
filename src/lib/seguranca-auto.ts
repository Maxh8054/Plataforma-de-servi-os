/**
 * Dias sem afastamento automáticos para o painel da TV.
 *
 * REGRA: SÓ o painel de Goiás puxa o contador OFICIAL da plataforma
 * (src/lib/contador-seguranca.ts — a mesma data-base do contador exibido na
 * tela inicial). Todos os demais painéis (estados e locais, ex.: minas,
 * minas-araxa) NÃO recebem o contador daqui: neles o admin coloca a DATA do
 * último acidente no próprio painel (aba "Dias sem acidentes" →
 * "Contando desde") e a TV calcula sozinha os dias (hoje menos a data).
 */
import { dataBaseDeAsync, diasDesde, TZ_SEGURANCA } from '@/lib/contador-seguranca';

/** Painéis que puxam o contador automático da tela inicial da plataforma. */
export const PAINEL_SEGURANCA_AUTO = 'goias';

export interface SegurancaAuto {
  modo: 'auto';
  tz: string;
  /** dias completos desde a data-base (mesmo número da plataforma) */
  dias: number;
  /** data-base (YYYY-MM-DD) — "contando desde" */
  desde: string;
  geradoEm: string; // ISO
}

/** Contador automático da regional (data-base DO BANCO); null quando o painel
 *  não é Goiás ou não há data-base — nesse caso a TV usa a data editada no
 *  próprio painel e calcula os dias localmente. */
export async function computarSegurancaAuto(
  panelSlug: string,
  tz: string = TZ_SEGURANCA,
): Promise<SegurancaAuto | null> {
  if (panelSlug !== PAINEL_SEGURANCA_AUTO) return null;
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
