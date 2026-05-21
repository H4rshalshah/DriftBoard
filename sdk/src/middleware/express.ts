import { Request, Response, NextFunction } from 'express';
import { DriftBoardConfig, SchemaPayload, MiddlewareFactory } from '../types';
import { createLogger } from '../lib/logger';
import { Logger } from '../types';
import { createBatcher, Batcher } from '../lib/batcher';
import { extractFromRequest, extractFromResponse, captureResponseBody, simplifyObject } from '../lib/extractor';

const DEFAULT_ENDPOINT = 'https://api.driftboard.io';
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_QUEUE_SIZE = 100;
const DEFAULT_SAMPLE_RATE = 1;

export class DriftBoard {
  private config: Required<DriftBoardConfig>;
  private logger: Logger;
  private batcher: Batcher;
  private initialized: boolean = false;

  constructor(config: DriftBoardConfig) {
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint || DEFAULT_ENDPOINT,
      projectId: config.projectId || '',
      flushInterval: config.flushInterval || DEFAULT_FLUSH_INTERVAL,
      maxQueueSize: config.maxQueueSize || DEFAULT_MAX_QUEUE_SIZE,
      sampleRate: config.sampleRate || DEFAULT_SAMPLE_RATE,
      includeRequestBody: config.includeRequestBody ?? true,
      includeResponseBody: config.includeResponseBody ?? true,
      excludePaths: config.excludePaths || [],
      debug: config.debug ?? false
    };

    this.logger = createLogger(this.config.debug);
    this.batcher = createBatcher({
      endpoint: this.config.endpoint,
      apiKey: this.config.apiKey,
      flushInterval: this.config.flushInterval,
      maxBatchSize: this.config.maxQueueSize,
      logger: this.logger
    });
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.batcher.start();
    this.initialized = true;
    this.logger.info('DriftBoard initialized', { endpoint: this.config.endpoint });
  }

  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    this.initialize();

    const sdk = this;
    const config = this.config;
    const logger = this.logger;
    const batcher = this.batcher;

    return function(req: Request, res: Response, next: NextFunction): void {
      if (sdk.shouldSkip(req.path)) {
        return next();
      }

      if (!sdk.shouldSample()) {
        return next();
      }

      const startTime = Date.now();
      captureResponseBody(res);

      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        try {
          const requestSchema = config.includeRequestBody
            ? extractFromRequest(req)
            : undefined;

          const responseData = config.includeResponseBody
            ? extractFromResponse(res)
            : { statusCode };

          const payload: SchemaPayload = {
            endpoint: req.path,
            method: req.method,
            requestSchema,
            responseSchema: config.includeResponseBody ? (responseData as any).body : undefined,
            statusCode,
            responseTime,
            timestamp: new Date().toISOString(),
            metadata: {
              projectId: config.projectId,
              requestId: req.headers['x-request-id'] as string || '',
              userId: (req as any).user?.id || (req.headers['x-user-id'] as string) || undefined
            }
          };

          batcher.add(payload);
          logger.debug('Request captured', req.method, req.path, statusCode);
        } catch (error) {
          logger.error('Error capturing schema', error);
        }

        return originalEnd(chunk, encoding, cb);
      } as typeof res.end;

      next();
    };
  }

  private shouldSkip(path: string): boolean {
    return this.config.excludePaths.some(excluded =>
      path === excluded || path.startsWith(excluded)
    );
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down DriftBoard');
    await this.batcher.stop();
  }
}

export function driftboard(config: DriftBoardConfig): (req: Request, res: Response, next: NextFunction) => void {
  if (!config.apiKey) {
    throw new Error('DriftBoard: apiKey is required');
  }

  const sdk = new DriftBoard(config);
  return sdk.middleware();
}

export { DriftBoardConfig, SchemaPayload } from '../types';
