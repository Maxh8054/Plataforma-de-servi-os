import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { getSessionToken, requireAdmin, forbidden } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';
import { emailProviderConfigured, generateVerificationCode, hashSecret, sendVerificationEmail } from '@/lib/email';

const REQUEST_EXPIRY_DAYS = 7;
const REGISTER_RATE_MAX = 5;
const REGISTER_RATE_WINDOW = 15 * 60 * 1000;
const ALLOWED_DOMAIN = '@zaminebrasil.com';

function hashPasswordSha256(password: string, email: string): string {
  return createHash('sha256').update(`${password}:${email}`).digest('hex');
}

function isBcryptHash(hashedPassword: string): boolean {
  return hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2a$');
}

/** Verifica a senha do admin (suporta bcrypt e legado sha256) */
async function verifyAdminPassword(
  password: string,
  email: string,
  storedHash: string | null
): Promise<boolean> {
  if (!storedHash) return false;
  if (isBcryptHash(storedHash)) return compare(password, storedHash);
  return hashPasswordSha256(password, email) === storedHash;
}

async function expireOldPendingRequests() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REQUEST_EXPIRY_DAYS);
  await db.request.updateMany({
    where: { type: 'registration', status: 'pending', createdAt: { lt: cutoff } },
    data: { status: 'expired' },
  });
  // solicitações aguardando verificação de email expiram em 1 dia
  const unverifiedCutoff = new Date();
  unverifiedCutoff.setDate(unverifiedCutoff.getDate() - 1);
  await db.request.updateMany({
    where: { type: 'registration', status: 'unverified', createdAt: { lt: unverifiedCutoff } },
    data: { status: 'expired' },
  });
}

// POST - Solicitação pública de cadastro (requer código de convite)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rl = rateLimit(`register:${ip}`, REGISTER_RATE_MAX, REGISTER_RATE_WINDOW);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }

    const inviteCode = process.env.REGISTRATION_INVITE_CODE;
    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: 'Cadastro temporariamente indisponível. Contate o administrador.' },
        { status: 503 }
      );
    }

    const { type, email, data, inviteCode: providedCode } = await request.json();

    if (type !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'Tipo de solicitação inválido' },
        { status: 400 }
      );
    }

    if (!email || !data?.name || !providedCode) {
      return NextResponse.json(
        { success: false, error: 'Preencha nome, email e código de convite.' },
        { status: 400 }
      );
    }

    // Barreira 1: código de convite da empresa
    if (String(providedCode).trim() !== inviteCode) {
      auditLog({ action: 'registration_denied', userEmail: email, ip, details: 'Código de convite inválido' });
      return NextResponse.json(
        { success: false, error: 'Código de convite inválido.' },
        { status: 403 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Barreira 2: domínio da empresa
    if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
      auditLog({ action: 'registration_denied', userEmail: normalizedEmail, ip, details: `Domínio não permitido` });
      return NextResponse.json(
        { success: false, error: `Apenas emails ${ALLOWED_DOMAIN} são aceitos.` },
        { status: 403 }
      );
    }

    // sem duplicidade: usuário já existe ou solicitação pendente
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este email já possui acesso à plataforma.' },
        { status: 400 }
      );
    }

    const existingPending = await db.request.findFirst({
      where: { type: 'registration', email: normalizedEmail, status: 'pending' },
    });
    if (existingPending) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação pendente para este email.' },
        { status: 400 }
      );
    }

    // Já existe solicitação aguardando verificação do código? Reenvia por cima.
    const existingUnverified = await db.request.findFirst({
      where: { type: 'registration', email: normalizedEmail, status: 'unverified' },
      orderBy: { createdAt: 'desc' },
    });

    await expireOldPendingRequests();

    const name = String(data.name).slice(0, 120);
    const department = data.department ? String(data.department).slice(0, 80) : null;

    // Com provedor de email configurado: exige código de verificação (prova de posse do email)
    if (emailProviderConfigured()) {
      const code = generateVerificationCode();
      const payload = {
        name,
        department,
        codeHash: hashSecret(code, normalizedEmail),
        codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        codeAttempts: 0,
      };

      const delivery = await sendVerificationEmail(normalizedEmail, code, 'registration');
      if (!delivery.sent && !delivery.simulated) {
        return NextResponse.json(
          { success: false, error: 'Não foi possível enviar o email de verificação. Tente novamente em instantes.' },
          { status: 502 }
        );
      }

      if (existingUnverified) {
        await db.request.update({
          where: { id: existingUnverified.id },
          data: { data: JSON.stringify(payload) },
        });
      } else {
        await db.request.create({
          data: {
            type: 'registration',
            email: normalizedEmail,
            data: JSON.stringify(payload),
            status: 'unverified',
          },
        });
      }

      auditLog({
        action: 'registration_code_sent',
        userEmail: normalizedEmail,
        ip,
        details: delivery.simulated ? 'MODO SIMULADO — configure RESEND_API_KEY ou BREVO_API_KEY' : undefined,
      });

      return NextResponse.json({
        success: true,
        emailSent: true,
        message: 'Enviamos um código de verificação para o seu email.',
      });
    }

    // Sem provedor de email: fluxo direto para aprovação do admin
    // Apenas dados inofensivos são gravados — senha NUNCA vem daqui
    await db.request.create({
      data: {
        type: 'registration',
        email: normalizedEmail,
        data: JSON.stringify({ name, department }),
        status: 'pending',
      },
    });

    auditLog({ action: 'registration_created', userEmail: normalizedEmail, ip, details: `Nome informado: ${String(data.name).slice(0, 60)}` });

    return NextResponse.json({
      success: true,
      emailSent: false,
      message: 'Solicitação enviada! Aguarde a aprovação do administrador.',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao criar solicitação' },
      { status: 500 }
    );
  }
}

// GET - Listar solicitações (Admin - sessão real)
export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    await expireOldPendingRequests();

    const status = request.nextUrl.searchParams.get('status');
    const where: Record<string, unknown> = { type: 'registration' };
    if (status) where.status = status;

    const requests = await db.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, requests });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar solicitações' },
      { status: 500 }
    );
  }
}

// PUT - Aprovar/Rejeitar (Admin - sessão real + confirmação de senha)
export async function PUT(request: NextRequest) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden('Acesso negado');

  try {
    const ip = getClientIp(request);
    const { requestId, action, adminPassword } = await request.json();

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Ação inválida' },
        { status: 400 }
      );
    }

    const req = await db.request.findUnique({ where: { id: requestId } });
    if (!req || req.type !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    if (req.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Esta solicitação já foi processada.' },
        { status: 400 }
      );
    }

    if (action === 'reject') {
      await db.request.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });
      auditLog({
        action: 'registration_rejected',
        userId: admin.id,
        userEmail: admin.email,
        userName: admin.name ?? undefined,
        ip,
        details: `Rejeitou cadastro de ${req.email}`,
      });
      return NextResponse.json({ success: true, message: 'Solicitação rejeitada.' });
    }

    // === Aprovação: Barreira 3 — reconfirmar senha do admin (step-up) ===
    if (!adminPassword) {
      return NextResponse.json(
        { success: false, error: 'Confirme sua senha de administrador para aprovar.' },
        { status: 401 }
      );
    }

    const adminFull = await db.user.findUnique({ where: { id: admin.id } });
    const passwordOk = await verifyAdminPassword(adminPassword, admin.email, adminFull?.password ?? null);
    if (!passwordOk) {
      auditLog({
        action: 'registration_approve_denied',
        userId: admin.id,
        userEmail: admin.email,
        ip,
        details: 'Senha de confirmação incorreta ao aprovar cadastro',
      });
      return NextResponse.json(
        { success: false, error: 'Senha incorreta. Aprovação negada.' },
        { status: 403 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email: req.email } });
    if (existingUser) {
      await db.request.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });
      return NextResponse.json(
        { success: false, error: 'Email já cadastrado' },
        { status: 400 }
      );
    }

    const requestData = JSON.parse(req.data || '{}');

    // Conta criada SEM senha e em modo primeiro acesso:
    // a própria pessoa define a senha (fluxo validado + bcrypt).
    // Self-registration NUNCA cria admin, ignore qualquer role no payload.
    await db.user.create({
      data: {
        email: req.email,
        name: requestData.name || null,
        department: requestData.department || null,
        role: 'user',
        password: null,
        isFirstAccess: true,
        isActive: true,
      },
    });

    await db.request.update({
      where: { id: requestId },
      data: { status: 'approved' },
    });

    auditLog({
      action: 'registration_approved',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name ?? undefined,
      ip,
      details: `Aprovou cadastro de ${req.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `Cadastro aprovado! ${req.email} já pode definir a senha no primeiro acesso.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
