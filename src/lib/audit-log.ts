import { db } from '@/lib/db';

export function auditLog(params: { action: string; userId?: string; userEmail?: string; userName?: string; ip?: string; details?: string }): void {
  db.auditLog.create({ data: { ...params } }).catch(() => {});
}
