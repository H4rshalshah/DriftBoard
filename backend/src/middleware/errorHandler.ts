import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTH_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, false, 'DATABASE_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 502, true, 'EXTERNAL_SERVICE_ERROR');
  }
}

export interface ErrorResponse {
  error: string;
  code?: string;
  statusCode: number;
  details?: Record<string, unknown>;
  stack?: string;
  requestId?: string;
}

export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    requestId: req.id,
  };

  if (config.nodeEnv !== 'production') {
    response.stack = req.stackTrace;
  }

  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    requestId: req.id,
  });

  res.status(404).json(response);
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    error = new DatabaseError('Database operation failed');
    if ((err as Record<string, unknown>).code === 11000) {
      error = new ConflictError('Duplicate entry');
    }
  } else if (err.name === 'CastError') {
    error = new ValidationError('Invalid ID format');
  } else if (err.name === 'JsonWebTokenError') {
    error = new AuthError('Invalid token');
  } else if (err.name === 'TokenExpiredError') {
    error = new AuthError('Token expired');
  } else {
    error = new AppError(
      config.nodeEnv === 'production' ? 'Internal server error' : err.message,
      500,
      false,
      'INTERNAL_ERROR'
    );
  }

  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    userId: req.user?.userId,
  });

  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    requestId: req.id,
  };

  if (error.details) {
    response.details = error.details;
  }

  if (config.nodeEnv !== 'production' && error.isOperational === false) {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const handleMongooseErrors = (err: Error): AppError => {
  if (err.name === 'ValidationError') {
    const mongooseError = err as Record<string, { message: string; path: string }>;
    const details: Record<string, string> = {};
    
    Object.keys(mongooseError).forEach((key) => {
      if (key !== 'message' && key !== 'name') {
        details[mongooseError[key].path] = mongooseError[key].message;
      }
    });

    return new ValidationError('Validation failed', details);
  }

  if (err.name === 'CastError') {
    return new ValidationError('Invalid ID format');
  }

  if ((err as Record<string, unknown>).code === 11000) {
    return new ConflictError('Duplicate entry');
  }

  return new DatabaseError('Database operation failed');
};

export const errorSerializer = (error: AppError): Record<string, unknown> => {
  const serialized = {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
  };

  if (error.details) {
    Object.assign(serialized, { details: error.details });
  }

  return serialized;
};

declare global {
  namespace Express {
    interface Request {
      id?: string;
      stackTrace?: string;
    }
  }
}