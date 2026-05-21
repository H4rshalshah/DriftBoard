import mongoose, { Mongoose } from 'mongoose';
import config from './index';
import logger from '../utils/logger';

class Database {
  private static instance: Database;
  private connection: Mongoose | null = null;
  private retryCount = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<Mongoose> {
    if (this.connection) {
      return this.connection;
    }

    return this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<Mongoose> {
    try {
      logger.info('Attempting to connect to MongoDB...', {
        host: config.mongodbUri.split('@')[1] || config.mongodbUri,
      });

      const options: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(config.mongodbUri, options);

      logger.info('Successfully connected to MongoDB');

      this.retryCount = 0;

      this.connection.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      this.connection.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Attempting to reconnect...');
        this.handleDisconnect();
      });

      this.connection.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      this.retryCount++;
      logger.error(`Failed to connect to MongoDB (attempt ${this.retryCount}/${this.maxRetries}):`, error);

      if (this.retryCount < this.maxRetries) {
        logger.info(`Retrying in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connectWithRetry();
      }

      logger.error('Max retry attempts reached. Could not connect to MongoDB.');
      throw error;
    }
  }

  private handleDisconnect(): void {
    if (this.connection) {
      this.connection.connection.close();
    }
    this.connection = null;

    setTimeout(() => {
      this.connectWithRetry().catch((err) => {
        logger.error('Reconnection attempt failed:', err);
      });
    }, this.retryDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.connection.close();
      this.connection = null;
      logger.info('MongoDB connection closed');
    }
  }

  public isConnected(): boolean {
    return this.connection !== null && this.connection.connection.readyState === 1;
  }
}

export default Database.getInstance();
