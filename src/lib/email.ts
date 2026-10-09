/**
 * Envio de emails de verificação (código OTP de 6 dígitos).
 *
 * Provedores suportados (por prioridade):
 *  1. Resend  — variável RESEND_API_KEY
 *  2. Brevo   — variável BREVO_API_KEY
 *  3. Sem provedor → MODO SIMULADO: o código aparece apenas nos logs
 *     do servidor (Render Dashboard → Logs). Útil para testes.
 *
 * Variáveis opcionais:
 *  - EMAIL_FROM: remetente, ex.: "Zamine Plataforma <no-reply@zaminebrasil.com>"
 *    (padrão: onboarding@resend.dev — só entrega para o dono da conta Resend)
 *  - TWO_FACTOR_MODE: 'off' (padrão) | 'admin' | 'all'
 */

import { createHash, randomInt, randomBytes } from 'crypto';

const RESEND_URL = 'https://api.resend.com/emails';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Indica se há provedor de email configurado */
export function emailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY);
}

/** Deve exigir 2FA no login para este papel? */
export function twoFactorRequiredForRole(role: string | null | undefined): boolean {
  if (!emailProviderConfigured()) return false; // sem email configurado, não trava ninguém
  const mode = (process.env.TWO_FACTOR_MODE || 'off').toLowerCase().trim();
  if (mode === 'all') return true;
  if (mode === 'admin') return (role ?? '').toLowerCase() === 'admin';
  return false;
}

/** Código de 6 dígitos criptograficamente aleatório */
export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Token opaco de desafio (não vai para o banco em texto puro) */
export function generateChallengeToken(): string {
  return randomBytes(32).toString('hex');
}

/** Hash do código/token (sha256 + salt) */
export function hashSecret(secret: string, salt: string): string {
  return createHash('sha256').update(`${secret}:${salt}`).digest('hex');
}

function renderCodeEmail(code: string, purpose: 'registration' | 'login'): string {
  const context = purpose === 'registration'
    ? 'sua solicitação de acesso à <strong>Plataforma Zamine</strong>'
    : 'o seu login na <strong>Plataforma Zamine</strong>';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
      <div style="background:#ea580c;padding:20px 24px">
        <h1 style="color:#ffffff;font-size:18px;margin:0">Plataforma Zamine</h1>
      </div>
      <div style="padding:24px">
        <p style="color:#3f3f46;font-size:14px;margin:0 0 12px">Use o código abaixo para ${context}:</p>
        <div style="text-align:center;margin:24px 0">
          <span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:bold;color:#18181b;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px 20px">${code}</span>
        </div>
        <p style="color:#71717a;font-size:12px;margin:0 0 8px">Este código expira em <strong>10 minutos</strong>.</p>
        <p style="color:#71717a;font-size:12px;margin:0">Se você não solicitou este código, ignore este email — nenhuma alteração será feita.</p>
      </div>
    </div>
  </div>`;
}

/**
 * Envia o email com o código. Nunca lança — retorna status.
 * Modo simulado grava o código nos logs do servidor.
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: 'registration' | 'login'
): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  const subject =
    purpose === 'registration'
      ? 'Código de verificação — Solicitação de acesso'
      : 'Código de verificação — Login';
  const html = renderCodeEmail(code, purpose);
  const from = process.env.EMAIL_FROM || 'Zamine Plataforma <onboarding@resend.dev>';

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (res.ok) return { sent: true, simulated: false };
      const detail = await res.text().catch(() => '');
      console.error('[email] Resend falhou:', res.status, detail.slice(0, 200));
      return { sent: false, simulated: false, error: `resend:${res.status}` };
    } catch (err) {
      console.error('[email] erro de rede no Resend:', err);
      return { sent: false, simulated: false, error: 'resend:network' };
    }
  }

  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: from.replace(/^.*<|>.*$/g, '') || from, name: 'Zamine Plataforma' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (res.ok) return { sent: true, simulated: false };
      const detail = await res.text().catch(() => '');
      console.error('[email] Brevo falhou:', res.status, detail.slice(0, 200));
      return { sent: false, simulated: false, error: `brevo:${res.status}` };
    } catch (err) {
      console.error('[email] erro de rede no Brevo:', err);
      return { sent: false, simulated: false, error: 'brevo:network' };
    }
  }

  // ===== MODO SIMULADO =====
  console.log(`\n========================================`);
  console.log(`[EMAIL SIMULADO] (configure RESEND_API_KEY para envio real)`);
  console.log(`  Para: ${to}`);
  console.log(`  Assunto: ${subject}`);
  console.log(`  Código: ${code}`);
  console.log(`========================================\n`);
  return { sent: false, simulated: true };
}
