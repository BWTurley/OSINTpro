import { create } from 'zustand';
import type { CollectionJob, IntelModule } from '@/types';

interface CollectionState {
  jobs: CollectionJob[];
  totalJobs: number;
  counts: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  modules: IntelModule[];
  isLoading: boolean;
  setJobs: (jobs: CollectionJob[], total: number, counts: CollectionState['counts']) => void;
  updateJob: (job: Partial<CollectionJob> & { id: string }) => void;
  addJob: (job: CollectionJob) => void;
  setModules: (modules: IntelModule[]) => void;
  updateModule: (module: Partial<IntelModule> & { id: string }) => void;
  setLoading: (loading: boolean) => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  jobs: [],
  totalJobs: 0,
  counts: { queued: 0, running: 0, completed: 0, failed: 0 },
  modules: [],
  isLoading: false,

  setJobs: (jobs, total, counts) => set({ jobs, totalJobs: total, counts }),

  updateJob: (partial) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === partial.id ? { ...j, ...partial } : j
      ),
    })),

  addJob: (job) =>
    set((state) => ({
      jobs: [job, ...state.jobs],
      totalJobs: state.totalJobs + 1,
    })),

  setModules: (modules) => set({ modules }),

  updateModule: (partial) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === partial.id ? { ...m, ...partial } : m
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
