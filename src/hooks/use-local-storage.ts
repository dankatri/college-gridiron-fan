import { useState, useEffect, useCallback, useRef } from 'react';

// Field names that should be revived as Date objects from JSON
const DATE_FIELD_NAMES = new Set([
  'joinedAt', 'createdAt', 'updatedAt', 'lastUpdated',
  'timestamp', 'expiresAt', 'gameDate',
]);

function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && DATE_FIELD_NAMES.has(_key)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

function readStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw, dateReviver) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Drop-in replacement for Spark's useKV hook, backed by localStorage.
 * Supports functional updaters and cross-tab sync via storage events.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readStorage(key, defaultValue));
  const keyRef = useRef(key);
  keyRef.current = key;

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function'
          ? (value as (prev: T) => T)(prev)
          : value;
        try {
          localStorage.setItem(keyRef.current, JSON.stringify(next));
        } catch (e) {
          console.warn('localStorage write failed:', e);
        }
        return next;
      });
    },
    [],
  );

  // Sync across tabs via storage events
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === localStorage) {
        setState(e.newValue === null
          ? defaultValue
          : readStorage(key, defaultValue));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, defaultValue]);

  // Re-read if the key changes (e.g. user id changes)
  useEffect(() => {
    setState(readStorage(key, defaultValue));
  }, [key]);

  return [state, setValue];
}
