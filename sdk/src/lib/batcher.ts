import { SchemaPayload, BatchItem, Logger } from '../types';
import { Queue } from './queue';
import { HttpClient, createHttpClient, HttpClientConfig } from './httpClient';

export interface BatcherConfig {
  flushInterval: number;
  maxBatchSize: number;
  httpClient: HttpClient;
  logger: Logger;
}

export class Batcher {
  private queue: Queue;
  private config: BatcherConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isFlushing: boolean = false;

  constructor(config: BatcherConfig) {
    this.config = config;
    this.queue = new Queue(config.maxBatchSize * 2);
  }

  add(payload: SchemaPayload): void {
    this.queue.enqueue(payload);
    this.config.logger.debug('Added to batch', this.queue.size);

    if (this.queue.size >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    this.config.logger.debug('Batcher started', this.config.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.size === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const batch = this.queue.getItems(this.config.maxBatchSize);

      if (batch.length > 0) {
        const batchItem: BatchItem = {
          items: batch.map(item => item.payload),
          timestamp: new Date().toISOString()
        };

        this.config.logger.debug('Flushing batch', batch.length);
        await this.config.httpClient.sendWithRetry(batchItem);
      }
    } catch (error) {
      this.config.logger.error('Failed to flush batch', error);
    } finally {
      this.isFlushing = false;
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.flush();
    this.config.logger.debug('Batcher stopped');
  }

  get size(): number {
    return this.queue.size;
  }
}

export interface BatcherFactoryConfig {
  endpoint: string;
  apiKey: string;
  flushInterval: number;
  maxBatchSize: number;
  logger: Logger;
}

export function createBatcher(config: BatcherFactoryConfig): Batcher {
  const httpClientConfig: HttpClientConfig = {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    timeout: 10000,
    maxRetries: 3
  };

  const httpClient = createHttpClient(httpClientConfig, config.logger);

  const batcherConfig: BatcherConfig = {
    flushInterval: config.flushInterval,
    maxBatchSize: config.maxBatchSize,
    httpClient,
    logger: config.logger
  };

  return new Batcher(batcherConfig);
}