import helmet, { HelmetOptions } from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../utils/logger';
import { AuthError, RateLimitError } from './errorHandler';

const defaultHelmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : undefined,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
};

export const helmetMiddleware = helmet(defaultHelmetOptions);

export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

export const addRequestIdMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.id = requestId;
  req.stackTrace = new Error().stack;
  next();
};

export const sanitizeInputMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const sanitize = (obj: Record<string, unknown> | unknown[] | string): unknown => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/<iframe/gi, '')
        .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value as Record<string, unknown>);
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body as Record<string, unknown>) as Record<string, unknown>;
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query as Record<string, unknown>) as Record<string, unknown>;
  }

  next();
};

export const xssProtectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Security-Policy', "default-src 'self'");
  res.removeHeader('X-Powered-By');
  next();
};

export const preventClickjackingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

export const preventMIMETypeSniffing = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

export const enforceHTTPSMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (config.nodeEnv === 'production' && req.protocol !== 'https') {
    logger.warn('Non-HTTPS request received', {
      ip: req.ip,
      protocol: req.protocol,
      url: req.url,
    });
    res.redirect(`https://${req.hostname}${req.url}`);
    return;
  }
  next();
};

export const validateApiKeyMiddleware = (
  validateKey: (key: string) => Promise<boolean>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      next(new AuthError('API key is required'));
      return;
    }

    if (apiKey.length < 32) {
      next(new AuthError('Invalid API key format'));
      return;
    }

    try {
      const isValid = await validateKey(apiKey);

      if (!isValid) {
        next(new AuthError('Invalid or expired API key'));
        return;
      }

      next();
    } catch (error) {
      logger.error('API key validation error', error);
      next(new AuthError('API key validation failed'));
    }
  };
};

interface BruteForceConfig {
  maxAttempts: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
  onExceeded?: (req: Request, key: string) => void;
}

export const createBruteForceProtection = (
  storage: Map<string, { count: number; resetTime: number }>,
  config: BruteForceConfig
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = config.keyGenerator 
      ? config.keyGenerator(req) 
      : `${req.ip}:${req.path}`;

    const now = Date.now();
    const record = storage.get(key);

    if (!record || now > record.resetTime) {
      storage.set(key, { count: 1, resetTime: now + config.windowMs });
      next();
      return;
    }

    record.count += 1;

    if (record.count > config.maxAttempts) {
      const waitTime = Math.ceil((record.resetTime - now) / 1000);
      logger.warn('Brute force attack detected', {
        key,
        count: record.count,
        ip: req.ip,
        path: req.path,
      });

      if (config.onExceeded) {
        config.onExceeded(req, key);
      }

      next(new RateLimitError(`Too many attempts. Please wait ${waitTime} seconds`));
      return;
    }

    next();
  };
};

export const createLoginAttemptProtection = (
  storage: Map<string, { count: number; resetTime: number; lockUntil?: number }>,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000,
  lockoutMs: number = 30 * 60 * 1000
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `login:${req.ip}`;
    const now = Date.now();
    const record = storage.get(key);

    if (record?.lockUntil && now < record.lockUntil) {
      const remainingTime = Math.ceil((record.lockUntil - now) / 1000);
      next(new RateLimitError(`Account locked. Try again in ${remainingTime} seconds`));
      return;
    }

    if (!record || now > record.resetTime) {
      storage.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    record.count += 1;

    if (record.count > maxAttempts) {
      record.lockUntil = now + lockoutMs;
      logger.warn('Login attempt limit exceeded', {
        ip: req.ip,
        email: req.body?.email,
        count: record.count,
      });
      next(new RateLimitError('Too many login attempts. Please try again later'));
      return;
    }

    next();
  };
};

export const clearLoginAttempts = (
  storage: Map<string, { count: number; resetTime: number; lockUntil?: number }>
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = `login:${req.ip}`;
    storage.delete(key);
    next();
  };
};

export const trustProxyMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (config.nodeEnv === 'production') {
    req.ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket.remoteAddress 
      || 'unknown';
  }
  next();
};

export const requestSizeLimitMiddleware = (
  limit: string = '10mb'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = parseInt(limit, 10) * 1024 * 1024;

    if (contentLength > maxSize) {
      res.status(413).json({
        error: 'Request entity too large',
        code: 'PAYLOAD_TOO_LARGE',
        statusCode: 413,
      });
      return;
    }

    next();
  };
};

export const contentTypeValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      res.status(415).json({
        error: 'Content-Type header is required',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        statusCode: 415,
      });
      return;
    }

    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ];

    const isAllowed = allowedTypes.some((type) => contentType.includes(type));

    if (!isAllowed) {
      res.status(415).json({
        error: 'Unsupported Media Type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        statusCode: 415,
      });
      return;
    }
  }

  next();
};

export const additionalSecurityHeaders = {
  'X-Download-Options': 'noopen',
  'X-Turbo-Version': '1.0',
  'X-Request-Id': (req: Request) => req.id || uuidv4(),
};

export const applyAdditionalHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  Object.entries(additionalSecurityHeaders).forEach(([header, value]) => {
    const headerValue = typeof value === 'function' ? value(req) : value;
    res.setHeader(header, headerValue);
  });
  next();
};

declare module 'express' {
  interface Request {
    id?: string;
    stackTrace?: string;
  }
}
