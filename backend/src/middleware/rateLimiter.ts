import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config';
import logger from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}

export const createKeyGenerator = (
  type: 'user' | 'ip' | 'api-key' | 'custom'
): ((req: Request) => string | Promise<string>) => {
  switch (type) {
    case 'user':
      return (req: Request): string => {
        if (req.user?.userId) {
          return `user:${req.user.userId}`;
        }
        return `ip:${req.ip}`;
      };
    case 'ip':
      return (req: Request): string => req.ip || 'unknown';
    case 'api-key':
      return (req: Request): string => {
        const apiKey = req.headers['x-api-key'] as string;
        return apiKey ? `apikey:${apiKey}` : `ip:${req.ip}`;
      };
    case 'custom':
      return (req: Request): string => {
        return `custom:${req.ip}`;
      };
    default:
      return (req: Request): string => req.ip || 'unknown';
  }
};

export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    standardHeaders = true,
    legacyHeaders = false,
    skip,
    keyGenerator,
    handler,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    },
    standardHeaders,
    legacyHeaders,
    skip: skip || ((_req: Request) => config.nodeEnv === 'test'),
    keyGenerator: keyGenerator || ((req: Request) => req.ip || 'unknown'),
    handler: handler || undefined,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    validate: {
      xForwardedForHeader: false,
      trustProxy: true,
      ip: true,
      path: true,
      method: true,
      env: true,
    },
  });
};

export const globalLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
  max: config.rateLimitMaxRequests || 100,
  message: 'Too many requests, please try again later',
  keyGenerator: createKeyGenerator('ip'),
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again after 15 minutes',
  keyGenerator: createKeyGenerator('ip'),
});

export const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after a minute',
  keyGenerator: createKeyGenerator('ip'),
});

export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again after an hour',
  keyGenerator: createKeyGenerator('ip'),
});

export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'API rate limit exceeded',
  keyGenerator: createKeyGenerator('api-key'),
});

export const sdkLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'SDK rate limit exceeded',
  keyGenerator: createKeyGenerator('api-key'),
});

export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Webhook rate limit exceeded',
  keyGenerator: createKeyGenerator('ip'),
});

export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Search rate limit exceeded',
  keyGenerator: createKeyGenerator('user'),
});

export const createProjectLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many project creation attempts',
  keyGenerator: createKeyGenerator('user'),
});

export const dataUploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many data upload requests',
  keyGenerator: createKeyGenerator('user'),
});

export const createRedisRateLimiter = (redisClient: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number; NX?: boolean }) => Promise<string | null>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
}) => {
  return async (
    req: Request,
    res: Response,
    options: { windowMs: number; max: number; key: string }
  ): Promise<{ success: boolean; remaining: number; resetTime: number }> => {
    const { windowMs, max, key } = options;
    const redisKey = `ratelimit:${key}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      const current = await redisClient.incr(redisKey);
      
      if (current === 1) {
        await redisClient.expire(redisKey, windowSeconds);
      }

      const ttl = await redisClient.get(redisKey);
      const resetTime = ttl ? Date.now() + windowMs : Date.now();

      if (current > max) {
        logger.warn('Rate limit exceeded', {
          key,
          current,
          max,
          ip: req.ip,
          path: req.path,
        });

        return { success: false, remaining: 0, resetTime };
      }

      return { 
        success: true, 
        remaining: Math.max(0, max - current),
        resetTime,
      };
    } catch (error) {
      logger.error('Redis rate limit error', error);
      return { success: true, remaining: max, resetTime: Date.now() + windowMs };
    }
  };
};

export const getRateLimitInfo = (req: Request): {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
} => {
  const res = req.res;
  
  if (!res) {
    return {
      limit: 0,
      current: 0,
      remaining: 0,
      resetTime: new Date(),
    };
  }

  const header = res.getHeader('X-RateLimit-Limit');
  const remaining = res.getHeader('X-RateLimit-Remaining');
  const reset = res.getHeader('X-RateLimit-Reset');

  return {
    limit: typeof header === 'number' ? header : 0,
    current: 0,
    remaining: typeof remaining === 'number' ? remaining : 0,
    resetTime: reset ? new Date(Number(reset) * 1000) : new Date(),
  };
};

declare module 'express' {
  interface Request {
    rateLimit?: {
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  }
}