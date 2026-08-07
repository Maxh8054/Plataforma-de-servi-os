import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { getSessionToken, requireAdmin, forbidden, unauthorized } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit-log';

function isBcryptHash(val: string): boolean {
  return val.startsWith('$2b$') || val.startsWith('$2a$');
}

// GET - Exportar senhas atuais como JSON (admin only)
export async function GET(request: Request) {
  const token = await getSessionToken(request);
  const admin = await requireAdmin(token);
  if (!admin) return forbidden();

  const users = await db.user.findMany({
    select: { email: true, password: true },
    where: { isActive: true },
    orderBy: { email: 'asc' },
  });

  const seed: Record<string, string> = {};
  for (const u of users) {
    if (u.password) {
      seed[u.email] = u.password;
    }
  }

  auditLog({ action: 'seed_exported', userId: admin.id, userEmail: admin.email, userName: admin.name });

  return new NextResponse(JSON.stringify(seed, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="seed-passwords.json"',
    },
  });
}

// POST - Popular banco com usuários (requer sessão admin + APP_PASSWORD)
// Aceita 2 formatos:
//   1) Array:     { adminPassword, users: [{ email, password, name?, role? }] }
//      → passwords em texto puro, será hasheado com bcrypt
//   2) Objeto:    { adminPassword, users: { "email@x.com": "$2b$...hash" } }
//      → hashes já prontos (bcrypt ou SHA-256), usados diretamente
export async function POST(request: NextRequest) {
  try {
    const token = await getSessionToken(request);
    const admin = await requireAdmin(token);
    if (!admin) return unauthorized();

    const envPassword = process.env.APP_PASSWORD;
    if (!envPassword) {
      return NextResponse.json(
        { error: 'Seed desabilitado: configure APP_PASSWORD no .env' },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const rl = rateLimit(`seed:${ip}`, 2, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
    }

    const body = await request.json();
    const { adminPassword } = body;

    const aBuf = Buffer.from(adminPassword || '', 'utf8');
    const bBuf = Buffer.from(envPassword, 'utf8');
    if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) {
      auditLog({ action: 'seed_failed_auth', userId: admin.id, userEmail: admin.email, userName: admin.name, ip });
      return NextResponse.json({ error: 'Senha de administrador incorreta' }, { status: 401 });
    }

    // Detectar formato: objeto (email → hash) ou array (lista de objetos)
    const rawUsers = body.users;
    let userEntries: Array<{ email: string; password: string; name?: string | null; role?: string }> = [];

    if (Array.isArray(rawUsers)) {
      // Formato array: passwords em texto puro
      for (const u of rawUsers) {
        if (!u.email) continue;
        userEntries.push({
          email: u.email.toLowerCase().trim(),
          password: u.password || envPassword,
          name: u.name || null,
          role: u.role || 'user',
        });
      }
    } else if (rawUsers && typeof rawUsers === 'object' && !Array.isArray(rawUsers)) {
      // Formato objeto: { "email": "hash" } — hashes já prontos
      for (const [email, hash] of Object.entries(rawUsers)) {
        if (!email || typeof hash !== 'string') continue;
        userEntries.push({
          email: email.toLowerCase().trim(),
          password: hash,
          name: email.split('@')[0].replace(/[-.]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          role: 'user',
        });
      }
    }

    if (userEntries.length === 0) {
      return NextResponse.json({ error: 'Lista de usuários vazia ou formato inválido' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    let migrated = 0;

    for (const entry of userEntries) {
      const { email, password, name, role } = entry;

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        skipped++;
        continue;
      }

      let finalPassword: string;

      if (isBcryptHash(password)) {
        // Já é bcrypt — usar diretamente
        finalPassword = password;
      } else if (/^[a-f0-9]{64}$/i.test(password) && password.length === 64) {
        // Parece SHA-256 — migrar para bcrypt (será verificado no login)
        // O login já tem verifyPassword que aceita SHA-256, mas vamos converter
        // Não dá pra reverter SHA-256, então mantemos e o login aceita ambos
        finalPassword = password;
        migrated++;
      } else {
        // Texto puro — hashear com bcrypt
        finalPassword = await bcrypt.hash(password, 10);
      }

      await db.user.create({
        data: {
          email,
          name: name || null,
          password: finalPassword,
          role: role || 'user',
          department: null,
          isActive: true,
        },
      });
      created++;
    }

    auditLog({
      action: 'seed_imported',
      userId: admin.id,
      userEmail: admin.email,
      userName: admin.name,
      ip,
      details: `${created} created, ${skipped} skipped, ${migrated} sha256-migrated`,
    });

    return NextResponse.json({
      success: true,
      message: `${created} usuários criados, ${skipped} já existiam (ignorados).`,
      created,
      skipped,
      migrated,
    });
  } catch (error) {
    console.error('Erro ao popular usuários:', error);
    return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 });
  }
}
