import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useEndpointStore, type Endpoint } from './endpointStore';
import { useDriftStore, type DriftEvent } from './driftStore';
import { useNotificationStore, type Notification } from './notificationStore';
import { getApiBaseUrl } from '../services/runtimeConfig';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomSubscription {
  room: string;
  channel: string;
  joinedAt: string;
}

export interface RealtimeMessage {
  id: string;
  type: string;
  room: string;
  payload: unknown;
  timestamp: string;
}

interface SocketState {
  status: ConnectionStatus;
  subscriptions: RoomSubscription[];
  messages: RealtimeMessage[];
  error: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  currentProjectRoom: string | null;

  connect: () => void;
  disconnect: () => void;
  joinRoom: (room: string, channel: string) => void;
  leaveRoom: (room: string) => void;
  sendMessage: (room: string, type: string, payload: unknown) => void;
  clearMessages: () => void;
  handleReconnect: () => void;
  joinProjectRoom: (projectId: string) => void;
  leaveProjectRoom: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let messageHandler: ((message: RealtimeMessage) => void) | null = null;

// Handle incoming real-time data events and update stores
function handleDataEvent(message: RealtimeMessage) {
  const payload = message.payload as Record<string, unknown> | undefined;
  if (!payload) return;

  switch (message.type) {
    case 'drift:new': {
      const      event = payload as unknown as DriftEvent;
      useDriftStore.setState((state) => ({
        driftEvents: [event, ...state.driftEvents.filter((e) => e.id !== event.id)],
      }));
      break;
    }
    case 'drift:updated': {
      const event = payload as unknown as DriftEvent;
      useDriftStore.setState((state) => ({
        driftEvents: state.driftEvents.map((e) => (e.id === event.id ? event : e)),
      }));
      break;
    }
    case 'endpoint:updated': {
      const endpoint = payload as unknown as Endpoint;
      useEndpointStore.setState((state) => ({
        endpoints: state.endpoints.map((e) => (e.id === endpoint.id ? endpoint : e)),
      }));
      break;
    }
    case 'endpoint:created': {
      const endpoint = payload as unknown as Endpoint;
      useEndpointStore.setState((state) => ({
        endpoints: state.endpoints.some((e) => e.id === endpoint.id)
          ? state.endpoints
          : [...state.endpoints, endpoint],
      }));
      break;
    }
    case 'endpoint:deleted': {
      const { endpointId } = payload as { endpointId: string };
      useEndpointStore.setState((state) => ({
        endpoints: state.endpoints.filter((e) => e.id !== endpointId),
      }));
      break;
    }
    case 'notification:new': {
      const notification = payload as unknown as Notification;
      useNotificationStore.setState((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
      break;
    }
  }
}

export const useSocketStore = create<SocketState>((set, get) => ({
  status: 'disconnected',
  subscriptions: [],
  messages: [],
  error: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  currentProjectRoom: null,

  connect: () => {
    const { status, reconnectAttempts, maxReconnectAttempts } = get();

    if (status === 'connected' || status === 'connecting') return;
    if (reconnectAttempts >= maxReconnectAttempts) {
      set({ status: 'error', error: 'Max reconnection attempts reached' });
      return;
    }

    set({ status: 'connecting', error: null });

    const token = useAuthStore.getState().token;
    const apiBaseUrl = getApiBaseUrl();
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '').replace(/^http/, 'ws');
    const wsUrl = `${baseUrl}/ws${token ? `?token=${token}` : ''}`;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ status: 'connected', reconnectAttempts: 0, error: null });

        // Re-join all subscriptions
        const { subscriptions } = get();
        subscriptions.forEach((sub) => {
          socket?.send(JSON.stringify({ type: 'join', room: sub.room, channel: sub.channel }));
        });
      };

      socket.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          set((state) => ({
            messages: [...state.messages.slice(-99), message],
          }));

          // Handle data events to update stores
          handleDataEvent(message);

          // Call external message handler if set
          messageHandler?.(message);
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      socket.onclose = (event) => {
        set({ status: 'disconnected' });
        // Only reconnect on abnormal closures
        if (event.code !== 1000) {
          get().handleReconnect();
        }
      };

      socket.onerror = () => {
        set({ status: 'error', error: 'WebSocket connection error' });
      };
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
    }
  },

  disconnect: () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    socket?.close(1000, 'Client disconnect');
    socket = null;
    set({ status: 'disconnected', subscriptions: [], reconnectAttempts: 0, currentProjectRoom: null });
  },

  joinRoom: (room: string, channel: string) => {
    const exists = get().subscriptions.some((s) => s.room === room);
    if (exists) return;

    set((state) => ({
      subscriptions: [
        ...state.subscriptions,
        { room, channel, joinedAt: new Date().toISOString() },
      ],
    }));

    if (get().status === 'connected') {
      socket?.send(JSON.stringify({ type: 'join', room, channel }));
    }
  },

  leaveRoom: (room: string) => {
    set((state) => ({
      subscriptions: state.subscriptions.filter((s) => s.room !== room),
    }));

    if (get().status === 'connected') {
      socket?.send(JSON.stringify({ type: 'leave', room }));
    }
  },

  joinProjectRoom: (projectId: string) => {
    const { currentProjectRoom } = get();
    if (currentProjectRoom === projectId) return;

    // Leave previous project room
    if (currentProjectRoom) {
      get().leaveRoom(`project:${currentProjectRoom}`);
    }

    get().joinRoom(`project:${projectId}`, 'data');
    set({ currentProjectRoom: projectId });
  },

  leaveProjectRoom: () => {
    const { currentProjectRoom } = get();
    if (currentProjectRoom) {
      get().leaveRoom(`project:${currentProjectRoom}`);
      set({ currentProjectRoom: null });
    }
  },

  sendMessage: (room: string, type: string, payload: unknown) => {
    if (get().status !== 'connected') {
      set({ error: 'Not connected' });
      return;
    }

    socket?.send(
      JSON.stringify({
        type: 'message',
        room,
        payload: { type, data: payload, timestamp: new Date().toISOString() },
      })
    );
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  handleReconnect: () => {
    const { reconnectAttempts, maxReconnectAttempts } = get();

    if (reconnectAttempts >= maxReconnectAttempts) {
      set({ status: 'error', error: 'Max reconnection attempts reached' });
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    reconnectTimeout = setTimeout(() => {
      set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 }));
      get().connect();
    }, delay);
  },
}));

export const setSocketMessageHandler = (handler: (message: RealtimeMessage) => void) => {
  messageHandler = handler;
};

export const selectIsConnected = (state: SocketState) => state.status === 'connected';
export const selectIsSubscribedToRoom = (state: SocketState, room: string) =>
  state.subscriptions.some((s) => s.room === room);
