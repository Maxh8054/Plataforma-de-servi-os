'use client';

import React, { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { create } from 'zustand';
import { useReportStore } from '@/store/reportStore';
import { useHomeReportStore } from '@/store/homeReportStore';
import { CloudCheck, CloudCog, CloudOff, Loader2 } from 'lucide-react';

/**
 * Autosave do Criar Relatórios ligado ao LOGIN da pessoa.
 *
 * - Qualquer edição (Relatório Home ou Inspeção) é salva no banco a cada
 *   2,5s (debounce) e imediatamente ao recarregar/sair da página.
 * - Ao abrir o app, o rascunho do usuário volta do servidor — mesmo que
 *   seja outro computador, pois está amarrado ao login da plataforma.
 * - A MESMA sessão em dois navegadores também sincroniza: quem editou
 *   por último vence (lastLocalEdit).
 */

const SAVE_DEBOUNCE_MS = 2500;

type DraftType = 'home' | 'inspecao';
type SyncStatus = 'restoring' | 'saving' | 'saved' | 'offline';

interface DraftSyncState {
  status: SyncStatus;
  lastSavedAt: number | null;
  setStatus: (status: SyncStatus, lastSavedAt?: number) => void;
}

export const useDraftSyncStore = create<DraftSyncState>((set) => ({
  status: 'restoring',
  lastSavedAt: null,
  setStatus: (status, lastSavedAt) =>
    set((s) => ({ status, lastSavedAt: lastSavedAt ?? s.lastSavedAt })),
}));

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('zamine_token');
}

function snapshotInspecao() {
  const s = useReportStore.getState();
  return {
    inspection: s.inspection,
    photos: s.photos,
    additionalParts: s.additionalParts,
    conclusion: s.conclusion,
    lastLocalEdit: s.lastLocalEdit,
  };
}

function snapshotHome() {
  const s = useHomeReportStore.getState();
  return {
    inspection: s.inspection,
    categories: s.categories,
    conclusion: s.conclusion,
    lastLocalEdit: s.lastLocalEdit,
  };
}

export function DraftSync() {
  const { status: authStatus } = useSession();

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    let cancelled = false;
    const dirty = new Set<DraftType>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const setStatus = useDraftSyncStore.getState().setStatus;

    const handleSessionLost = () => {
      // Token da plataforma expirou/saiu — derruba a sessão e volta ao gate
      signOut({ redirect: false })
        .catch(() => {})
        .finally(() => window.location.reload());
    };

    const saveType = async (type: DraftType) => {
      const token = getToken();
      if (!token) return;
      const payload = type === 'inspecao' ? snapshotInspecao() : snapshotHome();
      try {
        const res = await fetch('/api/reports/drafts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-zamine-token': token },
          body: JSON.stringify({ reportType: type, data: payload }),
          keepalive: true,
        });
        if (cancelled) return;
        if (res.status === 401) {
          handleSessionLost();
          return;
        }
        setStatus(res.ok ? 'saved' : 'offline', res.ok ? Date.now() : undefined);
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };

    const flush = () => {
      if (dirty.size === 0) return;
      const types = Array.from(dirty);
      dirty.clear();
      types.forEach((t) => { void saveType(t); });
    };

    const restore = async () => {
      const token = getToken();
      if (!token) {
        setStatus('offline');
        return;
      }
      try {
        const res = await fetch('/api/reports/drafts', {
          headers: { 'x-zamine-token': token },
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 401) {
          handleSessionLost();
          return;
        }
        if (!res.ok) {
          setStatus('offline');
          return;
        }
        const json = await res.json();
        const drafts: Array<{ reportType: string; data: string; updatedAt: string }> = json?.drafts || [];

        for (const d of drafts) {
          if (!d.data || (d.reportType !== 'home' && d.reportType !== 'inspecao')) continue;
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
          } catch {
            continue;
          }
          const serverTime = Number(parsed?.lastLocalEdit) || new Date(d.updatedAt).getTime();

          if (d.reportType === 'inspecao') {
            const localTime = useReportStore.getState().lastLocalEdit || 0;
            if (serverTime > localTime) {
              // Servidor é mais recente → restaura (merge com prioridade ao servidor)
              useReportStore.getState().mergeFromData(parsed as never, serverTime);
            } else if (localTime > 0) {
              dirty.add('inspecao'); // local é mais novo → sobe para o servidor
            }
          } else {
            const localTime = useHomeReportStore.getState().lastLocalEdit || 0;
            if (serverTime > localTime) {
              useHomeReportStore.getState().mergeFromData(parsed as never, serverTime);
            } else if (localTime > 0) {
              dirty.add('home');
            }
          }
        }

        if (cancelled) return;
        flush();
        setStatus('saved', Date.now());
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };

    const scheduleSave = (type: DraftType) => {
      dirty.add(type);
      setStatus('saving');
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    };

    // Edições em qualquer um dos dois relatórios disparam autosave
    const unsubInspecao = useReportStore.subscribe((state, prev) => {
      if (state.lastLocalEdit !== prev.lastLocalEdit) scheduleSave('inspecao');
    });
    const unsubHome = useHomeReportStore.subscribe((state, prev) => {
      if (state.lastLocalEdit !== prev.lastLocalEdit) scheduleSave('home');
    });

    // Recarregar / fechar aba / trocar de aba → salva na hora
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onPageHide = () => flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    void restore();

    return () => {
      cancelled = true;
      unsubInspecao();
      unsubHome();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [authStatus]);

  return <DraftSyncPill />;
}

function DraftSyncPill() {
  const status = useDraftSyncStore((s) => s.status);
  const lastSavedAt = useDraftSyncStore((s) => s.lastSavedAt);

  const time = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const content = (() => {
    switch (status) {
      case 'saving':
        return { icon: <CloudCog className="h-3.5 w-3.5 animate-pulse" />, text: 'Salvando na nuvem...' };
      case 'saved':
        return { icon: <CloudCheck className="h-3.5 w-3.5" />, text: time ? `Rascunho salvo ${time}` : 'Rascunho salvo na nuvem' };
      case 'offline':
        return { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Offline — salvo apenas neste aparelho' };
      default:
        return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Restaurando rascunho...' };
    }
  })();

  return (
    <div className="fixed bottom-3 left-3 z-40 pointer-events-none" aria-live="polite">
      <div className="flex items-center gap-1.5 rounded-full bg-black/70 text-white/80 text-xs px-3 py-1.5 border border-white/10 backdrop-blur-sm shadow-lg">
        {content.icon}
        <span>{content.text}</span>
      </div>
    </div>
  );
}
