const store = new Map<string, { count: number; resetTime: number }>();
const failedLoginByIp = new Map<string, { emails: Set<string>; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (now >= record.resetTime) store.delete(key);
  }
  for (const [key, record] of failedLoginByIp) {
    if (now >= record.resetTime) failedLoginByIp.delete(key);
  }
}, 10 * 60 * 1000);

export function rateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const record = store.get(key);
  if (!record || now >= record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }
  if (record.count >= maxRequests) {
    return { success: false, remaining: 0, resetTime: record.resetTime };
  }
  record.count++;
  return { success: true, remaining: maxRequests - record.count, resetTime: record.resetTime };
}

export function trackFailedLogin(ip: string, email: string): { blocked: boolean; resetTime: number } {
  const now = Date.now();
  const record = failedLoginByIp.get(ip);
  if (!record || now >= record.resetTime) {
    const newRecord = { emails: new Set([email.toLowerCase().trim()]), resetTime: now + 15 * 60 * 1000 };
    failedLoginByIp.set(ip, newRecord);
    return { blocked: false, resetTime: newRecord.resetTime };
  }
  record.emails.add(email.toLowerCase().trim());
  return { blocked: record.emails.size >= 5, resetTime: record.resetTime };
}

export function isIpBlockedForBruteForce(ip: string): boolean {
  const record = failedLoginByIp.get(ip);
  if (!record) return false;
  if (Date.now() >= record.resetTime) { failedLoginByIp.delete(ip); return false; }
  return record.emails.size >= 5;
}

export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
