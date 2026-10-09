import { NextRequest, NextResponse } from 'next/server';
import { hash, compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden, isAdminRole } from '@/lib/auth';
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
 * Gestão de usuários —Somente admin (requireAdmin em todos os métodos).
 *
 * Travas de segurança:
 *  - Nunca permite desativar/rebaixar/excluir o ÚLTIMO admin ativo (evita lockout total)
 *  - Nunca permite que um admin remova o próprio acesso (desativar/rebaixar) nem a autoexclusão
 *  - Desativar um usuário derruba a sessão aberta na hora (sessionToken = null)
 *  - Exclusão exige STEP-UP: senha do próprio admin (protege contra sessão sequestrada)
 *  - Exclusão desvincula os logs de auditoria (preserva histórico) e limpa registros dependentes
 *  - Toda operação grava em audit_logs (quem, IP, o quê)
 */

/** Quantos admins ATIVOS existem, excluindo um usuário da contagem */
function countOtherActiveAdmins(excludeUserId: string) {
  return db.user.count({
    where: { role: 'admin', isActive: true, id: { not: excludeUserId } },
  });
}

/** O alvo é o único admin ativo da plataforma? */
async function isLastActiveAdmin(target: { id: string; role: string; isActive: boolean }): Promise<boolean> {
  if (!isAdminRole(target.role) || !target.isActive) return false;
  return (await countOtherActiveAdmins(target.id)) === 0;
}

/** Step-up: confirma a senha do próprio admin antes de ação destrutiva */
async function verifyAdminPassword(adminId: string, adminPassword: unknown): Promise<boolean> {
  if (typeof adminPassword !== 'string' || adminPassword.length === 0) return false;
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { password: true } });
  if (!admin?.password) return false;
  return compare(adminPassword, admin.password);
}

// GET - List Users (Admin Only - sessão real)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        isFirstAccess: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error('[users] GET falhou:', err);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar usuários' },
      { status: 500 }
    );
  }
}

// POST - Create User (Admin Only - sessão real)
export async function POST(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const { email, password, name, role, department } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const emailConfigured = emailProviderConfigured();
    const hasPassword = typeof password === 'string' && password.length > 0;

    // Sem senha informada, o usuário define a própria senha via código de email —
    // se não há provedor de email, a senha inicial passa a ser obrigatória.
    if (!hasPassword && !emailConfigured) {
      return NextResponse.json(
        { success: false, error: 'Configure o envio de email (ex.: BREVO_API_KEY) ou informe uma senha inicial' },
        { status: 400 }
      );
    }

    if (hasPassword && password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email já cadastrado' },
        { status: 400 }
      );
    }

    const hashedPassword = hasPassword ? await hash(password, 10) : null;
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        password: hashedPassword,
        role: role === 'ADMIN' || role === 'admin' ? 'admin' : 'user',
        department: department || null,
        // Com senha: conta pronta para login. Sem senha: primeiro acesso com código de email.
        isFirstAccess: !hasPassword,
      },
    });

    // Sem senha inicial → envia o código que permite definir a senha com segurança
    let emailSent: boolean | undefined;
    if (!hasPassword) {
      const code = generateVerificationCode();
      await db.twoFactorChallenge.deleteMany({ where: { userId: user.id } });
      await db.twoFactorChallenge.create({
        data: {
          userId: user.id,
          tokenHash: hashSecret(generateChallengeToken(), 'challenge'),
          codeHash: hashSecret(code, user.id),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      const delivery = await sendVerificationEmail(user.email, code, 'password-reset');
      emailSent = delivery.sent || delivery.simulated;
    }

    auditLog({
      action: 'user_created',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Criou usuário ${normalizedEmail} (role: ${user.role}${hasPassword ? ', com senha inicial' : ', primeiro acesso por email'})`,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      emailSent,
    });
  } catch (err) {
    console.error('[users] POST falhou:', err);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}

// PUT - Update User (Admin Only - sessão real)
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const { userId, updates } = await request.json();

    if (!userId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    if (updates.password !== undefined && (typeof updates.password !== 'string' || updates.password.length < 8)) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined)
      updateData.role =
        updates.role === 'ADMIN' || updates.role === 'admin'
          ? 'admin'
          : 'user';
    if (updates.department !== undefined)
      updateData.department = updates.department;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.password !== undefined) {
      updateData.password = await hash(updates.password, 10);
      // senha definida pelo admin → conta configurada (sem tela de primeiro acesso)
      updateData.isFirstAccess = false;
      // senha trocada manualmente invalida sessões abertas
      updateData.sessionToken = null;
      updateData.tokenExpiresAt = null;
    }

    // ===== TRAVA 1: admin não remove o próprio acesso =====
    const isSelf = target.id === admin.id;
    const selfDemote =
      isSelf &&
      updates.role !== undefined &&
      !isAdminRole(updateData.role as string) &&
      isAdminRole(target.role);
    const selfDeactivate = isSelf && updates.isActive === false;
    if (selfDemote || selfDeactivate) {
      return NextResponse.json(
        { success: false, error: 'Você não pode remover seu próprio acesso — peça a outro administrador' },
        { status: 400 }
      );
    }

    // ===== TRAVA 2: nunca remover o último admin ativo =====
    const demoteTarget =
      updates.role !== undefined &&
      !isAdminRole(updateData.role as string) &&
      isAdminRole(target.role);
    const deactivateTarget = updates.isActive === false && target.isActive;
    if ((demoteTarget || deactivateTarget) && (await isLastActiveAdmin(target))) {
      return NextResponse.json(
        { success: false, error: 'Não é possível remover o último administrador ativo' },
        { status: 400 }
      );
    }

    // ===== TRAVA 3: desativar derruba a sessão aberta na hora =====
    if (updates.isActive === false) {
      updateData.sessionToken = null;
      updateData.tokenExpiresAt = null;
    }

    await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    auditLog({
      action: 'user_updated',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Atualizou usuário ${target.email} (campos: ${Object.keys(updateData)
        .map((k) => (k === 'password' ? 'senha' : k))
        .join(', ')})`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[users] PUT falhou:', err);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

// DELETE - Delete User (Admin Only - sessão real + senha do admin)
export async function DELETE(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    let userId: string | undefined;
    let adminPassword: unknown;

    try {
      const body = await request.json();
      userId = body.userId;
      adminPassword = body.adminPassword;
    } catch {
      userId = request.nextUrl.searchParams.get('userId') || undefined;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    if (userId === admin.id) {
      return NextResponse.json(
        { success: false, error: 'Você não pode excluir a si mesmo' },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // ===== TRAVA: nunca excluir o último admin ativo =====
    if (await isLastActiveAdmin(target)) {
      return NextResponse.json(
        { success: false, error: 'Não é possível excluir o último administrador ativo' },
        { status: 400 }
      );
    }

    // ===== STEP-UP: confirma a senha do próprio admin (proteção contra sessão sequestrada) =====
    const okPassword = await verifyAdminPassword(admin.id, adminPassword);
    if (!okPassword) {
      return NextResponse.json(
        { success: false, error: 'Senha do administrador incorreta' },
        { status: 401 }
      );
    }

    // Desvincula o histórico de auditoria (preserva o registro, evita erro de FK)
    await db.auditLog.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    });
    // Limpa registros dependentes (two_factor_challenges tem cascade, explícito por clareza)
    await db.passwordResetRequest.deleteMany({ where: { userId: target.id } });
    await db.twoFactorChallenge.deleteMany({ where: { userId: target.id } });

    await db.user.delete({ where: { id: target.id } });

    auditLog({
      action: 'user_deleted',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip: getClientIp(request),
      details: `Excluiu usuário ${target.email}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[users] DELETE falhou:', err);
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir usuário' },
      { status: 500 }
    );
  }
}
