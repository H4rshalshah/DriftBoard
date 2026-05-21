import { redis } from '../config/redis';
import { webhookService } from '../services/webhookService';
import { WebhookModel, WebhookDeliveryStatus } from '../models/Webhook';
import { WebhookPayload } from '../types/notification';

interface WebhookJob {
  webhooks: string[];
  payload: WebhookPayload;
  enqueuedAt: string;
  retryCount?: number;
}

interface FailedJobData {
  job: string;
  error: string;
  failedAt: string;
  retryCount?: number;
}

export class WebhookWorker {
  private isRunning: boolean = false;
  private readonly QUEUE_KEY = 'webhook:jobs';
  private readonly PROCESSING_KEY = 'webhook:processing';
  private readonly FAILED_KEY = 'webhook:failed';
  private readonly DEAD_LETTER_KEY = 'webhook:dead-letter';
  private readonly LOCK_TTL = 300;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Webhook worker already running');
      return;
    }

    this.isRunning = true;
    console.log('Webhook worker started');
    await this.processLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Webhook worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const lockAcquired = await this.acquireLock();
        
        if (lockAcquired) {
          await this.processJobs();
          await this.processFailedJobs();
          await this.cleanupStaleJobs();
        }
      } catch (error) {
        console.error('Webhook worker error:', error);
      }

      await this.sleep(1000);
    }
  }

  private async acquireLock(): Promise<boolean> {
    const lockKey = 'webhook:worker:lock';
    const lockValue = process.pid.toString();

    const result = await redis.set(lockKey, lockValue, 'EX', this.LOCK_TTL, 'NX');
    return result === 'OK';
  }

  private async processJobs(): Promise<void> {
    const job = await redis.rpop(this.QUEUE_KEY);
    
    if (!job) {
      return;
    }

    try {
      const parsedJob = JSON.parse(job) as WebhookJob;
      console.log(`Processing webhook job: ${parsedJob.payload.type}`);

      await redis.lpush(this.PROCESSING_KEY, job);

      const results = await this.processWebhooks(parsedJob);

      await redis.lrem(this.PROCESSING_KEY, 1, job);

      await this.recordJobResults(parsedJob, results);

    } catch (error: any) {
      console.error('Failed to process webhook job:', error);
      const removed = await redis.lrem(this.PROCESSING_KEY, 1, job);
      if (removed > 0 || !job.includes('"webhookId"')) {
        await redis.lpush(this.FAILED_KEY, JSON.stringify({
          job,
          error: error.message,
          failedAt: new Date().toISOString(),
        } as FailedJobData));
      }
    }
  }

  private async processWebhooks(job: WebhookJob): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const promises = job.webhooks.map(async (webhookId) => {
      try {
        const result = await webhookService.deliverWithRetry(webhookId, job.payload);
        results.set(webhookId, result.success);
        return result;
      } catch (error: any) {
        console.error(`Webhook delivery failed for ${webhookId}:`, error);
        results.set(webhookId, false);
        return null;
      }
    });

    await Promise.allSettled(promises);

    return results;
  }

  private async recordJobResults(job: WebhookJob, results: Map<string, boolean>): Promise<void> {
    const stats = {
      total: job.webhooks.length,
      succeeded: 0,
      failed: 0,
      enqueuedAt: job.enqueuedAt,
      completedAt: new Date().toISOString(),
    };

    for (const [, success] of results) {
      if (success) {
        stats.succeeded++;
      } else {
        stats.failed++;
      }
    }

    const statsKey = `webhook:stats:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(statsKey, 'total', stats.total);
    await redis.hincrby(statsKey, 'succeeded', stats.succeeded);
    await redis.hincrby(statsKey, 'failed', stats.failed);
    await redis.expire(statsKey, 86400 * 7);

    if (stats.failed > 0) {
      console.log(`Webhook job completed: ${stats.succeeded}/${stats.total} succeeded`);
    }
  }

  private async processFailedJobs(): Promise<void> {
    const maxRetries = 3;
    const baseRetryDelay = 3600000;

    const failedJobJson = await redis.rpop(this.FAILED_KEY);
    
    if (!failedJobJson) {
      return;
    }

    try {
      const failedJob = JSON.parse(failedJobJson) as FailedJobData;
      const retryCount = (failedJob.retryCount || 0) + 1;

      if (retryCount <= maxRetries) {
        console.log(`Retrying failed webhook job (attempt ${retryCount}/${maxRetries})`);
        
        const jobData = JSON.parse(failedJob.job) as WebhookJob;
        const retryJob: WebhookJob = { ...jobData, retryCount };
        
        await redis.lpush(this.QUEUE_KEY, JSON.stringify(retryJob));

        await this.sleep(baseRetryDelay * retryCount);
      } else {
        console.log(`Webhook job exceeded max retries, moving to dead letter queue`);
        await redis.lpush(this.DEAD_LETTER_KEY, JSON.stringify({
          ...failedJob,
          movedToDeadLetter: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error processing failed job:', error);
      await redis.lpush(this.FAILED_KEY, failedJobJson);
    }
  }

  private async cleanupStaleJobs(): Promise<void> {
    const staleThreshold = 3600000;
    const processingJobs = await redis.lrange(this.PROCESSING_KEY, 0, -1);

    for (const jobJson of processingJobs) {
      try {
        const job = JSON.parse(jobJson) as WebhookJob;
        const enqueuedTime = new Date(job.enqueuedAt).getTime();
        const now = Date.now();

        if (now - enqueuedTime > staleThreshold) {
          console.log('Moving stale job to failed queue');
          await redis.lrem(this.PROCESSING_KEY, 1, jobJson);
          await redis.lpush(this.FAILED_KEY, JSON.stringify({
            job: jobJson,
            error: 'Job timed out',
            failedAt: new Date().toISOString(),
          } as FailedJobData));
        }
      } catch (error) {
        console.error('Error checking stale job:', error);
      }
    }
  }

  async enqueue(webhooks: string[], payload: WebhookPayload): Promise<void> {
    const job: WebhookJob = {
      webhooks,
      payload,
      enqueuedAt: new Date().toISOString(),
    };

    await redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
  }

  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
  }> {
    const [pending, processing, failed, deadLetter] = await Promise.all([
      redis.llen(this.QUEUE_KEY),
      redis.llen(this.PROCESSING_KEY),
      redis.llen(this.FAILED_KEY),
      redis.llen(this.DEAD_LETTER_KEY),
    ]);

    return { pending, processing, failed, deadLetter };
  }

  async getDailyStats(date?: string): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  } | null> {
    const statsKey = `webhook:stats:${date || new Date().toISOString().split('T')[0]}`;
    const stats = await redis.hgetall(statsKey);

    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }

    return {
      total: parseInt(stats.total || '0'),
      succeeded: parseInt(stats.succeeded || '0'),
      failed: parseInt(stats.failed || '0'),
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      redis: boolean;
      lockHeld: boolean;
      jobsInProgress: number;
    };
  }> {
    let redisHealthy = false;
    let lockHeld = false;
    let jobsInProgress = 0;

    try {
      await redis.ping();
      redisHealthy = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    try {
      const lockValue = await redis.get('webhook:worker:lock');
      lockHeld = lockValue === process.pid.toString();
    } catch (error) {
      console.error('Lock check failed:', error);
    }

    try {
      jobsInProgress = await redis.llen(this.PROCESSING_KEY);
    } catch (error) {
      console.error('Jobs check failed:', error);
    }

    return {
      healthy: redisHealthy && lockHeld,
      details: {
        redis: redisHealthy,
        lockHeld,
        jobsInProgress,
      },
    };
  }

  async clearQueue(): Promise<{ cleared: number }> {
    const pending = await redis.llen(this.QUEUE_KEY);
    const failed = await redis.llen(this.FAILED_KEY);
    const deadLetter = await redis.llen(this.DEAD_LETTER_KEY);
    
    await redis.del(this.QUEUE_KEY);
    await redis.del(this.FAILED_KEY);
    await redis.del(this.DEAD_LETTER_KEY);
    
    return { cleared: pending + failed + deadLetter };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const webhookWorker = new WebhookWorker();

if (require.main === module) {
  webhookWorker.start().catch(console.error);

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await webhookWorker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await webhookWorker.stop();
    process.exit(0);
  });
}