import { create } from 'zustand';
import type { Entity, GraphData } from '@/types';

interface EntityState {
  selectedEntity: Entity | null;
  entityCache: Map<string, Entity>;
  graphData: GraphData | null;
  isLoading: boolean;
  setSelectedEntity: (entity: Entity | null) => void;
  cacheEntity: (entity: Entity) => void;
  cacheEntities: (entities: Entity[]) => void;
  getCachedEntity: (id: string) => Entity | undefined;
  setGraphData: (data: GraphData | null) => void;
  clearGraph: () => void;
  setLoading: (loading: boolean) => void;
  clearCache: () => void;
}

export const useEntityStore = create<EntityState>((set, get) => ({
  selectedEntity: null,
  entityCache: new Map(),
  graphData: null,
  isLoading: false,

  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  cacheEntity: (entity) =>
    set((state) => {
      const next = new Map(state.entityCache);
      next.set(entity.id, entity);
      return { entityCache: next };
    }),

  cacheEntities: (entities) =>
    set((state) => {
      const next = new Map(state.entityCache);
      for (const e of entities) {
        next.set(e.id, e);
      }
      return { entityCache: next };
    }),

  getCachedEntity: (id) => get().entityCache.get(id),

  setGraphData: (data) => set({ graphData: data }),

  clearGraph: () => set({ graphData: null }),

  setLoading: (loading) => set({ isLoading: loading }),

  clearCache: () => set({ entityCache: new Map(), graphData: null }),
}));
