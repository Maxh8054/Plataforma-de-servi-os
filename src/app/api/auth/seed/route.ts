import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

// POST - Popular banco com usuários iniciais (requer senha admin)
export async function POST(request: NextRequest) {
  try {
    const { adminPassword, users } = await request.json();

    // Proteção: requer a senha de admin do .env ou a senha padrão inicial
    const envPassword = process.env.APP_PASSWORD || '2026';
    if (adminPassword !== envPassword) {
      return NextResponse.json({ error: 'Senha de administrador incorreta' }, { status: 401 });
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Lista de usuários inválida' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;

    for (const userData of users) {
      const email = userData.email?.toLowerCase().trim();
      if (!email) continue;

      // Verificar se já existe
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        skipped++;
        continue;
      }

      // Gerar salt e hash da senha
      const password = userData.password || '2026';
      const salt = randomBytes(16).toString('hex');
      const hash = createHash('sha256').update(password + salt).digest('hex');

      await db.user.create({
        data: {
          email,
          name: userData.name || null,
          passwordHash: `${salt}:${hash}`,
          role: userData.role || 'user',
          department: userData.department || null,
          active: true,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      message: `${created} usuários criados, ${skipped} já existiam (ignorados).`,
      created,
      skipped,
    });
  } catch (error) {
    console.error('Erro ao popular usuários:', error);
    return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 });
  }
}
