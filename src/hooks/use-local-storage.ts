import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

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

// One value and one listener set per key, shared by every hook instance in this
// document. Storage events only reach *other* documents, so without this two
// components reading the same key drift apart until a reload: the app keeps the
// mobile and desktop player tables mounted at the same time, and only one of
// them would have seen the change.
const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function currentValue<T>(key: string, defaultValue: T): T {
  if (!values.has(key)) values.set(key, readStorage(key, defaultValue));
  return values.get(key) as T;
}

function publish(key: string, value: unknown): void {
  values.set(key, value);
  for (const listener of listeners.get(key) ?? []) listener();
}

/**
 * Drop-in replacement for Spark's useKV hook, backed by localStorage.
 * Supports functional updaters, and keeps every reader of a key in step both
 * within this document and across tabs.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const subscribe = useCallback((listener: () => void) => {
    let keyListeners = listeners.get(key);
    if (!keyListeners) {
      keyListeners = new Set();
      listeners.set(key, keyListeners);
    }
    keyListeners.add(listener);
    return () => {
      keyListeners.delete(listener);
      if (keyListeners.size === 0) listeners.delete(key);
    };
  }, [key]);

  const getSnapshot = useCallback(() => currentValue(key, defaultRef.current), [key]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next = typeof value === 'function'
        ? (value as (prev: T) => T)(currentValue(key, defaultRef.current))
        : value;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.warn('localStorage write failed:', e);
      }
      // Published even if the write failed, so a storage error degrades to an
      // unsaved preference rather than an unresponsive control.
      publish(key, next);
    },
    [key],
  );

  // Sync across tabs via storage events
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === localStorage) {
        publish(key, e.newValue === null ? defaultRef.current : readStorage(key, defaultRef.current));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]);

  return [state, setValue];
}
