'use client';

import { useState, useCallback } from 'react';

/**
 * Like useState but persists to localStorage.
 * Returns [value, setter] — same API as useState.
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback((val: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = val instanceof Function ? val(prev) : val;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [state, set];
}