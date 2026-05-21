import { api } from './api';
import type { PaginationParams, PaginatedResponse } from './api';

export interface Notification {
  id: string;
  userId: string;
  type: 'drift' | 'endpoint' | 'system' | 'report';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  actionData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    driftAlerts: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
  };
  inApp: {
    enabled: boolean;
    driftAlerts: boolean;
    endpointChanges: boolean;
    systemUpdates: boolean;
  };
  push: {
    enabled: boolean;
    driftCritical: boolean;
    driftHigh: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

export interface NotificationListParams extends PaginationParams {
  type?: Notification['type'];
  read?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface NotificationService {
  getNotifications(params?: NotificationListParams): Promise<PaginatedResponse<Notification>>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(): Promise<void>;
  getPreferences(): Promise<NotificationPreferences>;
  updatePreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  testNotification(id: string): Promise<void>;
}

class NotificationServiceImpl implements NotificationService {
  private readonly baseUrl = '/notifications';

  async getNotifications(
    params?: NotificationListParams
  ): Promise<PaginatedResponse<Notification>> {
    try {
      return await api.get<PaginatedResponse<Notification>>(this.baseUrl, params as Record<string, unknown>);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markAsRead(id: string): Promise<Notification> {
    try {
      return await api.post<Notification>(`${this.baseUrl}/${id}/read`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/read-all`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      return await api.get<NotificationPreferences>(`${this.baseUrl}/preferences`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePreferences(
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      return await api.patch<NotificationPreferences>(`${this.baseUrl}/preferences`, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async testNotification(id: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${id}/test`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error('An unexpected error occurred while fetching notifications');
  }
}

export const notificationService = new NotificationServiceImpl();
export default notificationService;
