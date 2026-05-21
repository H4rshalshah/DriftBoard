import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger, BatchItem } from '../types';

export interface HttpClientConfig {
  endpoint: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private logger: Logger;
  private maxRetries: number;
  private retryCount: number = 0;

  constructor(config: HttpClientConfig, logger: Logger) {
    this.maxRetries = config.maxRetries || 3;
    this.logger = logger;

    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-SDK-Version': '1.0.0'
      }
    });

    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        this.logger.error('HTTP Error', error.message, error.response?.status);
        return Promise.reject(error);
      }
    );
  }

  async send(batch: BatchItem): Promise<void> {
    try {
      await this.client.post('/api/v1/schemas', batch);
      this.logger.debug('Successfully sent batch', batch.items.length);
    } catch (error) {
      this.logger.error('Failed to send batch', error);
      throw error;
    }
  }

  async sendWithRetry(batch: BatchItem, retries: number = 0): Promise<void> {
    try {
      await this.send(batch);
    } catch (error) {
      if (retries < this.maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        this.logger.warn(`Retry ${retries + 1}/${this.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
        return this.sendWithRetry(batch, retries + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    this.logger.debug('Shutting down HTTP client');
  }
}

export function createHttpClient(config: HttpClientConfig, logger: Logger): HttpClient {
  return new HttpClient(config, logger);
}