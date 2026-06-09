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

// GET /api/zab-flow/demandas - List all demandas with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const funcionarioId = searchParams.get('funcionarioId');
    const categoria = searchParams.get('categoria');
    const prioridade = searchParams.get('prioridade');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (funcionarioId) {
      where.funcionarioId = parseInt(funcionarioId, 10);
    }
    if (categoria) {
      where.categoria = categoria;
    }
    if (prioridade) {
      where.prioridade = prioridade;
    }

    // Date range filter by month/year
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const endMonth = m === 12 ? 1 : m + 1;
      const endYear = m === 12 ? y + 1 : y;
      const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      // SQLite string comparison for date filtering on dataCriacao
      where.dataCriacao = {
        gte: startStr,
        lt: endStr,
      };
    } else if (year) {
      const y = parseInt(year, 10);
      where.dataCriacao = {
        gte: `${y}-01-01`,
        lt: `${y + 1}-01-01`,
      };
    }

    // Search filter - search by nomeDemanda, descricao, and tag
    if (search) {
      where.OR = [
        { nomeDemanda: { contains: search } },
        { descricao: { contains: search } },
        { tag: { contains: search } },
      ];
    }

    const demandas = await db.zabDemanda.findMany({
      where,
      orderBy: { id: 'desc' },
    });

    const parsed = demandas.map((d) => parseDemanda(d as unknown as Record<string, unknown>));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error listing demandas:', error);
    return NextResponse.json(
      { error: 'Erro ao listar demandas' },
      { status: 500 }
    );
  }
}

// POST /api/zab-flow/demandas - Create new demanda
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      funcionarioId,
      nomeFuncionario,
      emailFuncionario,
      categoria,
      prioridade,
      complexidade,
      descricao,
      local,
      dataLimite,
      status,
      isRotina,
      diasSemana,
      comentarios,
      comentarioGestor,
      atribuidos,
      anexosCriacao,
      nomeDemanda,
      criadoPor,
      comentariosUsuarios,
    } = body;

    // Validate required fields
    if (!funcionarioId || !nomeFuncionario || !emailFuncionario) {
      return NextResponse.json(
        { error: 'funcionarioId, nomeFuncionario e emailFuncionario são obrigatórios' },
        { status: 400 }
      );
    }
    if (!categoria || !prioridade || !complexidade) {
      return NextResponse.json(
        { error: 'categoria, prioridade e complexidade são obrigatórios' },
        { status: 400 }
      );
    }
    if (!descricao || !local || !dataLimite) {
      return NextResponse.json(
        { error: 'descricao, local e dataLimite são obrigatórios' },
        { status: 400 }
      );
    }

    // Auto-generate sequential tag: ZAB-01, ZAB-02, ...
    const lastDemanda = await db.zabDemanda.findMany({
      where: { tag: { startsWith: 'ZAB-' } },
      orderBy: { id: 'desc' },
      take: 1,
    });
    let nextNum = 1;
    if (lastDemanda.length > 0 && lastDemanda[0].tag) {
      const match = lastDemanda[0].tag.match(/^ZAB-(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const tag = `ZAB-${String(nextNum).padStart(2, '0')}`;

    const demanda = await db.zabDemanda.create({
      data: {
        funcionarioId: parseInt(funcionarioId, 10),
        nomeFuncionario,
        emailFuncionario,
        categoria,
        prioridade,
        complexidade,
        descricao,
        local,
        dataCriacao: new Date().toISOString(),
        dataLimite,
        status: status || 'pendente',
        isRotina: isRotina ? 1 : 0,
        diasSemana: diasSemana ? JSON.stringify(diasSemana) : null,
        tag,
        comentarios: comentarios || '',
        comentarioGestor: comentarioGestor || '',
        atribuidos: JSON.stringify(atribuidos || []),
        anexosCriacao: JSON.stringify(anexosCriacao || []),
        anexosResolucao: '[]',
        comentarioReprovacaoAtribuicao: '',
        nomeDemanda: nomeDemanda || null,
        dataAtualizacao: new Date().toISOString(),
        criadoPor: criadoPor ? parseInt(criadoPor, 10) : null,
        comentariosUsuarios: JSON.stringify(comentariosUsuarios || []),
      },
    });

    // Create audit record
    await db.zabAudit.create({
      data: {
        acao: 'CREATE',
        tabela: 'zab_demandas',
        registroId: demanda.id,
        dadosNovos: JSON.stringify(demanda),
        usuarioId: criadoPor ? parseInt(criadoPor, 10) : null,
      },
    });

    return NextResponse.json(
      parseDemanda(demanda as unknown as Record<string, unknown>),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating demanda:', error);
    return NextResponse.json(
      { error: 'Erro ao criar demanda' },
      { status: 500 }
    );
  }
}
