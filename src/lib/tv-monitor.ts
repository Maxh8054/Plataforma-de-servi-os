import { db } from '@/lib/db';

/**
 * Saúde das TVs (heartbeat) + backup automático agendado.
 *
 * As tabelas novas (tv_dispositivos, tv_backups, notificacoes_leitura) são
 * criadas AQUI com CREATE TABLE IF NOT EXISTS — idempotente, sem risco para
 * os dados existentes. Assim a produção não depende de rodar `prisma db push`
 * manualmente: a primeira requisição garante o schema.
 *
 * Tudo degrada com elegância: sem banco, as rotas devolvem vazio/erro suave
 * e a TV continua no ar do mesmo jeito (heartbeat é best-effort).
 */

/** TV conta como ONLINE se anunciou nos últimos 6 minutos (heartbeat a cada 2,5 min). */
export const ONLINE_MS = 6 * 60 * 1000;

/** Um snapshot automático por dia (20h de folga para não brigar com o fuso). */
const BACKUP_AUTO_MS = 20 * 60 * 60 * 1000;

/** Máximo de backups guardados por painel (os mais antigos são apagados). */
const BACKUP_MAX = 30;

export interface DeviceLike {
  deviceId: string;
  canal: string | null;
  telas: number | null;
  ultimaVez: Date;
}

/** Marca no processo: tabelas já garantidas (evita DDL a cada request). */
const G = globalThis as typeof globalThis & { __tvTabelasOk?: boolean };

const DDL = [
  `CREATE TABLE IF NOT EXISTS "tv_dispositivos" (
    "id" TEXT NOT NULL,
    "panelSlug" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "canal" TEXT,
    "telas" INTEGER,
    "ua" TEXT,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tv_dispositivos_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "tv_dispositivos_panelSlug_deviceId_key"
    ON "tv_dispositivos"("panelSlug", "deviceId")`,
  `CREATE TABLE IF NOT EXISTS "tv_backups" (
    "id" TEXT NOT NULL,
    "panelSlug" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'auto',
    "dados" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tv_backups_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "tv_backups_panelSlug_criadoEm_idx"
    ON "tv_backups"("panelSlug", "criadoEm")`,
  `CREATE TABLE IF NOT EXISTS "notificacoes_leitura" (
    "userEmail" TEXT NOT NULL,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificacoes_leitura_pkey" PRIMARY KEY ("userEmail")
  )`,
  `CREATE TABLE IF NOT EXISTS "notificacoes_dispensas" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificacoes_dispensas_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "notificacoes_dispensas_userEmail_itemKey_key"
    ON "notificacoes_dispensas"("userEmail", "itemKey")`,
];

/** Garante as tabelas do monitor (uma vez por processo). true = pode usar. */
export async function ensureTabelasMonitor(): Promise<boolean> {
  if (G.__tvTabelasOk) return true;
  for (const sql of DDL) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      // 42P07 = já existe (corrida inofensiva); outros erros = banco fora
      if ((e as { code?: string })?.code !== '42P07') {
        console.error('[tv-monitor] DDL falhou:', (e as Error)?.message?.slice(0, 200));
        return false;
      }
    }
  }
  G.__tvTabelasOk = true;
  return true;
}

/** Dispensa aparelhos que não se anunciam há 45 dias (limpeza ocasional). */
export async function dispensarAparelhosVelhos(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM "tv_dispositivos" WHERE "ultimaVez" < NOW() - INTERVAL '45 days'`
    );
  } catch {
    /* best-effort */
  }
}

/** Dispositivo está online? */
export function estaOnline(ultimaVez: Date): boolean {
  return Date.now() - new Date(ultimaVez).getTime() < ONLINE_MS;
}

/** Shape comum para a resposta das rotas (evita vazar campos internos). */
export function aparelhoParaResposta(d: DeviceLike) {
  return {
    id: d.deviceId,
    canal: d.canal || '',
    telas: d.telas ?? null,
    ultimaVez: d.ultimaVez,
    online: estaOnline(d.ultimaVez),
  };
}

/**
 * Snapshot do conteúdo NO AR do painel ({ secoes, config }) gravado em tv_backups.
 * origem: 'auto' (1x por dia) | 'pre-edicao' (antes de salvar) | 'manual' (admin).
 */
export async function capturarSnapshot(
  panel: string,
  origem: 'auto' | 'pre-edicao' | 'manual'
): Promise<string | null> {
  try {
    if (!(await ensureTabelasMonitor())) return null;
    const [secoes, config] = await Promise.all([
      db.tvSection.findMany({ where: { panelSlug: panel }, select: { sectionKey: true, data: true } }),
      db.tvPanelConfig.findUnique({ where: { panelSlug: panel }, select: { data: true } }),
    ]);
    const pack = {
      secoes: Object.fromEntries(secoes.map((s) => [s.sectionKey, safeParse(s.data)])),
      config: safeParse(config?.data ?? null) ?? {},
      salvoEm: new Date().toISOString(),
      origem,
    };
    const row = await db.tvBackup.create({
      data: { panelSlug: panel, origem, dados: JSON.stringify(pack) },
      select: { id: true },
    });
    // poda: guarda só os BACKUP_MAX mais recentes deste painel
    const velhos = await db.tvBackup.findMany({
      where: { panelSlug: panel },
      orderBy: { criadoEm: 'desc' },
      skip: BACKUP_MAX,
      take: 200,
      select: { id: true },
    });
    if (velhos.length) {
      await db.tvBackup.deleteMany({ where: { id: { in: velhos.map((v) => v.id) } } });
    }
    return row.id;
  } catch (e) {
    console.error('[tv-monitor] snapshot falhou:', (e as Error)?.message?.slice(0, 160));
    return null;
  }
}

/** Backup automático 1x por dia: chama em requisições frequentes (heartbeat). */
export async function snapshotAutoSeNecessario(panel: string): Promise<void> {
  try {
    if (!(await ensureTabelasMonitor())) return;
    const ultimo = await db.tvBackup.findFirst({
      where: { panelSlug: panel, origem: 'auto' },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    if (ultimo && Date.now() - new Date(ultimo.criadoEm).getTime() < BACKUP_AUTO_MS) return;
    await capturarSnapshot(panel, 'auto');
  } catch {
    /* best-effort: nunca derruba a rota que o chamou */
  }
}

function safeParse(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
