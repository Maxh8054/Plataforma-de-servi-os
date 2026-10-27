import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit-log';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin, permissoesDoUsuario } from '@/lib/tv';

/**
 * Controle em tempo real do painel TV.
 *
 * Uma pessoa por vez assume o comando do que a TV mostra (pausar, avançar, voltar,
 * escolher tela) — ex.: conduzir o DDS com o slide parado. O estado vive no banco e as
 * TVs/controladores leem com polling leve (~2,5s), então funciona em qualquer deploy
 * do Next (sem serviço extra).
 *
 * Regras:
 * - Pode controlar quem tem permissão de editar alguma aba do painel (ou admin).
 * - O controle é EXCLUSIVO: enquanto alguém tem o controle, os outros recebem "em uso por ...".
 * - ADMIN pode assumir por cima ou encerrar o controle de qualquer um.
 * - Expira SOZINHO: 8 minutos sem usar (navegar/pausar/escolher tela renova o tempo) ou
 *   sem heartbeat (PC fechou/dormiu). A TV volta sozinha à rotação automática.
 */

export const dynamic = 'force-dynamic';

/** sem heartbeat nesse intervalo = quem controlava sumiu (PC dormiu/fechou) */
const EXPIRA_MS = 70000;
/** tempo total sem USAR o controle (ação real: acquire/goto) antes de expirar sozinho.
 *  O heartbeat (beat) NÃO renova esse tempo — só prova que o PC está ligado. */
const OCIOSO_MS = 8 * 60 * 1000;

type TvControlRow = {
  panelSlug: string;
  donoEmail: string | null;
  donoNome: string | null;
  donoAdmin: boolean;
  pausado: boolean;
  slide: string;
  rev: number;
  beatAt: Date | null;
  ultimaAcaoAt: Date | null;
  desde: Date | null;
};

function estadoDe(row: TvControlRow | null) {
  const ativo = !!row && !!row.donoEmail && !!row.beatAt;
  const ancora = row?.ultimaAcaoAt ?? row?.desde ?? null;
  const expiraEmSeg = ativo && ancora ? Math.max(0, Math.ceil((OCIOSO_MS - (Date.now() - ancora.getTime())) / 1000)) : null;
  return {
    ativo,
    donoEmail: ativo ? row!.donoEmail : null,
    donoNome: ativo ? row!.donoNome || row!.donoEmail : null,
    donoAdmin: ativo ? row!.donoAdmin : false,
    pausado: ativo ? row!.pausado : false,
    slide: ativo ? row!.slide || '' : '',
    rev: row?.rev ?? 0,
    desde: ativo && row!.desde ? row!.desde.toISOString() : null,
    // segundos restantes antes de expirar por ociosidade (8 min sem usar); null = sem limite conhecido
    expiraEmSeg,
  };
}

const LIVRE = {
  donoEmail: null,
  donoNome: null,
  donoAdmin: false,
  pausado: false,
  slide: '',
  beatAt: null as Date | null,
  ultimaAcaoAt: null as Date | null,
  desde: null as Date | null,
};

/** Devolve o lock ao normal quando quem controlava sumiu (sem heartbeat)
 *  ou ficou 8 minutos sem usar o controle (sem ação real) */
async function linhaComExpiracao(panel: string): Promise<TvControlRow | null> {
  const row = await db.tvControl.findUnique({ where: { panelSlug: panel } });
  if (!row || !row.donoEmail) return row;
  const morto = !row.beatAt || Date.now() - row.beatAt.getTime() > EXPIRA_MS;
  // sem últimaAcao (linhas antigas), cai no relógio do heartbeat como antes
  const ocioso = !!row.ultimaAcaoAt && Date.now() - row.ultimaAcaoAt.getTime() > OCIOSO_MS;
  if (!morto && !ocioso) return row;
  return db.tvControl.update({
    where: { panelSlug: panel },
    data: { ...LIVRE, rev: { increment: 1 } },
  });
}

async function donoAtual(panel: string) {
  const row = await linhaComExpiracao(panel);
  return row && row.donoEmail
    ? { email: row.donoEmail, nome: row.donoNome || row.donoEmail }
    : null;
}

/**
 * GET /api/tv/[panel]/control — estado do controle (público: a TV lê sem login).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();
  try {
    const row = await linhaComExpiracao(panel);
    return NextResponse.json(estadoDe(row));
  } catch {
    return NextResponse.json(estadoDe(null));
  }
}

/**
 * POST /api/tv/[panel]/control — ações: acquire | release | goto | beat.
 * Body: { acao, slide?, pausado? } — autentica pelo login da plataforma (header/cookie).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const user = await tvUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Faça login na plataforma para controlar a TV.' },
      { status: 401 }
    );
  }
  const admin = tvAdmin(user);
  if (!admin) {
    const perms = await permissoesDoUsuario(panel, user.email);
    if (!perms.length) {
      return NextResponse.json(
        { error: 'Você não tem permissão para controlar este painel. Peça acesso ao administrador.' },
        { status: 403 }
      );
    }
  }

  let body: { acao?: string; slide?: string; pausado?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* body vazio */
  }
  const acao = String(body.acao || '');
  const dono = await donoAtual(panel);
  const ehDono = !!dono && dono.email.toLowerCase() === user.email.toLowerCase();

  if (acao === 'acquire') {
    // exclusivo: ocupado por outra pessoa e não-sou-admin => "em uso por ..."
    if (dono && !ehDono && !admin) {
      return NextResponse.json(
        { error: 'em-uso', donoNome: dono.nome },
        { status: 409 }
      );
    }
    const assumiuPorCima = !!dono && !ehDono;
    const upd = await db.tvControl.upsert({
      where: { panelSlug: panel },
      update: {
        donoEmail: user.email,
        donoNome: user.name || user.email,
        donoAdmin: admin,
        pausado: body.pausado !== false,
        slide: String(body.slide || ''),
        rev: { increment: 1 },
        beatAt: new Date(),
        ultimaAcaoAt: new Date(),
        desde: dono && ehDono ? undefined : new Date(),
      },
      create: {
        panelSlug: panel,
        donoEmail: user.email,
        donoNome: user.name || user.email,
        donoAdmin: admin,
        pausado: body.pausado !== false,
        slide: String(body.slide || ''),
        beatAt: new Date(),
        ultimaAcaoAt: new Date(),
        desde: new Date(),
        rev: 1,
      },
    });
    // histórico: quem assumiu o comando da TV (e se foi admin por cima)
    if (!ehDono) {
      auditLog({
        action: 'tv_controle_assumido',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        details: `painel=${panel} controle=TV${assumiuPorCima ? ' assumiu por cima de ' + dono!.nome : ''}`,
      });
    }
    return NextResponse.json(estadoDe(upd));
  }

  if (acao === 'release') {
    if (dono && !ehDono && !admin) {
      return NextResponse.json(
        { error: `Só quem assumiu o controle (ou um admin) pode encerrar — está com ${dono.nome}.` },
        { status: 403 }
      );
    }
    const upd = await db.tvControl.upsert({
      where: { panelSlug: panel },
      update: { ...LIVRE, rev: { increment: 1 } },
      create: { panelSlug: panel },
    });
    if (dono) {
      auditLog({
        action: 'tv_controle_liberado',
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        details: `painel=${panel} controle=TV liberado por ${user.name || user.email}${dono.email !== user.email ? ` (estava com ${dono.nome})` : ''}`,
      });
    }
    return NextResponse.json(estadoDe(upd));
  }

  if (acao === 'goto') {
    if (!dono) {
      return NextResponse.json(
        { error: 'Ninguém está com o controle agora.' },
        { status: 409 }
      );
    }
    if (!ehDono && !admin) {
      return NextResponse.json(
        { error: `Controle em uso por ${dono.nome}.` },
        { status: 403 }
      );
    }
    const upd = await db.tvControl.update({
      where: { panelSlug: panel },
      data: {
        slide: String(body.slide || ''),
        pausado: body.pausado !== false,
        rev: { increment: 1 },
        beatAt: new Date(),
        ultimaAcaoAt: new Date(), // usar o controle renova os 8 minutos
      },
    });
    return NextResponse.json(estadoDe(upd));
  }

  if (acao === 'beat') {
    if (ehDono) {
      await db.tvControl
        .update({ where: { panelSlug: panel }, data: { beatAt: new Date() } })
        .catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
