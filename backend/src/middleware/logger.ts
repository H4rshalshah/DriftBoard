import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../utils/logger';

export interface RequestLogOptions {
  logBody?: boolean;
  logQuery?: boolean;
  logHeaders?: boolean;
  maxBodyLength?: number;
  skipPaths?: string[];
}

const defaultOptions: RequestLogOptions = {
  logBody: false,
  logQuery: false,
  logHeaders: false,
  maxBodyLength: 1000,
  skipPaths: ['/health', '/favicon.ico'],
};

export const requestLogger = (options: RequestLogOptions = {}) => {
  const opts = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();

    if (opts.skipPaths?.includes(req.path)) {
      next();
      return;
    }

    const logRequest = (): void => {
      const logData: Record<string, unknown> = {
        requestId,
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?.userId,
      };

      if (opts.logQuery && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }

      if (opts.logHeaders) {
        logData.headers = {
          'content-type': req.get('content-type'),
          'accept': req.get('accept'),
          'authorization': req.headers.authorization ? '[REDACTED]' : undefined,
          'user-agent': req.get('user-agent'),
        };
      }

      logger.info('Incoming request', logData);
    };

    const logResponse = (): void => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

      const logData: Record<string, unknown> = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        durationMs: duration,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?.userId,
      };

      if (opts.logBody && req.body && Object.keys(req.body).length > 0) {
        const bodyCopy = { ...req.body };
        if (bodyCopy.password) bodyCopy.password = '[REDACTED]';
        if (bodyCopy.token) bodyCopy.token = '[REDACTED]';
        if (bodyCopy.apiKey) bodyCopy.apiKey = '[REDACTED]';

        const bodyString = JSON.stringify(bodyCopy);
        logData.requestBody = bodyString.length > (opts.maxBodyLength || 1000)
          ? bodyString.substring(0, opts.maxBodyLength) + '...[truncated]'
          : bodyString;
      }

      if (res.statusCode >= 400) {
        logData.error = true;
      }

      logger[logLevel]('Request completed', logData);
    };

    res.on('finish', logResponse);

    logRequest();
    next();
  };
};

export const morganLikeLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export const createRequestLogFormatter = () => {
  return (req: Request, res: Response): string => {
    const { method, originalUrl } = req;
    const { statusCode } = res;
    const contentLength = res.getHeader('content-length') || 0;
    const responseTime = Date.now() - (req as Request & { startTime?: number }).startTime!;

    return `${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms`;
  };
};

export const addRequestId = (req: Request, _res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.id = requestId;
  next();
};

export const logRequestBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'Authorization'];
    sensitiveFields.forEach((field) => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });

    logger.debug('Request body', {
      requestId: req.id,
      body: sanitizedBody,
      contentType: req.get('content-type'),
    });
  }
  next();
};

export const logResponseBody = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (body: unknown): Response {
    logger.debug('Response body', {
      requestId: req.id,
      statusCode: res.statusCode,
      bodySize: typeof body === 'string' ? body.length : 0,
    });

    return originalSend.call(this, body);
  };

  next();
};

export const logError = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Request error', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId,
  });

  next(err);
};

export const logApiCall = (service: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`API call to ${service}`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    next();
  };
};

export const logDatabaseQuery = (
  operation: string,
  collection: string
) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    const complete = (success: boolean): void => {
      const duration = Date.now() - startTime;
      logger.debug(`Database ${operation} on ${collection}`, {
        operation,
        collection,
        duration,
        success,
      });
    };

    (next as () => void)();
  };
};

export const logRequestTiming = (req: Request, _res: Response, next: NextFunction): void => {
  (req as Request & { startTime?: number }).startTime = Date.now();
  next();
};

export const createPerformanceLogger = (
  thresholdMs: number = 1000
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        logger.warn('Slow request detected', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          duration,
          threshold: thresholdMs,
        });
      }
    });

    next();
  };
};

declare module 'express' {
  interface Request {
    id?: string;
    startTime?: number;
  }

  interface Response {
    setHeader(header: string, value: string): this;
    getHeader(name: string): string | number | string[] | undefined;
  }
}