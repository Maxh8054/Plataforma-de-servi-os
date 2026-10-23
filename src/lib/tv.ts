import { db } from '@/lib/db';
import { getSessionToken, validateSession, isAdminRole } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Painel TV ZAMine — helpers compartilhados das rotas /api/tv/*
 * Painéis por regional (ex.: "goias"). Conteúdo por aba com aprovação do admin.
 */

/** Slugs de painel aceitos: painel de estado ("goias") ou por local ("minas-araxa") —
 *  minúsculas, números e hífen (ver src/lib/tv-panels.ts para a lista oficial). */
export function panelValido(panel: string): boolean {
  return /^[a-z][a-z0-9-]{1,19}$/.test(panel);
}

export function respostaPanelInvalido() {
  return NextResponse.json({ error: 'Painel inválido' }, { status: 400 });
}

export type TvUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

/** Usuário autenticado da plataforma (sessão via cookie ou header x-zamine-token) */
export async function tvUser(request: Request): Promise<TvUser | null> {
  const token = await getSessionToken(request);
  const user = await validateSession(token);
  // usuários desativados já têm a sessão derrubada no ato (sessionToken = null)
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function tvAdmin(user: TvUser | null): boolean {
  return !!user && isAdminRole(user.role);
}

/** Permissões de edição do usuário no painel: lista de sectionKey */
export async function permissoesDoUsuario(panel: string, email: string): Promise<string[]> {
  const rows = await db.tvPermissao.findMany({
    where: { panelSlug: panel, userEmail: email.toLowerCase() },
    select: { sectionKey: true },
  });
  return rows.map((r) => r.sectionKey);
}

/** Pode editar a aba? Admin pode tudo; demais precisam de concessão explícita */
export async function podeEditarSecao(
  panel: string,
  user: TvUser | null,
  sectionKey: string
): Promise<boolean> {
  if (!user) return false;
  if (tvAdmin(user)) return true;
  const perm = await db.tvPermissao.findFirst({
    where: { panelSlug: panel, userEmail: user.email.toLowerCase(), sectionKey },
    select: { id: true },
  });
  return !!perm;
}

/** Metadados de auditoria de quem salva (para "Última atualização por ...") */
export function metadadosAutor(user: TvUser) {
  return { id: user.id, nome: user.name || user.email, email: user.email };
}
