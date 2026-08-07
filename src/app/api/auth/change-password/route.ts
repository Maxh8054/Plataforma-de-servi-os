import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compare, hash } from 'bcryptjs';
import { getSessionToken, validateSession } from '@/lib/auth';
import { auditLog } from '@/lib/audit-log';

const PASSWORD_RULES = [
  { test: (pw: string) => pw.length >= 8, error: 'Pelo menos 8 caracteres' },
  { test: (pw: string) => /[A-Z]/.test(pw), error: 'Pelo menos 1 maiuscula' },
  { test: (pw: string) => /[a-z]/.test(pw), error: 'Pelo menos 1 minuscula' },
  { test: (pw: string) => /[0-9]/.test(pw), error: 'Pelo menos 1 numero' },
  { test: (pw: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\`~]/.test(pw), error: 'Pelo menos 1 especial' },
];

export async function POST(request: Request) {
  try {
    const token = await getSessionToken(request);
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Senhas sao obrigatorias' }, { status: 400 });
    }

    // Validate new password strength
    const errors = PASSWORD_RULES.filter(r => !r.test(newPassword)).map(r => r.error);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Senha nao atende aos requisitos', details: errors }, { status: 400 });
    }

    // Verify current password
    const fullUser = await db.user.findUnique({ where: { id: user.id }, select: { password: true, email: true } });
    if (!fullUser?.password) {
      return NextResponse.json({ error: 'Senha atual nao encontrada' }, { status: 400 });
    }

    const isValid = await compare(currentPassword, fullUser.password);
    if (!isValid) {
      auditLog({ action: 'change_password_failed', userId: user.id, userEmail: user.email, userName: user.name, details: 'Senha atual incorreta' });
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    // New password must differ from current
    const sameAsCurrent = await compare(newPassword, fullUser.password);
    if (sameAsCurrent) {
      return NextResponse.json({ error: 'A nova senha deve ser diferente da atual' }, { status: 400 });
    }

    // Hash and update
    const bcryptHash = await hash(newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { password: bcryptHash },
    });

    auditLog({ action: 'password_changed', userId: user.id, userEmail: user.email, userName: user.name });

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso!' });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
