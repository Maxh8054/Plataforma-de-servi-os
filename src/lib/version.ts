/**
 * Versão da aplicação.
 * 
 * A cada deploy, incremente esse número.
 * O Service Worker usa essa versão para invalidar o cache antigo.
 */
export const APP_VERSION = 3;

/** Data/hora do último deploy (preenchido manualmente) */
export const DEPLOY_DATE = "31/07/2026";

/** Formato legível para exibir na UI */
export const VERSION_DISPLAY = `v${APP_VERSION} — ${DEPLOY_DATE}`;
