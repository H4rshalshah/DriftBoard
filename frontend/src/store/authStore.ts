import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
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
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, username?: string) => Promise<void>;
  forgotPassword: (identifier: string) => Promise<{ message: string; resetToken?: string; expiresAt?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'github', email?: string, name?: string) => Promise<void>;
  startOAuthLogin: (provider: 'google' | 'github') => void;
  completeOAuthLogin: (token: string, user: User) => void;
  acceptInvite: (token: string, password: string) => Promise<Project>;
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

  localStorage.setItem('auth_token', token);
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
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
          const response = await api.post<{ message: string; resetToken?: string; expiresAt?: string }>('/auth/forgot-password', {
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

      resetPassword: async (token: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/reset-password', {
            token,
            newPassword,
          });
          set(applyAuthResponse(response));
          await useProjectStore.getState().fetchCurrentProject();
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
        window.location.href = `/api/auth/oauth/${provider}/start`;
      },

      completeOAuthLogin: (token: string, user: User) => {
        localStorage.setItem('auth_token', token);
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        void useProjectStore.getState().fetchCurrentProject();
      },

      acceptInvite: async (token: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<InviteAcceptResponse>(`/team/invite/${token}/accept`, {
            password,
          });
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
