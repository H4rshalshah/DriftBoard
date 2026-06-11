import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from '../services/api';
import { getApiBaseUrl } from '../services/runtimeConfig';
import { useProjectStore, type Project } from './projectStore';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'owner' | 'member' | 'viewer';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  rehydrateSession: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, username?: string) => Promise<void>;
  forgotPassword: (identifier: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPassword: string, email?: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'github', email?: string, name?: string) => Promise<void>;
  startOAuthLogin: (provider: 'google' | 'github') => void;
  completeOAuthLogin: (token: string, user: User) => void;
  acceptInvite: (token: string, data: {
    password: string;
    accountMode: 'existing' | 'new';
    accountPassword?: string;
    name?: string;
    username?: string;
    newPassword?: string;
  }) => Promise<Project>;
  logout: () => void;
  setUser: (user: User) => void;
  clearError: () => void;
}

type AuthResponse = {
  user: User;
  token?: string;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

type InviteAcceptResponse = AuthResponse & {
  project: Project;
};

function applyAuthResponse(response: AuthResponse) {
  const token = response.token || response.tokens?.accessToken;
  const refreshToken = response.tokens?.refreshToken;

  if (!token) {
    throw new Error('Authentication token was not returned');
  }

  sessionStorage.setItem('auth_token', token);
  localStorage.removeItem('auth_token');
  if (refreshToken) {
    sessionStorage.setItem('refresh_token', refreshToken);
    localStorage.removeItem('refresh_token');
  }

  return {
    user: response.user,
    token,
    isAuthenticated: true,
    isLoading: false,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      rehydrateSession: async () => {
        const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }
        sessionStorage.setItem('auth_token', token);
        localStorage.removeItem('auth_token');
        const legacyRefreshToken = localStorage.getItem('refresh_token');
        if (legacyRefreshToken && !sessionStorage.getItem('refresh_token')) {
          sessionStorage.setItem('refresh_token', legacyRefreshToken);
        }
        localStorage.removeItem('refresh_token');
        set({ isLoading: true, error: null, token, isAuthenticated: true });
        try {
          const user = await api.get<User>('/auth/me');
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('refresh_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Session expired',
          });
        }
      },

      login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/login', {
            identifier,
            password,
          });
          set(applyAuthResponse(response));
          await useProjectStore.getState().fetchCurrentProject();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || 'Login failed'
              : 'Login failed';

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string, username?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/register', {
            email,
            password,
            name,
            username,
          });
          set(applyAuthResponse(response));
          await useProjectStore.getState().fetchCurrentProject();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || 'Registration failed'
              : 'Registration failed';

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      forgotPassword: async (identifier: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ message: string }>('/auth/forgot-password', {
            identifier,
          });
          set({ isLoading: false, error: null });
          return response;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || 'Password reset failed'
              : 'Password reset failed';

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      resetPassword: async (token: string, newPassword: string, email?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ message: string }>('/auth/reset-password', {
            token,
            newPassword,
            email,
          });
          set({ isLoading: false, error: null });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || 'Could not reset password'
              : 'Could not reset password';

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      socialLogin: async (provider: 'google' | 'github', email?: string, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/social', {
            provider,
            email,
            name,
          });
          set(applyAuthResponse(response));
          await useProjectStore.getState().fetchCurrentProject();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || `Could not continue with ${provider}`
              : `Could not continue with ${provider}`;

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      startOAuthLogin: (provider: 'google' | 'github') => {
        window.location.href = `${getApiBaseUrl()}/auth/oauth/${provider}/start`;
      },

      completeOAuthLogin: (token: string, user: User) => {
        sessionStorage.setItem('auth_token', token);
        localStorage.removeItem('auth_token');
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        void useProjectStore.getState().fetchCurrentProject();
      },

      acceptInvite: async (token, data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<InviteAcceptResponse>(`/team/invite/${token}/accept`, data);
          set(applyAuthResponse(response));
          useProjectStore.setState((state) => ({
            projects: [response.project, ...state.projects.filter((project) => project.id !== response.project.id)],
            currentProject: response.project,
          }));
          return response.project;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message || 'Could not accept invite'
              : 'Could not accept invite';

          set({
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      logout: () => {
        void api.post('/auth/logout').catch(() => undefined);
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      version: 3,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUserRole = (state: AuthState) => state.user?.role;
