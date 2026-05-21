import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import { ProjectModel } from '../models/Project';
import { TeamModel } from '../models/Team';
import { UserModel } from '../models/User';
import type { SocketEmitter } from './emitter';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './index';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const SOCKET_ROOMS = {
  PROJECT: 'project',
  USER: 'user',
  TEAM: 'team',
  DRIFT: 'drift',
} as const;

export function registerConnectionHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    logger.debug('New connection', { socketId: socket.id });

    socket.data.authenticated = false;
    socket.data.connectedAt = Date.now();
    socket.data.rooms = [];

    socket.on('authenticate', async (token: string, callback) => {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string; role: string };

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
          const error = 'User not found';
          socket.emit('auth:error', { message: error });
          callback?.({ success: false, error });
          return;
        }

        socket.data.authenticated = true;
        socket.data.userId = decoded.userId;
        socket.data.email = decoded.email;
        socket.data.role = decoded.role;
        socket.data.teamIds = user.teamIds.map((id) => id.toString());

        const userRoom = `${SOCKET_ROOMS.USER}:${decoded.userId}`;
        socket.join(userRoom);
        socket.data.rooms.push(userRoom);

        user.teamIds.forEach((teamId) => {
          const teamRoom = `${SOCKET_ROOMS.TEAM}:${teamId.toString()}`;
          socket.join(teamRoom);
          socket.data.rooms.push(teamRoom);
        });

        await user.updateOne({ lastLogin: new Date() });

        socket.emit('auth:success', { userId: decoded.userId });
        callback?.({ success: true });

        logger.info('Socket authenticated', { socketId: socket.id, userId: decoded.userId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        socket.emit('auth:error', { message });
        callback?.({ success: false, error: message });
        logger.warn('Socket authentication failed', { socketId: socket.id, error: message });
      }
    });
  });
}

export function registerProjectHandlers(io: TypedServer, emitter: SocketEmitter): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('project:join', async (projectId: string, callback) => {
      try {
        if (!socket.data.authenticated) {
          const error = 'Not authenticated';
          socket.emit('error', { message: error, code: 'NOT_AUTHENTICATED' });
          callback?.({ success: false, error });
          return;
        }

        const project = await ProjectModel.findById(projectId);
        if (!project) {
          const error = 'Project not found';
          callback?.({ success: false, error });
          return;
        }

        const hasAccess = await validateProjectAccess(socket.data.userId!, socket.data.teamIds!, project);
        if (!hasAccess) {
          const error = 'Access denied';
          socket.emit('error', { message: error, code: 'ACCESS_DENIED' });
          callback?.({ success: false, error });
          return;
        }

        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        socket.join(room);
        socket.data.rooms.push(room);

        socket.emit('project:joined', { projectId });
        callback?.({ success: true });

        logger.debug('User joined project room', { socketId: socket.id, projectId, userId: socket.data.userId });

        const stats = io.engine.clientsCount;
        emitter.broadcastToRoom(room, 'live:stats_update', { totalConnections: stats, projectId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to join project';
        callback?.({ success: false, error: message });
        logger.error('Error joining project room', { socketId: socket.id, error: message });
      }
    });

    socket.on('project:leave', (projectId: string, callback) => {
      try {
        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        socket.leave(room);
        socket.data.rooms = socket.data.rooms.filter((r) => r !== room);

        socket.emit('project:left', { projectId });
        callback?.({ success: true });

        logger.debug('User left project room', { socketId: socket.id, projectId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to leave project';
        callback?.({ success: false, error: message });
      }
    });

    socket.on('project:subscribe', async (projectId: string, callback) => {
      try {
        if (!socket.data.authenticated) {
          const error = 'Not authenticated';
          callback?.({ success: false, error });
          return;
        }

        const project = await ProjectModel.findById(projectId);
        if (!project) {
          callback?.({ success: false, error: 'Project not found' });
          return;
        }

        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
          socket.data.rooms.push(room);
        }

        callback?.({ success: true });
        logger.debug('User subscribed to project updates', { socketId: socket.id, projectId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to subscribe';
        callback?.({ success: false, error: message });
      }
    });
  });
}

export function registerDriftHandlers(io: TypedServer, emitter: SocketEmitter): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('drift:detected', async (data: Record<string, unknown>, callback) => {
      try {
        if (!socket.data.authenticated) {
          const error = 'Not authenticated';
          callback?.({ success: false, error });
          return;
        }

        const { projectId, endpointId, severity, changes, diff } = data;

        if (!projectId || !endpointId) {
          callback?.({ success: false, error: 'Missing required fields' });
          return;
        }

        const driftEvent = {
          id: generateId(),
          projectId,
          endpointId,
          severity,
          changes,
          diff,
          detectedBy: socket.data.userId,
          detectedAt: new Date().toISOString(),
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
        };

        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        emitter.emitToRoom(room, 'drift:new', { driftEvent });

        logger.info('Drift detected and broadcast', {
          driftId: driftEvent.id,
          projectId,
          endpointId,
          severity,
          userId: socket.data.userId,
        });

        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to broadcast drift';
        callback?.({ success: false, error: message });
        logger.error('Error broadcasting drift', { error: message });
      }
    });

    socket.on('drift:acknowledge', async (driftId: string, callback) => {
      try {
        if (!socket.data.authenticated) {
          const error = 'Not authenticated';
          callback?.({ success: false, error });
          return;
        }

        const { projectId } = await getDriftProject(driftId);
        if (!projectId) {
          callback?.({ success: false, error: 'Drift event not found' });
          return;
        }

        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        emitter.emitToRoom(room, 'drift:acknowledged', {
          driftId,
          acknowledgedBy: socket.data.userId!,
          acknowledgedAt: new Date().toISOString(),
        });

        logger.info('Drift acknowledged', { driftId, userId: socket.data.userId });
        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to acknowledge drift';
        callback?.({ success: false, error: message });
      }
    });

    socket.on('drift:subscribe', async (projectId: string, callback) => {
      try {
        if (!socket.data.authenticated) {
          callback?.({ success: false, error: 'Not authenticated' });
          return;
        }

        const room = `${SOCKET_ROOMS.DRIFT}:${projectId}`;
        socket.join(room);
        socket.data.rooms.push(room);

        callback?.({ success: true });
        logger.debug('User subscribed to drift updates', { socketId: socket.id, projectId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to subscribe';
        callback?.({ success: false, error: message });
      }
    });
  });
}

export function registerEndpointHandlers(io: TypedServer, emitter: SocketEmitter): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('endpoint:update', async (data: Record<string, unknown>, callback) => {
      try {
        if (!socket.data.authenticated) {
          callback?.({ success: false, error: 'Not authenticated' });
          return;
        }

        const { endpointId, projectId, changes } = data;

        if (!endpointId || !projectId) {
          callback?.({ success: false, error: 'Missing required fields' });
          return;
        }

        const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
        emitter.emitToRoom(room, 'endpoint:updated', {
          endpointId: endpointId as string,
          changes: changes as Record<string, unknown>,
          updatedBy: socket.data.userId,
          updatedAt: new Date().toISOString(),
        });

        logger.debug('Endpoint update broadcast', { endpointId, projectId });
        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to broadcast endpoint update';
        callback?.({ success: false, error: message });
      }
    });

    socket.on('endpoint:status', async (data: { endpointId: string; status: string }, callback) => {
      try {
        if (!socket.data.authenticated) {
          callback?.({ success: false, error: 'Not authenticated' });
          return;
        }

        const { endpointId, status } = data;

        if (!endpointId || !status) {
          callback?.({ success: false, error: 'Missing required fields' });
          return;
        }

        const projectId = await getEndpointProject(endpointId);
        if (projectId) {
          const room = `${SOCKET_ROOMS.PROJECT}:${projectId}`;
          emitter.emitToRoom(room, 'endpoint:status_changed', {
            endpointId,
            status,
            changedBy: socket.data.userId,
            changedAt: new Date().toISOString(),
          });
        }

        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to broadcast status change';
        callback?.({ success: false, error: message });
      }
    });
  });
}

export function registerNotificationHandlers(io: TypedServer, emitter: SocketEmitter): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('notification:new', async (data: Record<string, unknown>, callback) => {
      try {
        if (!socket.data.authenticated) {
          callback?.({ success: false, error: 'Not authenticated' });
          return;
        }

        const { userId, type, title, message } = data;

        if (!userId || !type || !title) {
          callback?.({ success: false, error: 'Missing required fields' });
          return;
        }

        const notification = {
          id: generateId(),
          userId: userId as string,
          type: type as string,
          title: title as string,
          message: message as string || '',
          read: false,
          createdAt: new Date().toISOString(),
        };

        emitter.emitToUser(userId as string, 'notification:new', { notification });

        logger.debug('Notification sent', { notificationId: notification.id, userId });
        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send notification';
        callback?.({ success: false, error: message });
      }
    });

    socket.on('notification:read', async (notificationId: string, callback) => {
      try {
        if (!socket.data.authenticated) {
          callback?.({ success: false, error: 'Not authenticated' });
          return;
        }

        emitter.emitToUser(socket.data.userId!, 'notification:read', { notificationId });

        logger.debug('Notification marked as read', { notificationId });
        callback?.({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
        callback?.({ success: false, error: message });
      }
    });
  });
}

export function registerLiveHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('live:ping', (callback) => {
      const timestamp = Date.now();
      socket.emit('live:pong', { timestamp });
      callback?.({ success: true, timestamp });
    });

    socket.on('live:stats', (callback) => {
      const sockets = io.sockets.sockets;
      const rooms = new Set<string>();

      sockets.forEach((s) => {
        s.rooms.forEach((room) => {
          if (room !== s.id) {
            rooms.add(room);
          }
        });
      });

      const stats = {
        connectedClients: sockets.size,
        activeRooms: rooms.size,
        uptime: process.uptime(),
        timestamp: Date.now(),
      };

      callback?.({ success: true, stats });
    });
  });
}

async function validateProjectAccess(
  userId: string,
  teamIds: string[],
  project: InstanceType<typeof ProjectModel>
): Promise<boolean> {
  const projectTeamId = project.teamId.toString();
  return teamIds.some((teamId) => teamId === projectTeamId);
}

async function getDriftProject(_driftId: string): Promise<{ projectId?: string }> {
  return {};
}

async function getEndpointProject(_endpointId: string): Promise<string | null> {
  return null;
}

function generateId(): string {
  return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export { SOCKET_ROOMS };