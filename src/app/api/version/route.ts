import { NextResponse } from 'next/server';

// RENDER_GIT_COMMIT muda a cada deploy no Render
// Em local dev, usa versao fixa
const BUILD_VERSION = process.env.RENDER_GIT_COMMIT || 'local-dev';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: BUILD_VERSION,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
