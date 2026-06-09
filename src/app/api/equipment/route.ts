import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all equipment with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const local = searchParams.get('local') || '';
    const empresa = searchParams.get('empresa') || '';
    const cliente = searchParams.get('cliente') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { equipamento: { contains: search } },
        { modelo: { contains: search } },
        { cliente: { contains: search } },
        { size: { contains: search } },
        { local: { contains: search } },
        { empresa: { contains: search } },
        { ano: { contains: search } },
        { statusOperacao: { contains: search } },
        { motivoStandby: { contains: search } },
        { falhasCriticas: { contains: search } },
      ];
    }

    if (local) where.local = { contains: local };
    if (empresa) where.empresa = { contains: empresa };
    if (cliente) where.cliente = { contains: cliente };
    if (status) where.statusOperacao = { contains: status };

    const equipment = await db.equipment.findMany({
      where,
      orderBy: { equipamento: 'asc' },
    });

    const allEquipment = await db.equipment.findMany();
    const filters = {
      locais: [...new Set(allEquipment.map(e => e.local).filter(Boolean))].sort(),
      empresas: [...new Set(allEquipment.map(e => e.empresa).filter(Boolean))].sort(),
      clientes: [...new Set(allEquipment.map(e => e.cliente).filter(Boolean))].sort(),
      status: [...new Set(allEquipment.map(e => e.statusOperacao).filter(Boolean))].sort(),
    };

    return NextResponse.json({ equipment, filters });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ error: 'Erro ao buscar equipamentos' }, { status: 500 });
  }
}

// POST - Import equipment from spreadsheet (requires password)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data } = body;

    if (password !== '2026') {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    await db.equipment.deleteMany();

    const equipmentData = data.map((item: Record<string, string>) => ({
      equipamento: item.equipamento || '',
      modelo: item.modelo || '',
      cliente: item.cliente || '',
      size: item.size || '',
      local: item.local || '',
      empresa: item.empresa || '',
      ano: item.ano || '',
      statusOperacao: item.statusOperacao || null,
      motivoStandby: item.motivoStandby || null,
      falhasCriticas: item.falhasCriticas || null,
    }));

    const result = await db.equipment.createMany({
      data: equipmentData,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} equipamentos importados com sucesso!`,
    });
  } catch (error) {
    console.error('Error importing equipment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao importar equipamentos: ' + errorMessage }, { status: 500 });
  }
}

// DELETE - Clear all equipment (requires password)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    if (password !== '2026') {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    await db.equipment.deleteMany();

    return NextResponse.json({ success: true, message: 'Todos os equipamentos foram removidos' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    return NextResponse.json({ error: 'Erro ao remover equipamentos' }, { status: 500 });
  }
}
