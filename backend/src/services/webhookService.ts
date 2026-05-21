import crypto from 'crypto';
import { WebhookModel, WebhookDeliveryRecordModel, WebhookDeliveryStatus, IWebhook, IWebhookDeliveryRecord } from '../models/Webhook';
import { redis } from '../config/redis';
import { WebhookPayload, WebhookDeliveryResult, WebhookRegistrationData } from '../types/notification';

export class WebhookService {
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 30000];

  async register(data: WebhookRegistrationData): Promise<IWebhook> {
    const secret = data.secret || crypto.randomBytes(32).toString('hex');
    
    const webhook = new WebhookModel({
      projectId: data.projectId,
      url: data.url,
      events: data.events,
      secret,
      headers: data.headers || {},
      active: data.active !== false,
      consecutiveFailures: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await webhook.save();
    return webhook;
  }

  async unregister(webhookId: string): Promise<boolean> {
    const result = await WebhookModel.deleteOne({ _id: webhookId });
    return result.deletedCount > 0;
  }

  async listByProject(projectId: string): Promise<IWebhook[]> {
    return WebhookModel.find({ projectId }).sort({ createdAt: -1 });
  }

  async update(webhookId: string, data: Partial<WebhookRegistrationData>): Promise<IWebhook | null> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    if (data.url !== undefined) updateData.url = data.url;
    if (data.events !== undefined) updateData.events = data.events;
    if (data.headers !== undefined) updateData.headers = data.headers;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.secret !== undefined) updateData.secret = data.secret;

    return WebhookModel.findByIdAndUpdate(webhookId, updateData, { new: true });
  }

  async deliver(
    url: string,
    payload: WebhookPayload,
    secret?: string
  ): Promise<WebhookDeliveryResult> {
    const deliveryId = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();
    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-ID': deliveryId,
      'X-Webhook-Timestamp': timestamp,
    };

    if (secret) {
      const signature = this.generateSignature(payloadString, secret, timestamp);
      headers['X-Webhook-Signature'] = signature;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000),
        duration,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  async deliverWithRetry(
    webhookId: string,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const webhook = await WebhookModel.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const deliveryId = crypto.randomBytes(16).toString('hex');
    const enrichedPayload: WebhookPayload = { ...payload, deliveryId };

    let lastResult: WebhookDeliveryResult | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = this.RETRY_DELAYS[attempt - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        await this.sleep(delay);
      }

      const result = await this.deliver(webhook.url, enrichedPayload, webhook.secret);
      lastResult = result;

      await this.recordDelivery(webhookId, enrichedPayload, result, attempt);

      if (result.success) {
        await this.updateSuccessMetrics(webhookId);
        return result;
      }
    }

    if (lastResult) {
      await this.updateFailureMetrics(webhookId);
    }

    return lastResult!;
  }

  async triggerForEvent(
    projectId: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    const webhooks = await WebhookModel.find({
      projectId,
      active: true,
      events: eventType,
    });

    if (webhooks.length === 0) {
      return;
    }

    const enrichedPayload: WebhookPayload = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    await redis.lpush(
      'webhook:jobs',
      JSON.stringify({
        webhooks: webhooks.map((w) => w._id.toString()),
        payload: enrichedPayload,
        enqueuedAt: new Date().toISOString(),
      })
    );
  }

  async getDeliveryHistory(
    webhookId: string,
    options: { limit?: number; offset?: number; status?: WebhookDeliveryStatus } = {}
  ): Promise<{ deliveries: IWebhookDeliveryRecord[]; total: number }> {
    const { limit = 50, offset = 0, status } = options;

    const query: Record<string, any> = { webhookId };
    if (status) {
      query.status = status;
    }

    const [deliveries, total] = await Promise.all([
      WebhookDeliveryRecordModel.find(query).sort({ attemptedAt: -1 }).skip(offset).limit(limit),
      WebhookDeliveryRecordModel.countDocuments(query),
    ]);

    return { deliveries, total };
  }

  async testWebhook(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = await WebhookModel.findById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      type: 'test',
      payload: {
        message: 'This is a test webhook delivery from DriftBoard',
        webhookId: webhook._id.toString(),
      },
      timestamp: new Date().toISOString(),
    };

    return this.deliverWithRetry(webhookId, testPayload);
  }

  private generateSignature(payload: string, secret: string, timestamp: string): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');
    return `sha256=${signature}`;
  }

  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string,
    toleranceSeconds: number = 300
  ): boolean {
    try {
      const timestampDate = new Date(timestamp);
      const timestampAge = Math.floor((Date.now() - timestampDate.getTime()) / 1000);
      
      if (timestampAge > toleranceSeconds) {
        return false;
      }

      const expectedSignature = this.generateSignature(payload, secret, timestamp);
      
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  private async recordDelivery(
    webhookId: string,
    payload: WebhookPayload,
    result: WebhookDeliveryResult,
    attempt: number
  ): Promise<void> {
    const delivery = new WebhookDeliveryRecordModel({
      webhookId,
      payload,
      status: result.success ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED,
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
      duration: result.duration,
      attemptNumber: attempt + 1,
      attemptedAt: new Date(),
    });

    await delivery.save();
  }

  private async updateSuccessMetrics(webhookId: string): Promise<void> {
    await WebhookModel.findByIdAndUpdate(webhookId, {
      $set: { lastSuccessfulDelivery: new Date() },
      $inc: { consecutiveFailures: -Math.min(3, 1) },
    });
  }

  private async updateFailureMetrics(webhookId: string): Promise<void> {
    await WebhookModel.findByIdAndUpdate(webhookId, {
      $set: { lastFailedDelivery: new Date() },
      $inc: { consecutiveFailures: 1 },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const webhookService = new WebhookService();