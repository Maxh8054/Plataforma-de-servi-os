'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useHomeReportStore } from '@/store/homeReportStore';
import { useReportStore } from '@/store/reportStore';

/**
 * Returns true once ALL persisted Zustand stores have finished
 * rehydrating from IndexedDB. Uses useSyncExternalStore to avoid
 * the "setState in effect" lint warning.
 */
export function useStoresHydrated(): boolean {
  const homePersist = (useHomeReportStore as any).persist;
  const inspPersist = (useReportStore as any).persist;

  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubs: (() => void)[] = [];
      if (homePersist?.onFinishHydration) unsubs.push(homePersist.onFinishHydration(callback));
      if (inspPersist?.onFinishHydration) unsubs.push(inspPersist.onFinishHydration(callback));
      // Safety timeout — if IndexedDB is slow, don't block forever (3s)
      const timer = setTimeout(callback, 3000);
      return () => {
        unsubs.forEach((u) => u?.());
        clearTimeout(timer);
      };
    },
    [homePersist, inspPersist]
  );

  const getSnapshot = useCallback(() => {
    const homeDone = homePersist?.hasHydrated?.() ?? true;
    const inspDone = inspPersist?.hasHydrated?.() ?? true;
    return homeDone && inspDone;
  }, [homePersist, inspPersist]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}