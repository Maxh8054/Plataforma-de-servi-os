import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { PREDEFINED_USERS } from '@/lib/reports-auth';

// GET - Verificar usuários no banco
export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Error checking users:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST - Popular banco com usuários pré-definidos
export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();
    
    // Segurança simples
    if (secret !== 'z-services-setup-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let created = 0;
    let existing = 0;

    let updated = 0;

    for (const user of PREDEFINED_USERS) {
      const existingUser = await db.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await db.user.create({
          data: {
            email: user.email,
            name: user.name,
            password: hashedPassword,
          },
        });
        created++;
      } else {
        // Resetar senha para o padrão atual
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await db.user.update({
          where: { email: user.email },
          data: {
            name: user.name,
            password: hashedPassword,
          },
        });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Setup completo: ${created} criados, ${updated} atualizados`,
      created,
      updated,
    });
  } catch (error) {
    console.error('Error setting up users:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
