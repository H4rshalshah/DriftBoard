import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface Modal {
  id: string;
  type: string;
  props?: Record<string, unknown>;
}

interface LoadingState {
  [key: string]: boolean;
}

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
  toasts: Toast[];
  modals: Modal[];
  loading: LoadingState;
  commandPaletteOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  openModal: (type: string, props?: Record<string, unknown>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'dark',
      toasts: [],
      modals: [],
      loading: {},
      commandPaletteOpen: false,

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      setTheme: (theme) => {
        set({ theme });

        const root = document.documentElement;
        const setDark = (dark: boolean) => {
          root.classList.toggle('dark', dark);
          root.classList.toggle('light', !dark);
        };

        if (theme === 'dark') {
          setDark(true);
        } else if (theme === 'light') {
          setDark(false);
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDark(prefersDark);
        }
      },

      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const duration = toast.duration ?? 5000;

        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        if (duration > 0) {
          toastTimeout = setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearToasts: () => {
        if (toastTimeout) {
          clearTimeout(toastTimeout);
          toastTimeout = null;
        }
        set({ toasts: [] });
      },

      openModal: (type, props = {}) => {
        const id = `modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set((state) => ({
          modals: [...state.modals, { id, type, props }],
        }));
      },

      closeModal: (id) => {
        set((state) => ({
          modals: state.modals.filter((m) => m.id !== id),
        }));
      },

      closeAllModals: () => {
        set({ modals: [] });
      },

      setLoading: (key, loading) => {
        set((state) => ({
          loading: {
            ...state.loading,
            [key]: loading,
          },
        }));
      },

      setCommandPaletteOpen: (open) => {
        set({ commandPaletteOpen: open });
      },
    }),
    {
      name: 'ui-preferences',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<UIState>;
        return {
          sidebarOpen: state.sidebarOpen ?? true,
          sidebarCollapsed: state.sidebarCollapsed ?? false,
          theme: state.theme === 'system' ? 'dark' : state.theme ?? 'dark',
        };
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

export const selectIsLoading = (state: UIState, key: string) => state.loading[key] ?? false;
export const selectAnyLoading = (state: UIState) => Object.values(state.loading).some(Boolean);
export const selectActiveToasts = (state: UIState) => state.toasts;
export const selectTopModal = (state: UIState) => state.modals[state.modals.length - 1] ?? null;
