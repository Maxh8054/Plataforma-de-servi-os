import { db } from '@/lib/db';

export type AuditSeverity = 'info' | 'warning' | 'critical';

/**
 * Severidade automática por action — eventos "estranhos" (falhas, bloqueios,
 * ações destrutivas) ganham destaque visual no painel de auditoria.
 */
const SEVERITY_BY_ACTION: Record<string, AuditSeverity> = {
  // warning: tentativas que falharam / comportamento incomum
  login_failed: 'warning',
  twofactor_code_failed: 'warning',
  registration_code_failed: 'warning',
  registration_denied: 'warning',
  registration_approve_denied: 'warning',
  change_password_failed: 'warning',
  seed_failed_auth: 'warning',
  seed_exported: 'warning',
  user_password_reset: 'warning',
  first_access_code_resent: 'warning',
  // apps de segurança (inspeções / EPIs): exclusões são destrutivas
  inspection_deleted: 'warning',
  inspection_update_denied: 'warning',
  inspection_delete_denied: 'warning',
  epi_audit_deleted: 'warning',
  epi_audit_delete_denied: 'warning',
  epi_audits_clear_denied: 'critical',
  epi_audits_all_cleared: 'critical',
  // critical: segurança comprometida / ação destrutiva
  brute_force_blocked: 'critical',
  user_locked: 'critical',
  user_deleted: 'critical',
  users_mass_password_reset: 'critical',
  seed_imported: 'critical',
};

/** Poda automática do histórico de atividades: guarda os registros por 30 dias
 *  (decisão do admin — rastreabilidade suficiente e tabela nunca cresce sem limite).
 *  Roda em segundo plano no máximo 1x por hora por processo, sem travar o log. */
const PODA_DIAS = 30;
const PODA_INTERVALO_MS = 60 * 60 * 1000;
const GP = globalThis as typeof globalThis & { __auditPodaEm?: number };

function podarAntigos(): void {
  const agora = Date.now();
  if (GP.__auditPodaEm && agora - GP.__auditPodaEm < PODA_INTERVALO_MS) return;
  GP.__auditPodaEm = agora;
  db.auditLog
    .deleteMany({ where: { createdAt: { lt: new Date(agora - PODA_DIAS * 86400e3) } } })
    .then((r) => {
      if (r.count) console.log(`[audit-log] poda automática: ${r.count} registro(s) com mais de ${PODA_DIAS} dias apagados`);
    })
    .catch(() => {});
}

export function auditLog(params: {
  action: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ip?: string;
  details?: string;
  severity?: AuditSeverity;
}): void {
  const severity = params.severity ?? SEVERITY_BY_ACTION[params.action] ?? 'info';
  podarAntigos();
  db.auditLog
    .create({ data: { ...params, severity } })
    .catch(() => {});
}
