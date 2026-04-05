import { create } from 'zustand';
import type { Case } from '@/types';

interface CaseState {
  cases: Case[];
  activeCase: Case | null;
  selectedEntityIds: Set<string>;
  isLoading: boolean;
  totalCases: number;
  setCases: (cases: Case[], total: number) => void;
  setActiveCase: (c: Case | null) => void;
  updateCase: (c: Case) => void;
  addCase: (c: Case) => void;
  removeCase: (id: string) => void;
  selectEntity: (id: string) => void;
  deselectEntity: (id: string) => void;
  toggleEntitySelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  activeCase: null,
  selectedEntityIds: new Set(),
  isLoading: false,
  totalCases: 0,

  setCases: (cases, total) => set({ cases, totalCases: total }),

  setActiveCase: (c) => set({ activeCase: c, selectedEntityIds: new Set() }),

  updateCase: (updated) =>
    set((state) => ({
      cases: state.cases.map((c) => (c.id === updated.id ? updated : c)),
      activeCase: state.activeCase?.id === updated.id ? updated : state.activeCase,
    })),

  addCase: (c) =>
    set((state) => ({
      cases: [c, ...state.cases],
      totalCases: state.totalCases + 1,
    })),

  removeCase: (id) =>
    set((state) => ({
      cases: state.cases.filter((c) => c.id !== id),
      totalCases: state.totalCases - 1,
      activeCase: state.activeCase?.id === id ? null : state.activeCase,
    })),

  selectEntity: (id) =>
    set((state) => {
      const next = new Set(state.selectedEntityIds);
      next.add(id);
      return { selectedEntityIds: next };
    }),

  deselectEntity: (id) =>
    set((state) => {
      const next = new Set(state.selectedEntityIds);
      next.delete(id);
      return { selectedEntityIds: next };
    }),

  toggleEntitySelection: (id) => {
    const { selectedEntityIds } = get();
    if (selectedEntityIds.has(id)) {
      get().deselectEntity(id);
    } else {
      get().selectEntity(id);
    }
  },

  clearSelection: () => set({ selectedEntityIds: new Set() }),

  selectAll: (ids) => set({ selectedEntityIds: new Set(ids) }),

  setLoading: (loading) => set({ isLoading: loading }),
}));
