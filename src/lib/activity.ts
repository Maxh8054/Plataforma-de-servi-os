'use client';

import { authFetch } from '@/store/auth-store';

/**
 * Rastreio de atividade do usuário:
 * - trackView(view): registra na auditoria qual tela/aba foi acessada
 * - sendHeartbeat(): mantém a presença "online" (lastSeenAt no banco)
 */

let lastView = '';
let lastViewAt = 0;

export function trackView(view: string): void {
  const now = Date.now();
  if (view === lastView && now - lastViewAt < 3000) return; // debounce simples
  lastView = view;
  lastViewAt = now;

  authFetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ view }),
  }).catch(() => {});
}

export function sendHeartbeat(): void {
  authFetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).catch(() => {});
}
