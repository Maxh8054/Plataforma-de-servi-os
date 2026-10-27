import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido, tvUser, tvAdmin, permissoesDoUsuario } from '@/lib/tv';
import { csvResponse, csvData, csvCarimbo } from '@/lib/csv';

/**
 * GET /api/tv/[panel]/auditoria — histórico do painel para o editor (aba Histórico).
 * Lê as ações tv_* registradas no log de auditoria da plataforma (AuditLog),
 * filtrando pelo painel. Mostra quem editou/aprovou o quê e quando, além dos
 * PROBLEMAS reportados pelas TVs (action "tv_erro").
 * Acesso: admin ou usuário com permissão de edição em alguma aba do painel.
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
    const perms = await permissoesDoUsuario(panel, user.email);
    if (!perms.length) {
      return NextResponse.json(
        { error: 'Você não tem permissão para ver o histórico deste painel.' },
        { status: 403 }
      );
    }
  }

  try {
    const formato = request.nextUrl.searchParams.get('formato');
    const take = Math.min(Number(request.nextUrl.searchParams.get('take')) || 200, 400);
    const rows = await db.auditLog.findMany({
      where: {
        action: { startsWith: 'tv_' },
        // ações do painel gravam "painel=<slug> ..." no campo details
        details: { contains: `painel=${panel}` },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: { action: true, details: true, userName: true, userEmail: true, createdAt: true },
    });

    const itens = rows.map((r) => {
      const details = r.details ?? '';
      const aba = /(?:^|\s)aba=([a-zA-Z]+)/.exec(details)?.[1] ?? '';
      const info = details.replace(/painel=[a-z]+/i, '').replace(/(?:^|\s)aba=[a-zA-Z]+/, '').trim();
      return {
        acao: r.action,
        quando: r.createdAt.toISOString(),
        usuario: r.userName || r.userEmail || '',
        aba,
        info,
      };
    });

    // download CSV do histórico (aba Histórico do editor — abre direto no Excel BR)
    if (formato === 'csv') {
      const rotulo: Record<string, string> = {
        tv_secao_publicada: 'Publicou na TV',
        tv_secao_pendente: 'Enviou para aprovação',
        tv_secao_aprovada: 'Aprovou para a TV',
        tv_secao_rejeitada: 'Rejeitou alteração',
        tv_secao_conflito: 'Conflito de edição',
        tv_config_salva: 'Salvou as configurações',
        tv_config_conflito: 'Conflito nas configurações',
        tv_permissoes_definidas: 'Definiu permissões',
        tv_permissoes_removidas: 'Removeu permissões',
        tv_controle_assumido: 'Assumiu o controle da TV',
        tv_controle_liberado: 'Encerrou o controle da TV',
        tv_backup_manual: 'Criou backup manual',
        tv_backup_restaurado: 'Restaurou backup',
        tv_erro: 'Problema reportado pela TV',
      };
      return csvResponse(
        `historico-${panel}-${csvCarimbo()}.csv`,
        ['Quando', 'Ação', 'Aba', 'Usuário', 'Detalhes'],
        itens.map((i) => [csvData(i.quando), rotulo[i.acao] || i.acao, i.aba, i.usuario, i.info])
      );
    }

    return NextResponse.json(
      { itens },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[tv/auditoria] erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar histórico' }, { status: 500 });
  }
}
