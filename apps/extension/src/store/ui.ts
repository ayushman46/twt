import { create } from 'zustand';
import type { SortKey } from '@/lib/query';
import { updateSettings, type ViewMode } from '@/lib/storage';

interface AiState {
  running: boolean;
  done: number;
  total: number;
  failed: number;
  error?: string;
}

interface UiState {
  query: string;
  sort: SortKey;
  view: ViewMode | null;
  selection: Set<string>;
  activeId: string | null;
  focusId: string | null;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  collectionDialog: { open: boolean; editId?: string; addIds?: string[] };
  ai: AiState;
  setQuery: (q: string) => void;
  setSort: (s: SortKey) => void;
  setView: (v: ViewMode) => void;
  toggleSelect: (id: string) => void;
  setSelection: (ids: Iterable<string>) => void;
  clearSelection: () => void;
  openDetail: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  setPaletteOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  openCollectionDialog: (opts?: { editId?: string; addIds?: string[] }) => void;
  closeCollectionDialog: () => void;
  setAi: (patch: Partial<AiState>) => void;
}

export const useUi = create<UiState>((set) => ({
  query: '',
  sort: 'saved',
  view: null,
  selection: new Set(),
  activeId: null,
  focusId: null,
  paletteOpen: false,
  shortcutsOpen: false,
  collectionDialog: { open: false },
  ai: { running: false, done: 0, total: 0, failed: 0 },
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  setView: (view) => {
    set({ view });
    // Remember the last layout as the default.
    void updateSettings({ defaultView: view });
  },
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selection: next };
    }),
  setSelection: (ids) => set({ selection: new Set(ids) }),
  clearSelection: () => set({ selection: new Set() }),
  openDetail: (activeId) => set({ activeId }),
  setFocus: (focusId) => set({ focusId }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  openCollectionDialog: (opts) => set({ collectionDialog: { open: true, ...opts } }),
  closeCollectionDialog: () => set({ collectionDialog: { open: false } }),
  setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
}));
