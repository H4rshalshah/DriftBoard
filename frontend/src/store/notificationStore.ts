import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export type NotificationType = 'drift' | 'schema' | 'system' | 'member' | 'team';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  drift: boolean;
  schema: boolean;
  system: boolean;
  email: boolean;
  digest: boolean;
  digestFrequency: 'daily' | 'weekly';
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isLoading: boolean;
  isMarkingRead: boolean;
  error: string | null;

  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotifications: (ids: string[]) => Promise<number>;
  deleteHistory: (olderThanHours: 24 | 168 | 720) => Promise<number>;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  addNotification: (notification: Notification) => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      preferences: {
        drift: true,
        schema: true,
        system: true,
        email: false,
        digest: false,
        digestFrequency: 'daily',
      },
      isLoading: false,
      isMarkingRead: false,
      error: null,

      fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
          const notifications = await api.get<Notification[]>('/notifications');
          set({
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch notifications',
          });
        }
      },

      fetchUnreadCount: async () => {
        try {
          const { count } = await api.get<{ count: number }>('/notifications/unread-count');
          set({ unreadCount: count });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch unread count',
          });
        }
      },

      markAsRead: async (id: string) => {
        const previousNotifications = get().notifications;

        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));

        try {
          await api.put(`/notifications/${id}/read`);
        } catch (error) {
          set({ notifications: previousNotifications });
          set({
            error: error instanceof Error ? error.message : 'Failed to mark as read',
          });
          throw error;
        }
      },

      markAllAsRead: async () => {
        const previousNotifications = get().notifications;
        const previousCount = get().unreadCount;

        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));

        try {
          await api.post('/notifications/mark-all-read');
        } catch (error) {
          set({
            notifications: previousNotifications,
            unreadCount: previousCount,
          });
          set({
            error: error instanceof Error ? error.message : 'Failed to mark all as read',
          });
          throw error;
        }
      },

      deleteNotifications: async (ids) => {
        if (ids.length === 0) return 0;
        const previousNotifications = get().notifications;
        set((state) => {
          const nextNotifications = state.notifications.filter((notification) => !ids.includes(notification.id));
          return {
            notifications: nextNotifications,
            unreadCount: nextNotifications.filter((notification) => !notification.read).length,
          };
        });

        try {
          const result = await api.delete<{ deleted: number }>('/notifications', { ids });
          return result.deleted;
        } catch (error) {
          set({
            notifications: previousNotifications,
            unreadCount: previousNotifications.filter((notification) => !notification.read).length,
            error: error instanceof Error ? error.message : 'Failed to delete notifications',
          });
          throw error;
        }
      },

      deleteHistory: async (olderThanHours) => {
        const previousNotifications = get().notifications;
        const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
        set((state) => {
          const nextNotifications = state.notifications.filter((notification) => new Date(notification.createdAt).getTime() > cutoff);
          return {
            notifications: nextNotifications,
            unreadCount: nextNotifications.filter((notification) => !notification.read).length,
          };
        });

        try {
          const result = await api.delete<{ deleted: number }>('/notifications', { olderThanHours });
          return result.deleted;
        } catch (error) {
          set({
            notifications: previousNotifications,
            unreadCount: previousNotifications.filter((notification) => !notification.read).length,
            error: error instanceof Error ? error.message : 'Failed to delete notification history',
          });
          throw error;
        }
      },

      updatePreferences: async (preferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        }));

        try {
          await api.patch('/notifications/preferences', preferences);
        } catch (error) {
          set({ preferences: get().preferences });
          set({
            error: error instanceof Error ? error.message : 'Failed to update preferences',
          });
          throw error;
        }
      },

      addNotification: (notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'notification-preferences',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read);
export const selectNotificationsByType = (state: NotificationState, type: NotificationType) =>
  state.notifications.filter((n) => n.type === type);
