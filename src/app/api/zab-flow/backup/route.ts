import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseDemanda(d: Record<string, unknown>) {
  return {
    ...d,
    atribuidos: safeJsonParse(d.atribuidos as string, []),
    anexosCriacao: safeJsonParse(d.anexosCriacao as string, []),
    anexosResolucao: safeJsonParse(d.anexosResolucao as string, []),
    comentariosUsuarios: safeJsonParse(d.comentariosUsuarios as string, []),
    diasSemana: safeJsonParse(d.diasSemana as string | null, null),
    isRotina: d.isRotina === 1 || d.isRotina === true,
  };
}

// GET /api/zab-flow/backup - Export all data as JSON
export async function GET() {
  try {
    const [demandas, usuarios, feedbacks, anotacoes] = await Promise.all([
      db.zabDemanda.findMany({ orderBy: { id: 'asc' } }),
      db.zabUsuario.findMany({ orderBy: { id: 'asc' } }),
      db.zabFeedback.findMany({ orderBy: { id: 'asc' } }),
      db.zabNote.findMany({ orderBy: { id: 'asc' } }),
    ]);

    // Parse JSON fields in demandas
    const parsedDemandas = demandas.map((d) =>
      parseDemanda(d as unknown as Record<string, unknown>)
    );

    // Parse conquistas in usuarios
    const parsedUsuarios = usuarios.map((u) => ({
      ...u,
      conquistas: safeJsonParse(u.conquistas, []),
    }));

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      demandas: parsedDemandas,
      usuarios: parsedUsuarios,
      feedbacks,
      anotacoes,
      counts: {
        demandas: demandas.length,
        usuarios: usuarios.length,
        feedbacks: feedbacks.length,
        anotacoes: anotacoes.length,
      },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json(
      { error: 'Erro ao exportar backup' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/backup - Restore demandas from JSON backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { demandas } = body;

    if (!Array.isArray(demandas)) {
      return NextResponse.json(
        { error: 'Array de demandas é obrigatório' },
        { status: 400 }
      );
    }

    const results = await db.$transaction(
      demandas.map((d: Record<string, unknown>) =>
        db.zabDemanda.create({
          data: {
            funcionarioId: parseInt(String(d.funcionarioId), 10),
            nomeFuncionario: String(d.nomeFuncionario || ''),
            emailFuncionario: String(d.emailFuncionario || ''),
            categoria: String(d.categoria || ''),
            prioridade: String(d.prioridade || ''),
            complexidade: String(d.complexidade || ''),
            descricao: String(d.descricao || ''),
            local: String(d.local || ''),
            dataLimite: String(d.dataLimite || ''),
            status: String(d.status || 'pendente'),
            isRotina: d.isRotina ? 1 : 0,
            diasSemana: d.diasSemana ? JSON.stringify(d.diasSemana) : null,
            tag: d.tag ? String(d.tag) : `DEM-RESTORE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            comentarios: String(d.comentarios || ''),
            comentarioGestor: String(d.comentarioGestor || ''),
            dataConclusao: d.dataConclusao ? String(d.dataConclusao) : null,
            atribuidos: JSON.stringify(d.atribuidos || []),
            anexosCriacao: JSON.stringify(d.anexosCriacao || []),
            anexosResolucao: JSON.stringify(d.anexosResolucao || []),
            comentarioReprovacaoAtribuicao: String(d.comentarioReprovacaoAtribuicao || ''),
            nomeDemanda: d.nomeDemanda ? String(d.nomeDemanda) : null,
            criadoPor: d.criadoPor ? parseInt(String(d.criadoPor), 10) : null,
            comentariosUsuarios: JSON.stringify(d.comentariosUsuarios || []),
          },
        })
      )
    );

    // Create audit record for restore
    await db.zabAudit.create({
      data: {
        acao: 'RESTORE',
        tabela: 'zab_demandas',
        registroId: 0,
        dadosNovos: JSON.stringify({ count: results.length }),
        usuarioId: null,
      },
    });

    return NextResponse.json({
      message: 'Backup restaurado com sucesso',
      count: results.length,
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Erro ao restaurar backup' },
      { status: 500 }
    );
  }
}
