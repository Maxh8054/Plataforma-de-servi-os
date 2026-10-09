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
  // critical: segurança comprometida / ação destrutiva
  brute_force_blocked: 'critical',
  user_locked: 'critical',
  user_deleted: 'critical',
  users_mass_password_reset: 'critical',
  seed_imported: 'critical',
};

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
  db.auditLog
    .create({ data: { ...params, severity } })
    .catch(() => {});
}
