import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import config from '../config';
import logger from '../utils/logger';
import { authMiddleware, rateLimitMiddleware, errorMiddleware } from './middleware';
import { registerConnectionHandlers, registerProjectHandlers, registerDriftHandlers, registerEndpointHandlers, registerNotificationHandlers, registerLiveHandlers } from './handlers';
import { SocketEmitter } from './emitter';

export interface ServerToClientEvents {
  'auth:success': (data: { userId: string }) => void;
  'auth:error': (data: { message: string }) => void;
  'project:joined': (data: { projectId: string }) => void;
  'project:left': (data: { projectId: string }) => void;
  'drift:new': (data: { driftEvent: Record<string, unknown> }) => void;
  'drift:acknowledged': (data: { driftId: string; acknowledgedBy: string }) => void;
  'endpoint:updated': (data: { endpointId: string; changes: Record<string, unknown> }) => void;
  'endpoint:status_changed': (data: { endpointId: string; status: string }) => void;
  'notification:new': (data: { notification: Record<string, unknown> }) => void;
  'notification:read': (data: { notificationId: string }) => void;
  'live:pong': (data: { timestamp: number }) => void;
  'live:stats_update': (data: { stats: Record<string, unknown> }) => void;
  'server_shutdown': (data: { message: string }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'authenticate': (token: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'project:join': (projectId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'project:leave': (projectId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'project:subscribe': (projectId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'drift:detected': (data: Record<string, unknown>, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'drift:acknowledge': (driftId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'drift:subscribe': (projectId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'endpoint:update': (data: Record<string, unknown>, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'endpoint:status': (data: { endpointId: string; status: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'notification:new': (data: Record<string, unknown>, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'notification:read': (notificationId: string, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'live:ping': (callback?: (response: { success: boolean; timestamp?: number }) => void) => void;
  'live:stats': (callback?: (response: { success: boolean; stats?: Record<string, unknown> }) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
  email?: string;
  role?: string;
  teamIds?: string[];
  authenticated: boolean;
  connectedAt: number;
  rooms: string[];
}

export class SocketServer {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private emitter: SocketEmitter;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      maxHttpBufferSize: 1e6,
      allowEIO3: true,
    });

    this.emitter = new SocketEmitter(this.io);
    this.setupMiddlewares();
    this.setupConnectionHandlers();
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupMiddlewares(): void {
    this.io.use(authMiddleware);
    this.io.use(rateLimitMiddleware);
    this.io.use(errorMiddleware);
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      socket.data.authenticated = false;
      socket.data.connectedAt = Date.now();
      socket.data.rooms = [];

      logger.info('Socket connected', {
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
      });

      socket.emit('auth:success', { userId: '' });

      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      socket.on('error', (error) => {
        logger.error('Socket error', {
          socketId: socket.id,
          error: error.message,
          stack: error.stack,
        });
      });
    });

    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.IO connection error', {
        code: err.code,
        message: err.message,
        context: err.context,
      });
    });
  }

  private setupEventHandlers(): void {
    registerConnectionHandlers(this.io);
    registerProjectHandlers(this.io, this.emitter);
    registerDriftHandlers(this.io, this.emitter);
    registerEndpointHandlers(this.io, this.emitter);
    registerNotificationHandlers(this.io, this.emitter);
    registerLiveHandlers(this.io);
  }

  private handleDisconnect(socket: SocketIOServer.Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, reason: string): void {
    logger.info('Socket disconnected', {
      socketId: socket.id,
      reason,
      authenticated: socket.data.authenticated,
      duration: Date.now() - socket.data.connectedAt,
      rooms: socket.data.rooms,
    });

    socket.data.rooms.forEach((room) => {
      socket.leave(room);
    });
    socket.data.rooms = [];
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const connectedSockets = this.io.sockets.sockets;
      const now = Date.now();

      connectedSockets.forEach((socket) => {
        const idleTime = now - socket.data.connectedAt;
        if (idleTime > 300000 && !socket.data.authenticated) {
          logger.warn('Closing idle unauthenticated socket', {
            socketId: socket.id,
            idleTime,
          });
          socket.emit('error', { message: 'Connection timeout', code: 'CONNECTION_TIMEOUT' });
          socket.disconnect(true);
        }
      });
    }, 60000);
  }

  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io;
  }

  public getEmitter(): SocketEmitter {
    return this.emitter;
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down Socket.IO server');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.io.emit('server_shutdown', { message: 'Server is shutting down' });

    const disconnectPromise = new Promise<void>((resolve) => {
      this.io.disconnectSockets(true);
      setTimeout(resolve, 5000);
    });

    await disconnectPromise;
    this.io.close();
    logger.info('Socket.IO server shutdown complete');
  }

  public getStats(): {
    connectedClients: number;
    authenticatedClients: number;
    rooms: number;
    uptime: number;
  } {
    const sockets = this.io.sockets.sockets;
    let authenticatedCount = 0;

    sockets.forEach((socket) => {
      if (socket.data.authenticated) {
        authenticatedCount++;
      }
    });

    const rooms = new Set<string>();
    sockets.forEach((socket) => {
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          rooms.add(room);
        }
      });
    });

    return {
      connectedClients: sockets.size,
      authenticatedClients: authenticatedCount,
      rooms: rooms.size,
      uptime: process.uptime(),
    };
  }
}

export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  return new SocketServer(httpServer);
}