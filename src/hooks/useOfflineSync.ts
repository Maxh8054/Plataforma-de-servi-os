'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  hasPendingSync: boolean;
  lastSyncTime: Date | null;
}

interface PendingData {
  id: string;
  type: 'inspection' | 'photos' | 'conclusion';
  data: any;
  timestamp: number;
}

const DB_NAME = 'z-services-offline';
const DB_VERSION = 1;

// Abrir IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('pendingData')) {
        const store = db.createObjectStore('pendingData', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('reportCache')) {
        db.createObjectStore('reportCache', { keyPath: 'id' });
      }
    };
  });
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: false,
    hasPendingSync: false,
    lastSyncTime: null,
  });

  const [pendingCount, setPendingCount] = useState(0);

  // Ref para evitar problemas de dependência circular
  const syncPendingDataRef = useRef<() => Promise<void>>(async () => {});
  const checkPendingDataRef = useRef<() => Promise<void>>(async () => {});

  // Verificar dados pendentes
  const checkPendingData = useCallback(async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['pendingData'], 'readonly');
      const store = transaction.objectStore('pendingData');
      const count = await new Promise<number>((resolve) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
      
      setPendingCount(count);
      setState(prev => ({ ...prev, hasPendingSync: count > 0 }));
    } catch (error) {
      console.error('Failed to check pending data:', error);
    }
  }, []);

  // Sincronizar dados pendentes
  const syncPendingData = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      const db = await openDatabase();
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      
      const allData = await new Promise<PendingData[]>((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });

      for (const item of allData) {
        // Aqui você enviaria para o servidor
        // Por enquanto, apenas removemos da fila
        store.delete(item.id);
      }

      setState(prev => ({
        ...prev,
        hasPendingSync: false,
        lastSyncTime: new Date(),
      }));
      
      setPendingCount(0);
    } catch (error) {
      console.error('Failed to sync pending data:', error);
    }
  }, []);

  // Atualizar refs
  useEffect(() => {
    syncPendingDataRef.current = syncPendingData;
    checkPendingDataRef.current = checkPendingData;
  }, [syncPendingData, checkPendingData]);

  // Verificar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true, isOffline: false }));
      // Sincronizar quando voltar online
      syncPendingDataRef.current();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar dados pendentes
    checkPendingDataRef.current();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Salvar dados localmente (para uso offline)
  const saveLocally = useCallback(async (id: string, type: PendingData['type'], data: any) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['pendingData', 'reportCache'], 'readwrite');
      
      // Salvar em pendingData (para sincronização)
      const pendingStore = transaction.objectStore('pendingData');
      await new Promise<void>((resolve, reject) => {
        const request = pendingStore.put({
          id: `${type}-${id}`,
          type,
          data,
          timestamp: Date.now(),
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Salvar em reportCache (cache local)
      const cacheStore = transaction.objectStore('reportCache');
      await new Promise<void>((resolve, reject) => {
        const request = cacheStore.put({ id, data, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      checkPendingDataRef.current();
    } catch (error) {
      console.error('Failed to save data locally:', error);
    }
  }, []);

  // Obter dados do cache local
  const getLocalData = useCallback(async (id: string): Promise<any | null> => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['reportCache'], 'readonly');
      const store = transaction.objectStore('reportCache');
      
      return new Promise((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Failed to get local data:', error);
      return null;
    }
  }, []);

  // Limpar cache local
  const clearLocalCache = useCallback(async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['pendingData', 'reportCache'], 'readwrite');
      
      transaction.objectStore('pendingData').clear();
      transaction.objectStore('reportCache').clear();
      
      setPendingCount(0);
      setState(prev => ({ ...prev, hasPendingSync: false }));
    } catch (error) {
      console.error('Failed to clear local cache:', error);
    }
  }, []);

  return {
    ...state,
    pendingCount,
    saveLocally,
    getLocalData,
    syncPendingData,
    clearLocalCache,
    checkPendingData,
  };
}

// Hook para registrar o Service Worker
export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Registrar Service Worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
        setIsRegistered(true);

        // Verificar atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setNeedsUpdate(true);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });

    // Listener para mensagens do SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        console.log('Background sync completed');
      }
    });
  }, []);

  const updateServiceWorker = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  }, []);

  return {
    isRegistered,
    needsUpdate,
    updateServiceWorker,
  };
}
