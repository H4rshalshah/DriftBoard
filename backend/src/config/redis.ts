import { createClient, RedisClientType } from 'redis';
import config from './index';
import logger from '../utils/logger';

class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType | null = null;
  private isConnecting = false;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<RedisClientType> {
    if (this.client && this.client.isOpen) {
      return this.client;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to Redis...', {
        host: config.redisHost,
        port: config.redisPort,
      });

      this.client = createClient({
        socket: {
          host: config.redisHost,
          port: config.redisPort,
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error('Max Redis reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis client reconnecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      await this.client.connect();

      this.isConnecting = false;
      return this.client;
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private async waitForConnection(): Promise<RedisClientType> {
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (this.client && this.client.isOpen) {
          resolve(this.client);
        } else if (!this.isConnecting) {
          reject(new Error('Redis connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  public async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }

  public getClient(): RedisClientType | null {
    return this.client;
  }

  public isConnected(): boolean {
    return this.client !== null && this.client.isOpen;
  }

  public async ping(): Promise<boolean> {
    if (!this.client || !this.client.isOpen) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export default RedisClient.getInstance();
