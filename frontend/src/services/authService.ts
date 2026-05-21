import { api } from './api';
import type { ApiError } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  emailNotifications: boolean;
  driftAlerts: boolean;
  weeklyReport: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<AuthResponse>;
  register(email: string, password: string, name: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<{ token: string; expiresAt: string }>;
  getCurrentUser(): Promise<User>;
  updateProfile(data: ProfileUpdateRequest): Promise<User>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
}

class AuthServiceImpl implements AuthService {
  private readonly baseUrl = '/auth';

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(`${this.baseUrl}/login`, {
        email,
        password,
      });

      this.setTokens(response.token, response.refreshToken);
      return response;
    } catch (error) {
      throw this.createError(this.handleError(error));
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>(`${this.baseUrl}/register`, {
        email,
        password,
        name,
      });

      this.setTokens(response.token, response.refreshToken);
      return response;
    } catch (error) {
      throw this.createError(this.handleError(error));
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await api.post(`${this.baseUrl}/logout`, { refreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:loggedOut'));
    }
  }

  async refreshToken(): Promise<{ token: string; expiresAt: string }> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await api.post<{ token: string; expiresAt: string }>(
        `${this.baseUrl}/refresh`,
        { refreshToken }
      );

      localStorage.setItem('auth_token', response.token);
      return response;
    } catch (error) {
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      return await api.get<User>(`${this.baseUrl}/me`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(data: ProfileUpdateRequest): Promise<User> {
    try {
      return await api.patch<User>(`${this.baseUrl}/profile`, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/change-password`, {
        oldPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private setTokens(token: string, refreshToken: string): void {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  private createError(apiError: ApiError): Error & ApiError {
    const error = new Error(apiError.message);
    return Object.assign(error, apiError);
  }

  private handleError(error: unknown): ApiError {
    if ('message' in (error as Record<string, unknown>)) {
      return error as ApiError;
    }
    return {
      message: 'An unexpected error occurred',
      code: 'AUTH_ERROR',
    };
  }
}

export const authService = new AuthServiceImpl();
export default authService;
