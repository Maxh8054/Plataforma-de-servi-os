import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tvUser } from '@/lib/tv';

const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX = 3 * 1024 * 1024; // 3 MB (o app já comprime antes de enviar)

/**
 * POST /api/tv/upload — envia imagem do painel (fotos de DDS, comunicados, etc).
 * Qualquer usuário logado da plataforma pode enviar (a edição da aba é validada separadamente).
 * Retorna { id, url } — a URL é guardada no conteúdo da aba.
 */
export async function POST(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Envio inválido' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
  }
  if (!MIMES.has(file.type)) {
    return NextResponse.json({ error: 'Formato não aceito. Use JPG, PNG ou WebP.' }, { status: 415 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: 'Imagem grande demais (máx. 3 MB)' }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const asset = await db.tvAsset.create({
    data: {
      mime: file.type,
      size: file.size,
      bytes,
      uploadedPor: user.email,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: asset.id, url: `/api/tv/assets/${asset.id}` });
}
