import { Request, Response, NextFunction, type RequestHandler } from 'express';
import { UserRole, type ITokenPayload } from '../types/index';
import tokenService from '../services/tokenService';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: ITokenPayload;
      tokenId?: string;
    }
  }
}

export const authenticate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = tokenService.verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      res.status(401).json({ error: message });
    }
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const authenticateSocket = async (
  socket: { handshake: { auth: { token?: string }; headers: Record<string, string> } },
  next: (err?: Error) => void,
): Promise<void> => {
  try {
    const token = socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const payload = tokenService.verifyAccessToken(token);
    socket.handshake.auth.user = payload;
    next();
  } catch (error) {
    logger.warn('Socket authentication failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    next(new Error('Invalid token'));
  }
};

export const optionalAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = tokenService.verifyAccessToken(token);
      req.user = payload;
    } catch {
    }

    next();
  } catch (error) {
    logger.error('Optional auth error', error);
    next();
  }
};

export const authenticateApiKey = (apiKeyValidator: (key: string) => Promise<unknown>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

      if (!apiKey) {
        res.status(401).json({ error: 'API key required' });
        return;
      }

      const keyDoc = await apiKeyValidator(apiKey);

      if (!keyDoc) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      req.apiKey = keyDoc;
      next();
    } catch (error) {
      logger.error('API key authentication error', error);
      res.status(500).json({ error: 'API key authentication failed' });
    }
  };
};

declare module 'express' {
  interface Request {
    apiKey?: unknown;
  }
}