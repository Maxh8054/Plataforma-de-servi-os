import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin, permissoesDoUsuario } from '@/lib/tv';

/**
 * GET /api/tv/[panel]/me — quem está logado e o que pode fazer no painel.
 * Retorna: usuário, se é admin, abas com permissão de edição e total de pendências.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });
  }

  const admin = tvAdmin(user);
  const permissoes = admin ? [] : await permissoesDoUsuario(panel, user.email);

  const pendencias = await db.tvSection.count({
    where: { panelSlug: panel, pendingData: { not: null } },
  });

  return NextResponse.json({
    user: { name: user.name, email: user.email, role: user.role },
    isAdmin: admin,
    permissoes, // abas que este usuário pode editar (vazio para admin = todas)
    pendencias,
  });
}
