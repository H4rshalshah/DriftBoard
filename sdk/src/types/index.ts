import { Request, Response, NextFunction } from 'express';

export interface DriftBoardConfig {
  apiKey: string;
  endpoint?: string;
  projectId?: string;
  flushInterval?: number;
  maxQueueSize?: number;
  sampleRate?: number;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  excludePaths?: string[];
  debug?: boolean;
}

export interface SchemaPayload {
  endpoint: string;
  method: string;
  requestSchema?: object;
  responseSchema?: object;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  metadata?: {
    userId?: string;
    requestId?: string;
    [key: string]: any;
  };
}

export interface QueueItem {
  id: string;
  payload: SchemaPayload;
  timestamp: number;
  retries: number;
}

export interface BatchItem {
  items: SchemaPayload[];
  timestamp: string;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface HttpClient {
  send(payload: BatchItem): Promise<void>;
  shutdown(): Promise<void>;
}

export type MiddlewareFactory = (config: DriftBoardConfig) => (req: Request, res: Response, next: NextFunction) => void;