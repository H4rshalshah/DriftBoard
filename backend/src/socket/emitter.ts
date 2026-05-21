import { Server } from 'socket.io';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './index';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const REDIS_CHANNELS = {
  DRIFT: 'driftboard:drift',
  PROJECT: 'driftboard:project',
  ENDPOINT: 'driftboard:endpoint',
  NOTIFICATION: 'driftboard:notification',
  BROADCAST: 'driftboard:broadcast',
} as const;

interface EmitterOptions {
  useRedisPubSub?: boolean;
  excludeSender?: boolean;
}

export class SocketEmitter {
  private io: TypedServer;
  private useRedis: boolean;

  constructor(io: TypedServer, useRedis: boolean = true) {
    this.io = io;
    this.useRedis = useRedis && redisClient.isConnected();

    if (this.useRedis) {
      this.setupRedisSubscriber();
    }

    logger.info('SocketEmitter initialized', { useRedisPubSub: this.useRedis });
  }

  private async setupRedisSubscriber(): Promise<void> {
    try {
      const client = redisClient.getClient();
      if (!client) return;

      const subscriber = client.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(REDIS_CHANNELS.DRIFT, (message) => {
        this.handleRedisMessage('drift', message);
      });

      await subscriber.subscribe(REDIS_CHANNELS.PROJECT, (message) => {
        this.handleRedisMessage('project', message);
      });

      await subscriber.subscribe(REDIS_CHANNELS.ENDPOINT, (message) => {
        this.handleRedisMessage('endpoint', message);
      });

      await subscriber.subscribe(REDIS_CHANNELS.NOTIFICATION, (message) => {
        this.handleRedisMessage('notification', message);
      });

      await subscriber.subscribe(REDIS_CHANNELS.BROADCAST, (message) => {
        this.handleRedisMessage('broadcast', message);
      });

      logger.info('Redis pub/sub subscriber connected');
    } catch (error) {
      logger.error('Failed to setup Redis subscriber', { error });
      this.useRedis = false;
    }
  }

  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'drift':
          this.emitToRoom(data.room, 'drift:new', data.payload);
          break;
        case 'project':
          this.emitToRoom(data.room, 'project:update', data.payload);
          break;
        case 'endpoint':
          this.emitToRoom(data.room, 'endpoint:updated', data.payload);
          break;
        case 'notification':
          this.emitToUser(data.userId, 'notification:new', data.payload);
          break;
        case 'broadcast':
          this.broadcast(data.event, data.payload);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle Redis message', { channel, error });
    }
  }

  public emitToRoom<K extends keyof ServerToClientEvents>(
    room: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    try {
      this.io.to(room).emit(event, payload as any);

      logger.debug('Emitted to room', { room, event, payload });
    } catch (error) {
      logger.error('Failed to emit to room', { room, event, error });
    }
  }

  public emitToUser<K extends keyof ServerToClientEvents>(
    userId: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    try {
      const room = `user:${userId}`;
      this.io.to(room).emit(event, payload as any);

      logger.debug('Emitted to user', { userId, event, payload });
    } catch (error) {
      logger.error('Failed to emit to user', { userId, event, error });
    }
  }

  public emitToTeam<K extends keyof ServerToClientEvents>(
    teamId: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    try {
      const room = `team:${teamId}`;
      this.io.to(room).emit(event, payload as any);

      logger.debug('Emitted to team', { teamId, event, payload });
    } catch (error) {
      logger.error('Failed to emit to team', { teamId, event, error });
    }
  }

  public emitToProject<K extends keyof ServerToClientEvents>(
    projectId: string,
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    try {
      const room = `project:${projectId}`;
      this.io.to(room).emit(event, payload as any);

      logger.debug('Emitted to project room', { projectId, event, payload });
    } catch (error) {
      logger.error('Failed to emit to project', { projectId, event, error });
    }
  }

  public broadcast<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    try {
      this.io.emit(event, payload as any);

      logger.debug('Broadcast sent', { event, payload });
    } catch (error) {
      logger.error('Failed to broadcast', { event, error });
    }
  }

  public broadcastExcept<K extends keyof ServerToClientEvents>(
    event: K,
    payload: Parameters<ServerToClientEvents[K]>[0],
    excludeSocketId: string
  ): void {
    try {
      const sockets = this.io.sockets.sockets;
      sockets.forEach((socket) => {
        if (socket.id !== excludeSocketId) {
          socket.emit(event, payload as any);
        }
      });

      logger.debug('Broadcast sent (excluding sender)', { event, excludeSocketId });
    } catch (error) {
      logger.error('Failed to broadcast excluding sender', { event, error });
    }
  }

  public async emitDriftDetected(
    projectId: string,
    driftEvent: Record<string, unknown>
  ): Promise<void> {
    try {
      const room = `project:${projectId}`;
      this.emitToRoom(room, 'drift:new', { driftEvent });

      if (this.useRedis) {
        const client = redisClient.getClient();
        if (client) {
          await client.publish(REDIS_CHANNELS.DRIFT, JSON.stringify({
            room,
            payload: { driftEvent },
          }));
        }
      }

      logger.info('Drift detected event emitted', { projectId, driftId: driftEvent.id });
    } catch (error) {
      logger.error('Failed to emit drift detected', { error });
    }
  }

  public async emitEndpointUpdate(
    projectId: string,
    endpointId: string,
    changes: Record<string, unknown>
  ): Promise<void> {
    try {
      const room = `project:${projectId}`;
      this.emitToRoom(room, 'endpoint:updated', { endpointId, changes });

      if (this.useRedis) {
        const client = redisClient.getClient();
        if (client) {
          await client.publish(REDIS_CHANNELS.ENDPOINT, JSON.stringify({
            room,
            payload: { endpointId, changes },
          }));
        }
      }

      logger.debug('Endpoint update emitted', { projectId, endpointId });
    } catch (error) {
      logger.error('Failed to emit endpoint update', { error });
    }
  }

  public async emitEndpointStatusChange(
    projectId: string,
    endpointId: string,
    status: string
  ): Promise<void> {
    try {
      const room = `project:${projectId}`;
      this.emitToRoom(room, 'endpoint:status_changed', { endpointId, status });

      logger.debug('Endpoint status change emitted', { projectId, endpointId, status });
    } catch (error) {
      logger.error('Failed to emit endpoint status change', { error });
    }
  }

  public async emitNotification(
    userId: string,
    notification: Record<string, unknown>
  ): Promise<void> {
    try {
      this.emitToUser(userId, 'notification:new', { notification });

      if (this.useRedis) {
        const client = redisClient.getClient();
        if (client) {
          await client.publish(REDIS_CHANNELS.NOTIFICATION, JSON.stringify({
            userId,
            payload: { notification },
          }));
        }
      }

      logger.debug('Notification emitted', { userId, notificationId: notification.id });
    } catch (error) {
      logger.error('Failed to emit notification', { error });
    }
  }

  public async emitToMultipleUsers(
    userIds: string[],
    event: keyof ServerToClientEvents,
    payload: unknown
  ): Promise<void> {
    try {
      userIds.forEach((userId) => {
        this.emitToUser(userId, event as any, payload as any);
      });

      logger.debug('Emitted to multiple users', { userCount: userIds.length, event });
    } catch (error) {
      logger.error('Failed to emit to multiple users', { error });
    }
  }

  public getConnectedUsersInRoom(room: string): string[] {
    const users: string[] = [];
    const adapter = this.io.sockets.adapter;

    if (adapter && adapter.rooms.has(room)) {
      const socketIds = adapter.rooms.get(room);
      if (socketIds) {
        socketIds.forEach((socketId) => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket?.data.userId) {
            users.push(socket.data.userId);
          }
        });
      }
    }

    return users;
  }

  public getSocketCountInRoom(room: string): number {
    const adapter = this.io.sockets.adapter;
    if (adapter && adapter.rooms.has(room)) {
      const socketIds = adapter.rooms.get(room);
      return socketIds?.size || 0;
    }
    return 0;
  }

  public isUserConnected(userId: string): boolean {
    const userRoom = `user:${userId}`;
    return this.getSocketCountInRoom(userRoom) > 0;
  }

  public getUserSocketIds(userId: string): string[] {
    const userRoom = `user:${userId}`;
    const socketIds: string[] = [];
    const adapter = this.io.sockets.adapter;

    if (adapter && adapter.rooms.has(userRoom)) {
      const sockets = adapter.rooms.get(userRoom);
      if (sockets) {
        sockets.forEach((socketId) => {
          socketIds.push(socketId);
        });
      }
    }

    return socketIds;
  }
}

export { REDIS_CHANNELS };