import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/zab-flow/demandas/batch - Batch import demandas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { demandas } = body;

    if (!Array.isArray(demandas) || demandas.length === 0) {
      return NextResponse.json(
        { error: 'Array de demandas é obrigatório e não pode estar vazio' },
        { status: 400 }
      );
    }

    // Generate next ZAB-XX tag number
    const lastDemanda = await db.zabDemanda.findMany({
      where: { tag: { startsWith: 'ZAB-' } },
      orderBy: { id: 'desc' },
      take: 1,
    });
    let nextTagNum = 1;
    if (lastDemanda.length > 0 && lastDemanda[0].tag) {
      const match = lastDemanda[0].tag.match(/^ZAB-(\d+)$/);
      if (match) {
        nextTagNum = parseInt(match[1], 10) + 1;
      }
    }

    const generateTag = () => {
      const tag = `ZAB-${String(nextTagNum).padStart(2, '0')}`;
      nextTagNum++;
      return tag;
    };

    let created = 0;
    let updated = 0;

    const results = await db.$transaction(async (tx) => {
      const items: Record<string, unknown>[] = [];

      for (const d of demandas as Record<string, unknown>[]) {
        const existingTag = d.tag ? String(d.tag) : null;

        // If tag exists in import data, check if it already exists in DB
        let existing = null;
        if (existingTag) {
          existing = await tx.zabDemanda.findFirst({
            where: { tag: existingTag },
          });
        }

        const data = {
          funcionarioId: parseInt(String(d.funcionarioId), 10),
          nomeFuncionario: String(d.nomeFuncionario || ''),
          emailFuncionario: String(d.emailFuncionario || ''),
          categoria: String(d.categoria || ''),
          prioridade: String(d.prioridade || ''),
          complexidade: String(d.complexidade || ''),
          descricao: String(d.descricao || ''),
          local: String(d.local || ''),
          dataCriacao: d.dataCriacao ? String(d.dataCriacao) : new Date().toISOString(),
          dataLimite: String(d.dataLimite || ''),
          status: String(d.status || 'pendente'),
          isRotina: d.isRotina ? 1 : 0,
          diasSemana: d.diasSemana ? JSON.stringify(d.diasSemana) : null,
          comentarios: String(d.comentarios || ''),
          comentarioGestor: String(d.comentarioGestor || ''),
          atribuidos: JSON.stringify(d.atribuidos || []),
          anexosCriacao: JSON.stringify(d.anexosCriacao || []),
          anexosResolucao: JSON.stringify(d.anexosResolucao || []),
          comentarioReprovacaoAtribuicao: String(d.comentarioReprovacaoAtribuicao || ''),
          nomeDemanda: d.nomeDemanda ? String(d.nomeDemanda) : null,
          dataAtualizacao: new Date().toISOString(),
          dataConclusao: d.dataConclusao ? String(d.dataConclusao) : null,
          criadoPor: d.criadoPor ? parseInt(String(d.criadoPor), 10) : null,
          comentariosUsuarios: JSON.stringify(d.comentariosUsuarios || []),
        };

        if (existing) {
          // Update existing demanda with same tag
          const result = await tx.zabDemanda.update({
            where: { id: existing.id },
            data,
          });
          items.push(result as unknown as Record<string, unknown>);
          updated++;
        } else {
          // Create new demanda with new sequential tag
          const tag = existingTag || generateTag();
          const result = await tx.zabDemanda.create({
            data: {
              ...data,
              tag,
            },
          });
          items.push(result as unknown as Record<string, unknown>);
          created++;
        }
      }

      return items;
    });

    // Create audit records for batch import
    await db.zabAudit.create({
      data: {
        acao: 'BATCH_IMPORT',
        tabela: 'zab_demandas',
        registroId: 0,
        dadosNovos: JSON.stringify({ total: results.length, created, updated }),
        usuarioId: null,
      },
    });

    return NextResponse.json(
      { count: results.length, created, updated, message: `${results.length} demandas processadas (${created} criadas, ${updated} atualizadas)` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error batch importing demandas:', error);
    return NextResponse.json(
      { error: 'Erro ao importar demandas em lote' },
      { status: 500 }
    );
  }
}
