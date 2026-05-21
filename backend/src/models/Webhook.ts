import mongoose, { Document, Schema } from 'mongoose';

export enum WebhookDeliveryStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  RETRYING = 'retrying',
}

export interface IWebhook {
  _id?: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  url: string;
  events: string[];
  secret: string;
  headers: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSuccessfulDelivery?: Date;
  lastFailedDelivery?: Date;
  consecutiveFailures: number;
}

export interface IWebhookDeliveryRecord {
  _id?: mongoose.Types.ObjectId;
  webhookId: mongoose.Types.ObjectId;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  duration: number;
  attemptNumber: number;
  attemptedAt: Date;
}

const webhookSchema = new Schema<IWebhook>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    url: { type: String, required: true },
    events: { type: [String], required: true, index: true },
    secret: { type: String, required: true },
    headers: { type: Map, of: String, default: {} },
    active: { type: Boolean, default: true, index: true },
    lastSuccessfulDelivery: { type: Date },
    lastFailedDelivery: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const webhookDeliveryRecordSchema = new Schema<IWebhookDeliveryRecord>(
  {
    webhookId: { type: Schema.Types.ObjectId, ref: 'Webhook', required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(WebhookDeliveryStatus), required: true, index: true },
    responseStatus: { type: Number },
    responseBody: { type: String, maxlength: 10000 },
    error: { type: String, maxlength: 2000 },
    duration: { type: Number, required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    attemptedAt: { type: Date, required: true, index: true },
  },
  { timestamps: false }
);

export const WebhookModel = mongoose.model<IWebhook>('Webhook', webhookSchema);
export const WebhookDeliveryRecordModel = mongoose.model<IWebhookDeliveryRecord>('WebhookDeliveryRecord', webhookDeliveryRecordSchema);