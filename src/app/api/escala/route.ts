import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEFAULT_DATA = {
  atestados: { A: [], B: [], C: [], D: [] },
  spots: { A: [], B: [], C: [], D: [] },
  adms: { A: [], B: [], C: [], D: [] },
  eventos: { A: [], B: [], C: [], D: [] },
};

export async function GET() {
  try {
    const record = await db.escalaData.findUnique({ where: { id: 1 } });

    if (!record) {
      // Initialize with default data
      const newRecord = await db.escalaData.create({
        data: { id: 1, dados: JSON.stringify(DEFAULT_DATA) },
      });
      return NextResponse.json(JSON.parse(newRecord.dados));
    }

    return NextResponse.json(JSON.parse(record.dados));
  } catch (error) {
    console.error('Error fetching escala data:', error);
    return NextResponse.json(DEFAULT_DATA);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { atestados, spots, adms, eventos } = body;

    const data = JSON.stringify({ atestados, spots, adms, eventos });

    const record = await db.escalaData.upsert({
      where: { id: 1 },
      update: { dados: data },
      create: { id: 1, dados: data },
    });

    return NextResponse.json({ success: true, data: JSON.parse(record.dados) });
  } catch (error) {
    console.error('Error saving escala data:', error);
    return NextResponse.json({ success: false, error: 'Failed to save data' }, { status: 500 });
  }
}
