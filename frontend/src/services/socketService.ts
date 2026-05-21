import { io, Socket } from 'socket.io-client';
import type { DriftEvent } from '../store/driftStore';
import type { Endpoint } from '../store/endpointStore';

export interface SocketConfig {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface SocketEvents {
  'drift:new': (event: DriftEvent) => void;
  'drift:updated': (event: DriftEvent) => void;
  'drift:acknowledged': (event: DriftEvent) => void;
  'endpoint:created': (endpoint: Endpoint) => void;
  'endpoint:updated': (endpoint: Endpoint) => void;
  'endpoint:deleted': (endpointId: string) => void;
  'endpoint:drift': (data: { endpointId: string; status: string }) => void;
  'project:joined': (data: { projectId: string }) => void;
  'project:left': (data: { projectId: string }) => void;
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'error': (error: Error) => void;
}

export type SocketEventName = keyof SocketEvents;
export type SocketEventCallback = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private connectedProjects: Set<string> = new Set();
  private config: Required<SocketConfig>;

  constructor() {
    this.config = {
      url: import.meta.env.VITE_SOCKET_URL || window.location.origin,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };
  }

  public connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(this.config.url, {
      auth: { token },
      autoConnect: this.config.autoConnect,
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      transports: ['websocket', 'polling'],
    });

    this.setupDefaultListeners();
  }

  public disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.connectedProjects.forEach((projectId) => {
      this.leaveProject(projectId);
    });

    this.socket.disconnect();
    this.socket = null;
    this.listeners.clear();
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  public joinProject(projectId: string): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    if (this.connectedProjects.has(projectId)) {
      return;
    }

    this.socket.emit('project:join', { projectId });
    this.connectedProjects.add(projectId);
  }

  public leaveProject(projectId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    if (!this.connectedProjects.has(projectId)) {
      return;
    }

    this.socket.emit('project:leave', { projectId });
    this.connectedProjects.delete(projectId);
  }

  public subscribeToDrift(projectId: string, callback: (event: DriftEvent) => void): () => void {
    return this.on(`drift:${projectId}`, callback as SocketEventCallback);
  }

  public subscribeToEndpoints(projectId: string, callback: (endpoint: Endpoint) => void): () => void {
    return this.on(`endpoint:${projectId}`, callback as SocketEventCallback);
  }

  public emit(event: string, data?: unknown): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit(event, data);
  }

  public on(event: string, callback: SocketEventCallback): () => void {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    const wrappedCallback = (...args: unknown[]) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in socket event handler for ${event}:`, error);
      }
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(wrappedCallback);

    this.socket.on(event, wrappedCallback);

    return () => {
      this.socket?.off(event, wrappedCallback);
      this.listeners.get(event)?.delete(wrappedCallback);
    };
  }

  public off(event: string): void {
    if (!this.socket) {
      return;
    }

    this.socket.off(event);
    this.listeners.delete(event);
  }

  public once(event: string, callback: SocketEventCallback): void {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call connect() first.');
    }

    this.socket.once(event, callback);
  }

  private setupDefaultListeners(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      this.rejoinProjects();
    });

    this.socket.on('disconnect', (reason: string) => {
      this.emitToListeners('disconnect', reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      this.emitToListeners('error', error);
    });
  }

  private rejoinProjects(): void {
    const projectsToRejoin = Array.from(this.connectedProjects);
    this.connectedProjects.clear();

    projectsToRejoin.forEach((projectId) => {
      this.joinProject(projectId);
    });
  }

  private emitToListeners(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        handler(...args);
      });
    }
  }
}

export const socketService = new SocketService();
export default socketService;
