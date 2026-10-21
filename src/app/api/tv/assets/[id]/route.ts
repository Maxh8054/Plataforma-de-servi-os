import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/tv/assets/[id] — serve a imagem do painel (público: a TV exibe sem login).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const asset = await db.tvAsset.findUnique({
    where: { id },
    select: { mime: true, bytes: true },
  });
  if (!asset) {
    return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      'Content-Type': asset.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
