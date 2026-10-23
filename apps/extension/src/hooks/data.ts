import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';
import { db } from '@/lib/db';
import { DEFAULT_SETTINGS, IDLE_SYNC, mergeSettings, settingsItem, syncStateItem, updateSettings, type Settings, type SyncState } from '@/lib/storage';
import type { Category, Collection } from '@/lib/types';


export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
}

export function useCollections(): Collection[] {
  return useLiveQuery(() => db.collections.orderBy('order').toArray(), []) ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStorageItem<T>(item: WxtStorageItem<T, any>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    void item.getValue().then((v) => alive && setValue(v));
    const unwatch = item.watch((v) => setValue(v));
    return () => {
      alive = false;
      unwatch();
    };
  }, [item]);
  return value;
}

export function useSettings(): [Settings, (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<Settings>, boolean] {
  const [value, setValue] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void settingsItem.getValue().then((v) => {
      if (!alive) return;
      setValue(mergeSettings(v));
      setLoaded(true);
    });
    const unwatch = settingsItem.watch((v) => setValue(mergeSettings(v)));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);
  return [value, updateSettings, loaded];
}

export function useSyncState(): SyncState {
  return useStorageItem(syncStateItem, IDLE_SYNC);
}

/** Apply the theme class on <html>, following the OS when set to "system". */
export function useThemeClass(theme: Settings['theme']) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
