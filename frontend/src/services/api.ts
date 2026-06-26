import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getApiBaseUrl } from './runtimeConfig';

const API_BASE_URL = getApiBaseUrl();
// Increase timeout to 60s to handle backend cold starts (Render free tier spins down)
const REQUEST_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '60000', 10);

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        const sessionToken = sessionStorage.getItem('session_token');
        if (sessionToken && config.headers && !config.headers.Authorization) {
          config.headers['X-Session-Token'] = sessionToken;
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const requestUrl = originalRequest.url || '';
        const isAuthEntryRequest = /\/auth\/(login|register|social|oauth|forgot-password|reset-password)$/i.test(requestUrl);

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEntryRequest) {
          originalRequest._retry = true;

          try {
            const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post<{
                token?: string;
                tokens?: { accessToken?: string; refreshToken?: string };
              }>(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });

              const token = response.data.token || response.data.tokens?.accessToken;
              const newRefreshToken = response.data.tokens?.refreshToken;
              if (!token) {
                throw new Error('Authentication token was not returned');
              }
              sessionStorage.setItem('auth_token', token);
              localStorage.removeItem('auth_token');
              if (newRefreshToken) {
                sessionStorage.setItem('refresh_token', newRefreshToken);
                localStorage.removeItem('refresh_token');
              }

              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('refresh_token');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            window.dispatchEvent(new CustomEvent('auth:logout'));
            return Promise.reject(this.formatError(refreshError as AxiosError));
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: AxiosError): ApiError {
    if (error.response) {
      const data = error.response.data as Record<string, unknown>;
      const validationErrors = Array.isArray(data.errors) ? data.errors : [];
      const validationMessage = validationErrors[0]?.msg as string | undefined;

      return {
        message:
          (data.message as string) ||
          (data.error as string) ||
          validationMessage ||
          error.message ||
          'An error occurred',
        code: (data.code as string) || `HTTP_${error.response.status}`,
        status: error.response.status,
        details: data.details as Record<string, unknown>,
      };
    }

    if (error.request) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
        status: 0,
      };
    }

    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      status: -1,
    };
  }

  public get instance(): AxiosInstance {
    return this.client;
  }

  public async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  public async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  public async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  public async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  public async delete<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.delete<T>(url, { data });
    return response.data;
  }
}

export const apiClient = new ApiClient().instance;
export const api = new ApiClient();
export default api;
