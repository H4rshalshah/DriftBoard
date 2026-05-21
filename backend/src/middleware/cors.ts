import { Response } from 'express';
import config from '../config';
import logger from '../utils/logger';

interface CorsConfigOptions {
  origin?: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

const defaultCorsOptions: CorsConfigOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-API-Key',
    'X-Client-Id',
    'Accept',
    'Accept-Language',
    'Origin',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
  ],
  maxAge: 86400,
};

const getAllowedOrigins = (): string[] => {
  const origins = config.frontendUrl || 'http://localhost:3000';
  
  if (typeof origins === 'string') {
    return origins.split(',').map((o) => o.trim());
  }
  
  if (Array.isArray(origins)) {
    return origins;
  }
  
  return [String(origins)];
};

const validateOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowedOrigins = getAllowedOrigins();

  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.startsWith('http://localhost') || allowed.startsWith('127.0.0.1')) {
      return origin.startsWith('http://localhost') || origin.startsWith('127.0.0.1');
    }
    return allowed === origin;
  });

  if (isAllowed) {
    callback(null, true);
  } else if (config.nodeEnv === 'development') {
    logger.warn('Unknown origin in development mode', { origin });
    callback(null, true);
  } else {
    logger.warn('CORS origin rejected', { origin });
    callback(new Error('Not allowed by CORS'));
  }
};

export const createCorsOptions = (options?: CorsConfigOptions): CorsOptions => {
  return {
    ...defaultCorsOptions,
    ...options,
    origin: options?.origin !== undefined 
      ? options.origin 
      : validateOrigin,
  };
};

export const corsOptions: CorsOptions = createCorsOptions();

export const corsMiddleware = cors(corsOptions);

export const createCustomCorsMiddleware = (
  allowedOrigins: string[],
  options: Partial<CorsConfigOptions> = {}
) => {
  return cors({
    ...defaultCorsOptions,
    ...options,
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ): void => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn('CORS origin rejected', { origin, allowedOrigins });
        callback(new Error('Not allowed by CORS'));
      }
    },
  });
};

export const apiCorsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Client-Id',
  ],
  credentials: false,
  maxAge: 86400,
});

export const sdkCorsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
  ],
  credentials: false,
  maxAge: 3600,
});

export const websocketCorsMiddleware = cors({
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export const handlePreflightRequest = (
  req: Request,
  res: Response & { header(name: string, value: string): Response },
  next: () => void
): void => {
  const origin = req.headers.origin;

  if (origin) {
    const allowedOrigins = getAllowedOrigins();
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      return allowed === origin;
    });

    if (isAllowed || config.nodeEnv === 'development') {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-API-Key');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
    }
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};

export const addCorsHeaders = (
  req: Request,
  res: Response & { header(name: string, value: string): Response },
  next: () => void
): void => {
  const origin = req.headers.origin;

  if (origin) {
    const allowedOrigins = getAllowedOrigins();
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      return allowed === origin;
    });

    if (isAllowed || config.nodeEnv === 'development') {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.header('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining');
  
  next();
};

export const validateCorsOrigin = (origin: string): boolean => {
  const allowedOrigins = getAllowedOrigins();
  
  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '');
      return origin.startsWith(pattern);
    }
    return allowed === origin;
  });
};

export const getCorsConfiguration = (): {
  allowedOrigins: string[];
  maxAge: number;
  credentials: boolean;
} => {
  return {
    allowedOrigins: getAllowedOrigins(),
    maxAge: defaultCorsOptions.maxAge || 86400,
    credentials: defaultCorsOptions.credentials || true,
  };
};

declare module 'express' {
  interface Request {
    allowedOrigin?: string;
  }
}