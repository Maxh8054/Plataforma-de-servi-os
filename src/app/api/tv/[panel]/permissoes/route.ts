import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin } from '@/lib/tv';

const SEC_RE = /^[a-z][a-zA-Z]{2,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// abas administrativas nunca são concedidas — são exclusivas de admins
const ADMIN_KEYS = new Set(['config', 'aprovacoes', 'permissoes']);

/**
 * Permissões de edição por aba — SOMENTE ADMIN.
 * GET    → lista todas as concessões do painel
 * POST   → { userEmail, userName?, sectionKeys: [] } define as abas do usuário (substitui tudo)
 * DELETE → ?userEmail=... remove todas as concessões do usuário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });
  }

  const rows = await db.tvPermissao.findMany({
    where: { panelSlug: panel },
    orderBy: [{ userEmail: 'asc' }, { sectionKey: 'asc' }],
  });
  return NextResponse.json({ permissoes: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });
  }

  let body: { userEmail?: string; userName?: string; sectionKeys?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = String(body.userEmail || '').toLowerCase().trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
  }
  if (!Array.isArray(body.sectionKeys) || body.sectionKeys.some((k) => !SEC_RE.test(String(k)))) {
    return NextResponse.json({ error: 'Lista de abas inválida' }, { status: 400 });
  }
  if (body.sectionKeys.some((k) => ADMIN_KEYS.has(String(k)))) {
    return NextResponse.json(
      { error: 'Abas administrativas (configurações, aprovações e permissões) são exclusivas de admins' },
      { status: 400 }
    );
  }
  const sectionKeys = [...new Set(body.sectionKeys.map((k) => String(k)))];

  // Nome: informado pelo painel ou buscado na plataforma
  let userName = typeof body.userName === 'string' ? body.userName.trim() : '';
  if (!userName) {
    const u = await db.user.findUnique({ where: { email }, select: { name: true } });
    userName = u?.name || email.split('@')[0];
  }

  await db.$transaction([
    db.tvPermissao.deleteMany({ where: { panelSlug: panel, userEmail: email } }),
    ...(sectionKeys.length
      ? [
          db.tvPermissao.createMany({
            data: sectionKeys.map((sectionKey) => ({
              panelSlug: panel,
              userEmail: email,
              userName,
              sectionKey,
              concedidoPor: user.email,
            })),
          }),
        ]
      : []),
  ]);

  auditLog({
    action: 'tv_permissoes_definidas',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    details: `painel=${panel} usuario=${email} abas=${sectionKeys.join(',') || '(nenhuma)'}`,
  });

  return NextResponse.json({ ok: true, email, userName, sectionKeys });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  if (!tvAdmin(user)) {
    return NextResponse.json({ error: 'Somente administradores' }, { status: 403 });
  }

  const email = String(new URL(request.url).searchParams.get('userEmail') || '').toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
  }

  await db.tvPermissao.deleteMany({ where: { panelSlug: panel, userEmail: email } });
  auditLog({
    action: 'tv_permissoes_removidas',
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    details: `painel=${panel} usuario=${email}`,
  });
  return NextResponse.json({ ok: true });
}
