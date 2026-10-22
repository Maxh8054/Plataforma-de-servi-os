/**
 * Contador oficial de "dias sem afastamento" da plataforma ZAMine.
 *
 * Fonte única das datas-base — o MESMO contador exibido na tela inicial da
 * plataforma (canto inferior esquerdo ao selecionar o estado). A TV e qualquer
 * outra integração puxam daqui, para que o número seja sempre idêntico ao da
 * plataforma, sem ninguém precisar lançar data em lugar nenhum.
 *
 * As datas-base vivem NO BANCO DE DADOS (tabela contador_seguranca) e o admin
 * atualiza pela tela inicial da plataforma — nada se perde em deploy/commit
 * novo. As constantes abaixo funcionam apenas como fallback/seed enquanto não
 * houver registro no banco (ou se o banco estiver indisponível).
 */

import { db } from '@/lib/db';

/** Fallback/seed por regional (YYYY-MM-DD) — usado só se o banco não tiver a linha */
export const DATA_BASE_SEGURANCA: Record<string, string> = {
  goias: '2022-08-01',
  minas: '2024-07-11',
};

/** Fuso da operação (mesmo padrão da escala automática) */
export const TZ_SEGURANCA = 'America/Sao_Paulo';

/** Data-base da regional lida DO BANCO; cai no fallback se não houver registro */
export async function dataBaseDeAsync(regional: string): Promise<string | null> {
  try {
    const row = await db.contadorSeguranca.findUnique({
      where: { regional },
      select: { dataBase: true },
    });
    if (row && /^\d{4}-\d{2}-\d{2}$/.test(row.dataBase)) return row.dataBase;
  } catch {
    // banco indisponível — segue no fallback
  }
  return dataBaseDe(regional);
}

/** Data de hoje (YYYY-MM-DD) no fuso informado */
export function hojeSeguranca(tz: string = TZ_SEGURANCA): string {
  const fuso = tz || TZ_SEGURANCA;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ_SEGURANCA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}

/**
 * Dias completos entre a data-base e hoje (aritmética em strings YYYY-MM-DD,
 * imune a fuso — mesmo formato usado na escala automática).
 */
export function diasDesde(dataBase: string, tz: string = TZ_SEGURANCA): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase)) return 0;
  const hoje = hojeSeguranca(tz);
  const a = new Date(`${dataBase}T12:00:00Z`).getTime();
  const b = new Date(`${hoje}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Data-base da regional informada (null se não houver contador definido) */
export function dataBaseDe(panelSlug: string): string | null {
  return DATA_BASE_SEGURANCA[panelSlug] ?? null;
}
