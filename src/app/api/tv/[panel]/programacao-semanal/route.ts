import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { panelValido, respostaPanelInvalido, tvUser } from '@/lib/tv';

/**
 * Programação Semanal de manutenção (tela "Programação Semanal" do painel TV).
 *
 * O sistema SÓ cria a semana que o usuário informar — exemplo: quer a semana 1,
 * digita 1 no editor e salva; nada de semanas automáticas. Tudo o que é lançado
 * (paradas das máquinas, backlogs) e tudo o que é realizado (backlogs marcados
 * como concluídos) vai para o banco: uma linha por painel + ano + semana ISO.
 *
 * GET    ?ano=2026&semana=1   → a programação dessa semana ({ criada:false } se nunca criada)
 * GET    ?listar=1            → lista das semanas JÁ criadas (a TV usa para saber se o slide entra na rotação)
 * POST   { ano, semana, data }→ cria/atualiza EXATAMENTE a semana informada (upsert)
 * DELETE ?ano=2026&semana=1   → apaga a semana informada (semana criada sem querer)
 */

const ANO_MIN = 2020;
const ANO_MAX = 2040;

/** Limpa o JSON das máquinas: só os campos conhecidos, sem lixo e com tamanho limitado. */
function limparData(entrada: unknown): string | null {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null;
  const maquinasIn = (entrada as { machines?: unknown }).machines;
  if (!maquinasIn || typeof maquinasIn !== 'object' || Array.isArray(maquinasIn)) return null;
  const machines: Record<string, { dia: string; horas: string; motivo: string; backlogs: string; done: number[] }> = {};
  let total = 0;
  for (const [tag, bruta] of Object.entries(maquinasIn as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9 .\-_/]{1,24}$/.test(tag)) continue;
    if (!bruta || typeof bruta !== 'object') continue;
    const m = bruta as Record<string, unknown>;
    const txt = (v: unknown, max: number) =>
      typeof v === 'string' ? v.slice(0, max) : '';
    const dia = txt(m.dia, 20);
    const horas = txt(m.horas, 12);
    const motivo = txt(m.motivo, 300);
    const backlogs = txt(m.backlogs, 8000);
    const done = Array.isArray(m.done)
      ? [...new Set(m.done.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 400))].slice(0, 400)
      : [];
    total += backlogs.length + motivo.length;
    machines[tag] = { dia, horas, motivo, backlogs, done };
  }
  if (total > 60000) return null; // trava de tamanho (~60 KB de texto por semana)
  return JSON.stringify({ machines });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  try {
    if (request.nextUrl.searchParams.get('listar')) {
      const semanas = await db.tvProgramacaoSemanal.findMany({
        where: { panelSlug: panel },
        select: { ano: true, semana: true, atualizadoEm: true },
        orderBy: [{ ano: 'asc' }, { semana: 'asc' }],
      });
      return NextResponse.json({ semanas }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const ano = Number(request.nextUrl.searchParams.get('ano'));
    const semana = Number(request.nextUrl.searchParams.get('semana'));
    if (!Number.isInteger(ano) || !Number.isInteger(semana)) {
      return NextResponse.json({ error: 'Ano e semana são obrigatórios.' }, { status: 400 });
    }
    const rec = await db.tvProgramacaoSemanal.findUnique({
      where: { panelSlug_ano_semana: { panelSlug: panel, ano, semana } },
    });
    if (!rec) return NextResponse.json({ criada: false });
    return NextResponse.json(
      {
        criada: true,
        ano: rec.ano,
        semana: rec.semana,
        data: rec.data ? JSON.parse(rec.data) : {},
        atualizadoEm: rec.atualizadoEm,
        atualizadoPorNome: rec.atualizadoPorNome,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[tv/programacao-semanal GET] erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar a programação.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  let body: { ano?: unknown; semana?: unknown; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }

  const ano = Number(body.ano);
  const semana = Number(body.semana);
  if (!Number.isInteger(ano) || ano < ANO_MIN || ano > ANO_MAX) {
    return NextResponse.json({ error: 'Ano inválido.' }, { status: 400 });
  }
  if (!Number.isInteger(semana) || semana < 1 || semana > 53) {
    return NextResponse.json({ error: 'Semana inválida (1 a 53).' }, { status: 400 });
  }
  const dataLimpa = limparData(body.data);
  if (dataLimpa === null) {
    return NextResponse.json({ error: 'Dados da programação inválidos.' }, { status: 400 });
  }

  try {
    // quem salvou: logado na plataforma (editor no PC) → nome; TV/editor da tela → null
    const user = await tvUser(request).catch(() => null);
    const rec = await db.tvProgramacaoSemanal.upsert({
      where: { panelSlug_ano_semana: { panelSlug: panel, ano, semana } },
      create: { panelSlug: panel, ano, semana, data: dataLimpa, atualizadoEm: new Date(), atualizadoPorNome: user?.name ?? null },
      update: { data: dataLimpa, atualizadoEm: new Date(), atualizadoPorNome: user?.name ?? null },
    });
    return NextResponse.json({ ok: true, id: rec.id, atualizadoEm: rec.atualizadoEm });
  } catch (error) {
    console.error('[tv/programacao-semanal POST] erro:', error);
    return NextResponse.json({ error: 'Erro ao salvar a programação.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ panel: string }> }
) {
  const { panel } = await params;
  if (!panelValido(panel)) return respostaPanelInvalido();

  const ano = Number(request.nextUrl.searchParams.get('ano'));
  const semana = Number(request.nextUrl.searchParams.get('semana'));
  if (!Number.isInteger(ano) || !Number.isInteger(semana)) {
    return NextResponse.json({ error: 'Ano e semana são obrigatórios.' }, { status: 400 });
  }

  try {
    await db.tvProgramacaoSemanal.delete({
      where: { panelSlug_ano_semana: { panelSlug: panel, ano, semana } },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[tv/programacao-semanal DELETE] erro:', error);
    // registro inexistente já é o resultado desejado — responde ok
    return NextResponse.json({ ok: true });
  }
}
