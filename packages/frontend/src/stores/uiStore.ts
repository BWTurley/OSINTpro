import { create } from 'zustand';
import type { Notification } from '@/types';

type Theme = 'dark' | 'light';
type ActivePanel = 'graph' | 'map' | 'timeline' | 'entities' | 'notes' | null;

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  activePanel: ActivePanel;
  notifications: Notification[];
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
  }
  localStorage.setItem('theme', theme);
}

let notifCounter = 0;

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  sidebarOpen: true,
  activePanel: null,
  notifications: [],

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setActivePanel: (panel) => set({ activePanel: panel }),

  addNotification: (notif) => {
    const id = `notif-${++notifCounter}`;
    const notification: Notification = { ...notif, id };
    set((s) => ({ notifications: [...s.notifications, notification] }));

    const duration = notif.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));
