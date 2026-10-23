import ZAI from 'z-ai-web-dev-sdk';

/**
 * Geração de texto com IA para uso em rotas de backend (nunca no client).
 *
 * Produção (Render): configure as variáveis de ambiente
 *   IA_API_KEY   — chave da API (obrigatória para produção)
 *   IA_BASE_URL  — endpoint OpenAI-compatível (padrão: https://api.z.ai/api/paas/v4)
 *   IA_MODEL     — modelo (padrão: glm-4.5-flash)
 *
 * Sem IA_API_KEY, cai no SDK z-ai-web-dev-sdk (funciona no ambiente de
 * desenvolvimento, onde existe o arquivo /etc/.z-ai-config do sandbox).
 */

const BASE_PADRAO = 'https://api.z.ai/api/paas/v4';
const MODEL_PADRAO = 'glm-4.5-flash';

export class IaNaoConfiguradaError extends Error {}
export class IaFalhouError extends Error {}

export async function gerarTextoIA(system: string, user: string): Promise<string> {
  const apiKey = process.env.IA_API_KEY?.trim();
  if (apiKey) return gerarViaApi(apiKey, system, user);

  // Ambiente de desenvolvimento: SDK lê o .z-ai-config do sandbox.
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      thinking: { type: 'disabled' },
    });
    const texto = (completion.choices[0]?.message?.content || '').trim();
    if (!texto) throw new IaFalhouError('A IA não devolveu texto.');
    return texto;
  } catch (e) {
    if (e instanceof IaFalhouError) throw e;
    throw new IaNaoConfiguradaError(
      'IA não configurada neste servidor: defina IA_API_KEY nas variáveis de ambiente (Render → Environment).'
    );
  }
}

async function gerarViaApi(apiKey: string, system: string, user: string): Promise<string> {
  const base = (process.env.IA_BASE_URL?.trim() || BASE_PADRAO).replace(/\/+$/, '');
  const model = process.env.IA_MODEL?.trim() || MODEL_PADRAO;
  const ehZai = /z\.ai|bigmodel/i.test(base);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 1500,
  };
  // O parâmetro "thinking" é específico dos modelos GLM (Z.ai); outros provedores
  // OpenAI-compatíveis podem rejeitar campos desconhecidos.
  if (ehZai) body.thinking = { type: 'disabled' };

  let resp: Response;
  try {
    resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    throw new IaFalhouError(`Falha de rede chamando a IA: ${(e as Error)?.message || e}`);
  }
  if (!resp.ok) {
    let detalhe = '';
    try {
      const j = (await resp.json()) as { error?: { message?: string } | string; message?: string };
      detalhe = typeof j.error === 'string' ? j.error : j.error?.message || j.message || '';
    } catch {
      // corpo sem JSON
    }
    throw new IaFalhouError(`API de IA respondeu ${resp.status}${detalhe ? `: ${detalhe}` : ''}`);
  }
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const texto = (data.choices?.[0]?.message?.content || '').trim();
  if (!texto) throw new IaFalhouError('A IA não devolveu texto.');
  return texto;
}
