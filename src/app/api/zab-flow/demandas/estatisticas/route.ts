import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zab-flow/demandas/estatisticas - Get statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const funcionarioId = searchParams.get('funcionarioId');

    const where: Record<string, unknown> = {};
    if (funcionarioId) {
      where.funcionarioId = parseInt(funcionarioId, 10);
    }

    // Get all demandas
    const demandas = await db.zabDemanda.findMany({ where });

    // Count by status
    const byStatus: Record<string, number> = {};
    demandas.forEach((d) => {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });

    // Count by category
    const byCategory: Record<string, number> = {};
    demandas.forEach((d) => {
      byCategory[d.categoria] = (byCategory[d.categoria] || 0) + 1;
    });

    // Count by priority
    const byPriority: Record<string, number> = {};
    demandas.forEach((d) => {
      byPriority[d.prioridade] = (byPriority[d.prioridade] || 0) + 1;
    });

    // Count by complexity
    const byComplexidade: Record<string, number> = {};
    demandas.forEach((d) => {
      byComplexidade[d.complexidade] = (byComplexidade[d.complexidade] || 0) + 1;
    });

    // Count by local
    const byLocal: Record<string, number> = {};
    demandas.forEach((d) => {
      byLocal[d.local] = (byLocal[d.local] || 0) + 1;
    });

    // Overdue count (not concluded and past deadline)
    const today = new Date().toISOString().split('T')[0];
    const overdue = demandas.filter(
      (d) => d.status !== 'aprovada' && d.status !== 'reprovada' && d.status !== 'finalizado_pendente_aprovacao' && d.dataLimite < today
    ).length;

    // Completed count (aprovada)
    const completed = byStatus['aprovada'] || 0;

    // Routine vs non-routine
    const rotina = demandas.filter((d) => d.isRotina === 1).length;

    // In analysis count
    const emAnalise = byStatus['finalizado_pendente_aprovacao'] || 0;

    return NextResponse.json({
      total: demandas.length,
      byStatus,
      byCategory,
      byPriority,
      byComplexidade,
      byLocal,
      overdue,
      completed,
      rotina,
      naoRotina: demandas.length - rotina,
      emAnalise,
    });
  } catch (error) {
    console.error('Error getting estatisticas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
