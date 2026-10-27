/**
 * Registro central dos PAINÉIS DE TV da plataforma.
 *
 * Hierarquia: ESTADO → LOCAL (unidade). Dentro de um estado pode haver
 * vários locais, cada um com seu próprio painel de TV: conteúdo, canais,
 * permissões de edição e controle em tempo real próprios.
 *
 * O slug é a chave usada em TODAS as tabelas de TV (TvSection, TvPanelConfig,
 * TvPermissao, TvControl) e nas rotas /api/tv/[panel]/... — não há mudança
 * de schema: um local novo funciona assim que entra nesta lista.
 *
 * Convenção de slug: estado simples ("goias", "minas") = painel do estado
 * (todas as unidades); "estado-local" ("minas-araxa") = painel exclusivo
 * daquele local. Tudo minúsculo, sem acento, hífen separando o local.
 */

export interface TvPainelInfo {
  /** slug único do painel (chave no banco e nas rotas) */
  slug: string;
  /** slug do estado a que o painel pertence (o próprio slug nos painéis de estado) */
  estado: string;
  /** nome do estado exibido ao usuário */
  estadoNome: string;
  /** nome do local/unidade exibido ao usuário */
  localNome: string;
  /** arquivo HTML do painel que atende este painel (query ?panel= diferencia os locais) */
  arquivo: string;
}

/** Lista dos painéis existentes — adicionar um local novo aqui é o bastante. */
export const TV_PANEIS: TvPainelInfo[] = [
  { slug: 'goias', estado: 'goias', estadoNome: 'Goiás', localNome: 'Goiás', arquivo: 'painel-tv-goias.html' },
  { slug: 'minas', estado: 'minas', estadoNome: 'Minas Gerais', localNome: 'Minas Gerais', arquivo: 'painel-tv-minas.html' },
  { slug: 'minas-araxa', estado: 'minas', estadoNome: 'Minas Gerais', localNome: 'Araxá', arquivo: 'painel-tv-minas.html' },
  { slug: 'minas-usiminas', estado: 'minas', estadoNome: 'Minas Gerais', localNome: 'Usiminas', arquivo: 'painel-tv-minas.html' },
];

/** Info do painel pelo slug (null se o slug não existe no registro). */
export function infoPainel(slug: string): TvPainelInfo | null {
  return TV_PANEIS.find((p) => p.slug === slug) ?? null;
}

/** Estado a que o painel pertence ("minas-araxa" → "minas"); null se o slug não existe. */
export function estadoDoPainel(slug: string): string | null {
  return infoPainel(slug)?.estado ?? null;
}

/** Slugs válidos (fonte única para /api/tv/panels e validações). */
export function slugsDePaineis(): string[] {
  return TV_PANEIS.map((p) => p.slug);
}
