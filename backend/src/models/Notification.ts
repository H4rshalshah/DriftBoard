import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  NotificationType,
  DriftSeverity,
  type INotificationConfig,
  type INotificationFilters,
  type ICreateNotificationDto,
  type IUpdateNotificationDto,
} from '../types/index.js';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  type: NotificationType;
  config: INotificationConfig;
  enabled: boolean;
  lastTriggered?: Date;
  filters: INotificationFilters;
  matchesSeverity(severity: DriftSeverity): boolean;
  shouldTrigger(endpointPath: string): boolean;
  toPublicObject(): Record<string, unknown>;
}

interface INotificationModel extends Model<INotificationDocument> {
  findByUser(userId: string | mongoose.Types.ObjectId): Promise<INotificationDocument[]>;
  findEnabledByTeam(teamId: string | mongoose.Types.ObjectId): Promise<INotificationDocument[]>;
  build(dto: ICreateNotificationDto): Promise<INotificationDocument>;
}

const notificationConfigSchema = new Schema<INotificationConfig>(
  {
    webhookUrl: { type: String, default: null },
    channel: { type: String, default: null },
    mentionUser: { type: String, default: null },
    fromEmail: { type: String, default: null },
    toEmails: { type: [String], default: [] },
  },
  { _id: false },
);

const notificationFiltersSchema = new Schema<INotificationFilters>(
  {
    severities: {
      type: [String],
      enum: Object.values(DriftSeverity),
      default: [],
    },
    endpointPatterns: {
      type: [String],
      default: [],
    },
    projectIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Project',
      default: [],
    },
  },
  { _id: false },
);

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    config: {
      type: notificationConfigSchema,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastTriggered: {
      type: Date,
      default: null,
    },
    filters: {
      type: notificationFiltersSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ teamId: 1, enabled: 1 });

notificationSchema.virtual('isSlack').get(function () {
  return this.type === NotificationType.SLACK;
});

notificationSchema.virtual('isEmail').get(function () {
  return this.type === NotificationType.EMAIL;
});

notificationSchema.virtual('isDiscord').get(function () {
  return this.type === NotificationType.DISCORD;
});

notificationSchema.methods.matchesSeverity = function (severity: DriftSeverity): boolean {
  if (!this.filters.severities || this.filters.severities.length === 0) {
    return true;
  }
  return this.filters.severities.includes(severity);
};

notificationSchema.methods.shouldTrigger = function (endpointPath: string): boolean {
  if (!this.filters.endpointPatterns || this.filters.endpointPatterns.length === 0) {
    return true;
  }

  return this.filters.endpointPatterns.some((pattern) => {
    const regex = new RegExp(pattern);
    return regex.test(endpointPath);
  });
};

notificationSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    userId: this.userId,
    teamId: this.teamId,
    type: this.type,
    config: this.config,
    enabled: this.enabled,
    lastTriggered: this.lastTriggered,
    filters: this.filters,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

notificationSchema.statics.findByUser = async function (
  userId: string | mongoose.Types.ObjectId,
): Promise<INotificationDocument[]> {
  const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  return this.find({ userId: objectId });
};

notificationSchema.statics.findEnabledByTeam = async function (
  teamId: string | mongoose.Types.ObjectId,
): Promise<INotificationDocument[]> {
  const objectId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;
  return this.find({ teamId: objectId, enabled: true });
};

notificationSchema.statics.build = async function (
  dto: ICreateNotificationDto,
): Promise<INotificationDocument> {
  const notification = new this({
    userId: new mongoose.Types.ObjectId(dto.userId),
    teamId: dto.teamId ? new mongoose.Types.ObjectId(dto.teamId) : undefined,
    type: dto.type,
    config: dto.config,
    enabled: dto.enabled !== false,
    filters: dto.filters,
  });

  return notification.save();
};

export const NotificationModel = mongoose.model<INotificationDocument, INotificationModel>(
  'Notification',
  notificationSchema,
);