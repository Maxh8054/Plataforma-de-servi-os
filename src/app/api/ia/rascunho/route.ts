import { NextRequest, NextResponse } from 'next/server';
import { gerarTextoIA, IaFalhouError, IaNaoConfiguradaError } from '@/lib/ia';
import { tvUser } from '@/lib/tv';

/**
 * POST /api/ia/rascunho — rascunhos de conteúdo da TV com IA (backend only).
 * body: { tipo: 'dds' | 'mensagem' | 'campanha', tema, detalhes?, unidade? }
 * Retorna { texto } pronto para colar no editor. Qualquer usuário logado usa.
 */

const TIPOS: Record<string, string> = {
  dds:
    'Escreva um roteiro curto de DDS (Diálogo Diário de Segurança) para leitura em voz alta de 1 a 2 minutos, em português do Brasil, tom respeitoso e direto. Comece com uma frase de abertura que prenda a atenção, traga 3 pontos objetivos e feche chamando a equipe para a ação. Sem títulos, sem markdown, sem numeração longa — texto corrido em parágrafos curtos.',
  mensagem:
    'Escreva UMA frase curta de segurança do trabalho (máximo 110 caracteres), em português do Brasil, com impacto positivo e sem clichês, pronta para aparecer num letreiro de TV industrial. Só a frase, sem aspas, sem emoji.',
  campanha:
    'Escreva UMA frase curta de lançamento de campanha de segurança (máximo 140 caracteres), em português do Brasil, motivadora, para um slide de TV na fábrica. Só a frase, sem aspas, sem emoji.',
};

// limites simples por usuário (evita abuso): 30 gerações por hora
const USO = new Map<string, { hora: number; n: number }>();

export async function POST(request: NextRequest) {
  const user = await tvUser(request);
  if (!user) return NextResponse.json({ error: 'Faça login na plataforma' }, { status: 401 });

  let body: { tipo?: string; tema?: string; detalhes?: string; unidade?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const tipo = String(body.tipo || '');
  const instrucao = TIPOS[tipo];
  if (!instrucao) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

  const tema = String(body.tema || '').trim().slice(0, 200);
  if (!tema) return NextResponse.json({ error: 'Escreva o tema do conteúdo' }, { status: 400 });
  const detalhes = String(body.detalhes || '').trim().slice(0, 500);
  const unidade = String(body.unidade || '').trim().slice(0, 60);

  // limite de uso
  const horaAtual = Math.floor(Date.now() / 3600e3);
  const uso = USO.get(user.email);
  if (uso && uso.hora === horaAtual && uso.n >= 30) {
    return NextResponse.json({ error: 'Limite de gerações por hora atingido. Tente mais tarde.' }, { status: 429 });
  }
  USO.set(user.email, uso && uso.hora === horaAtual ? { hora: horaAtual, n: uso.n + 1 } : { hora: horaAtual, n: 1 });

  const pedido =
    (unidade ? `Contexto: unidade industrial ${unidade}. ` : '') +
    `Tema: ${tema}.` +
    (detalhes ? ` Detalhes que devem ser considerados: ${detalhes}.` : '');

  const SISTEMA =
    'Você redige conteúdo para painéis de TV de segurança do trabalho de uma indústria brasileira. ' +
    'Responda SOMENTE com o texto pedido, sem introdução, sem explicação e sem markdown.';

  try {
    const texto = await gerarTextoIA(SISTEMA, `${instrucao}\n\n${pedido}`);
    return NextResponse.json({ texto: texto.slice(0, 4000) });
  } catch (e) {
    if (e instanceof IaNaoConfiguradaError) {
      console.error('[ia/rascunho] não configurada:', (e as Error).message);
      return NextResponse.json(
        { error: 'IA não configurada neste servidor. O administrador precisa definir IA_API_KEY nas variáveis de ambiente do Render (Environment).' },
        { status: 503 }
      );
    }
    console.error('[ia/rascunho] erro:', (e instanceof IaFalhouError ? e.message : (e as Error)?.message || e)?.slice(0, 300));
    return NextResponse.json({ error: 'IA indisponível agora. Escreva manualmente e tente de novo depois.' }, { status: 502 });
  }
}
