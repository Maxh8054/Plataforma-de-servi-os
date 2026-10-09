import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import {
  emailProviderConfigured,
  generateChallengeToken,
  generateVerificationCode,
  hashSecret,
  sendVerificationEmail,
} from '@/lib/email';

/**
 * POST /api/users/reset — Reseta senha(s) para o estado de PRIMEIRO ACESSO.
 * Somente admin (sessão) + step-up com a senha do próprio admin.
 *
 * Body:
 *  - scope 'user': { scope, userId, adminPassword }
 *  - scope 'all' : { scope, adminPassword, confirmText: 'RESETAR' }
 *
 * Comportamento seguro:
 *  - O alvo volta para password=null + isFirstAccess=true (estado de primeiro acesso)
 *  - A sessão aberta do alvo é derrubada na hora
 *  - Um código de 6 dígitos é ENVIADO POR EMAIL — sem ele, ninguém define a nova senha
 *    (protege contra takeover: só quem tem acesso ao email do usuário define a senha)
 *  - Se o email falhar, o reset daquele usuário NÃO acontece (senha antiga continua valendo)
 *  - No escopo 'all', o admin executante é PRESERVADO (nunca perde o próprio acesso)
 */

const CODE_TTL_MS = 10 * 60 * 1000;

async function verifyAdminPassword(adminId: string, adminPassword: unknown): Promise<boolean> {
  if (typeof adminPassword !== 'string' || adminPassword.length === 0) return false;
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { password: true } });
  if (!admin?.password) return false;
  return compare(adminPassword, admin.password);
}

/** Prepara o desafio de código e envia o email. Retorna false se o email falhou. */
async function sendFirstAccessCode(user: { id: string; email: string }): Promise<boolean> {
  const code = generateVerificationCode();
  await db.twoFactorChallenge.deleteMany({ where: { userId: user.id } });
  await db.twoFactorChallenge.create({
    data: {
      userId: user.id,
      tokenHash: hashSecret(generateChallengeToken(), 'challenge'),
      codeHash: hashSecret(code, user.id),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const delivery = await sendVerificationEmail(user.email, code, 'password-reset');
  return delivery.sent || delivery.simulated;
}

export async function POST(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const { scope, userId, adminPassword, confirmText } = await request.json();

    // ===== Step-up: senha do próprio admin =====
    const okPassword = await verifyAdminPassword(admin.id, adminPassword);
    if (!okPassword) {
      return NextResponse.json(
        { success: false, error: 'Senha do administrador incorreta' },
        { status: 401 }
      );
    }

    // ===== Sem provedor de email o reset deixaria o usuário sem porta de entrada =====
    if (!emailProviderConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Configure o envio de email (ex.: BREVO_API_KEY) antes de resetar senhas — o usuário precisa receber o código para definir a nova senha.',
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);

    // ===================== RESET INDIVIDUAL =====================
    if (scope === 'user') {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'ID do usuário é obrigatório' }, { status: 400 });
      }
      if (userId === admin.id) {
        return NextResponse.json(
          { success: false, error: 'Você não pode resetar a própria senha por aqui — use a troca de senha do sistema.' },
          { status: 400 }
        );
      }

      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target) {
        return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
      }

      const emailSent = await sendFirstAccessCode(target);
      if (!emailSent) {
        return NextResponse.json(
          { success: false, error: 'Não foi possível enviar o email com o código. Nada foi alterado — tente novamente.' },
          { status: 502 }
        );
      }

      await db.user.update({
        where: { id: target.id },
        data: {
          password: null,
          isFirstAccess: true,
          sessionToken: null,
          tokenExpiresAt: null,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      auditLog({
        action: 'user_password_reset',
        userId: admin.id,
        userEmail: admin.email,
        userName: admin.name ?? undefined,
        ip,
        details: `Resetou a senha de ${target.email} (voltou ao primeiro acesso; nova senha exige código por email)`,
      });

      return NextResponse.json({
        success: true,
        resetCount: 1,
        message: `Senha de ${target.email} resetada. Código enviado por email.`,
      });
    }

    // ===================== RESET TOTAL =====================
    if (scope === 'all') {
      if (String(confirmText ?? '').trim().toUpperCase() !== 'RESETAR') {
        return NextResponse.json(
          { success: false, error: 'Confirmação inválida — digite RESETAR para confirmar.' },
          { status: 400 }
        );
      }

      const targets = await db.user.findMany({
        where: { id: { not: admin.id } },
        select: { id: true, email: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      let resetCount = 0;
      const failed: string[] = [];

      for (const target of targets) {
        try {
          // Usuários inativos também são resetados (mas sem email — estão fora do ar;
          // ao reativar, o admin usa o reset individual para enviar o código)
          const emailSent = target.isActive ? await sendFirstAccessCode(target) : false;
          if (target.isActive && !emailSent) {
            failed.push(target.email);
            continue; // não resetou: senha antiga continua valendo
          }

          await db.user.update({
            where: { id: target.id },
            data: {
              password: null,
              isFirstAccess: true,
              sessionToken: null,
              tokenExpiresAt: null,
              loginAttempts: 0,
              lockedUntil: null,
            },
          });
          resetCount++;
        } catch (err) {
          console.error('[users/reset] falha ao resetar', target.email, err);
          failed.push(target.email);
        }
      }

      auditLog({
        action: 'users_mass_password_reset',
        userId: admin.id,
        userEmail: admin.email,
        userName: admin.name ?? undefined,
        ip,
        details: `Reset total: ${resetCount} conta(s) voltaram ao primeiro acesso; ${failed.length} com falha de email (${failed.join(', ') || 'nenhuma'}); executante preservado`,
      });

      return NextResponse.json({
        success: true,
        resetCount,
        failed,
        message: `${resetCount} conta(s) resetada(s). Cada usuário ativo recebeu um código por email.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Escopo inválido' }, { status: 400 });
  } catch (err) {
    console.error('[users/reset] falhou:', err);
    return NextResponse.json({ success: false, error: 'Erro ao resetar senha(s)' }, { status: 500 });
  }
}
