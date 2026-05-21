import { Middleware } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './index';

type TypedMiddlewareFn = Middleware<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const connectionRates = new Map<string, RateLimitEntry>();
const AUTH_TIMEOUT_MS = 60000;

export const authMiddleware: TypedMiddlewareFn = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    logger.debug('No auth token provided', { socketId: socket.id });
    socket.data.authenticated = false;
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      iat?: number;
      exp?: number;
    };

    socket.data.authenticated = true;
    socket.data.userId = decoded.userId;
    socket.data.email = decoded.email;
    socket.data.role = decoded.role;

    logger.debug('Socket auth middleware - token verified', {
      socketId: socket.id,
      userId: decoded.userId,
    });

    next();
  } catch (error) {
    logger.warn('Socket auth middleware - token verification failed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    socket.data.authenticated = false;
    next(new Error('Authentication error'));
  }
};

export const rateLimitMiddleware: TypedMiddlewareFn = (socket, next) => {
  const clientId = socket.data.userId || socket.id;
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs || 60000;
  const maxRequests = config.rateLimitMaxRequests || 100;

  let entry = connectionRates.get(clientId);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    connectionRates.set(clientId, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    logger.warn('Socket rate limit exceeded', {
      socketId: socket.id,
      clientId,
      requestCount: entry.count,
      limit: maxRequests,
    });
    next(new Error('Rate limit exceeded'));
    return;
  }

  next();
};

export const errorMiddleware: TypedMiddlewareFn = (socket, next) => {
  const startTime = Date.now();

  socket.on('error', (error) => {
    logger.error('Socket error occurred', {
      socketId: socket.id,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
  });

  next();
};

export function createProjectAccessMiddleware(
  validateProject: (userId: string, projectId: string) => Promise<boolean>
): TypedMiddlewareFn {
  return async (socket, next) => {
    const projectId = socket.handshake.auth?.projectId;

    if (!projectId) {
      next();
      return;
    }

    if (!socket.data.authenticated || !socket.data.userId) {
      next(new Error('Authentication required for project access'));
      return;
    }

    try {
      const hasAccess = await validateProject(socket.data.userId, projectId);

      if (!hasAccess) {
        logger.warn('Project access denied', {
          socketId: socket.id,
          userId: socket.data.userId,
          projectId,
        });
        next(new Error('Access denied to project'));
        return;
      }

      next();
    } catch (error) {
      logger.error('Project access validation error', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(new Error('Project access validation failed'));
    }
  };
}

export function createConnectionTimeoutMiddleware(timeoutMs: number = AUTH_TIMEOUT_MS): TypedMiddlewareFn {
  return (socket, next) => {
    const connectionTimeout = setTimeout(() => {
      if (!socket.data.authenticated) {
        logger.warn('Socket connection timeout', {
          socketId: socket.id,
          timeoutMs,
        });
        socket.emit('error', {
          message: 'Connection timeout',
          code: 'CONNECTION_TIMEOUT',
        });
        socket.disconnect(true);
      }
    }, timeoutMs);

    socket.once('disconnect', () => {
      clearTimeout(connectionTimeout);
    });

    socket.once('authenticate', () => {
      clearTimeout(connectionTimeout);
    });

    next();
  };
}

export function createValidationMiddleware(
  schema: Record<string, (data: unknown) => boolean>
): TypedMiddlewareFn {
  return (socket, next) => {
    const event = socket.event;

    if (!event || !schema[event]) {
      next();
      return;
    }

    const validator = schema[event];

    socket.on(event, (data, callback) => {
      try {
        if (!validator(data)) {
          logger.warn('Socket event validation failed', {
            socketId: socket.id,
            event,
            data,
          });
          callback?.({ success: false, error: 'Validation failed' });
          return;
        }
      } catch (error) {
        logger.error('Socket event validator error', {
          socketId: socket.id,
          event,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    next();
  };
}

export function cleanupRateLimitData(): void {
  const now = Date.now();

  connectionRates.forEach((entry, clientId) => {
    if (now > entry.resetTime) {
      connectionRates.delete(clientId);
    }
  });
}

setInterval(cleanupRateLimitData, 60000);

export const socketAuthRateLimiter = {
  getRemainingRequests(clientId: string): number {
    const entry = connectionRates.get(clientId);
    if (!entry) {
      return config.rateLimitMaxRequests || 100;
    }
    return Math.max(0, (config.rateLimitMaxRequests || 100) - entry.count);
  },

  getResetTime(clientId: string): number {
    const entry = connectionRates.get(clientId);
    return entry?.resetTime || 0;
  },

  reset(clientId: string): void {
    connectionRates.delete(clientId);
  },
};

export function createHandshakeLoggerMiddleware(): TypedMiddlewareFn {
  return (socket, next) => {
    logger.debug('Socket handshake', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
      auth: socket.handshake.auth ? 'provided' : 'none',
      query: socket.handshake.query,
    });
    next();
  };
}

export function createDisconnectLoggerMiddleware(): TypedMiddlewareFn {
  return (_socket, next) => {
    next();
  };
}