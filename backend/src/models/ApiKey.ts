import mongoose, { Schema, type Document, type Model } from 'mongoose';
import crypto from 'crypto';
import type {
  IApiKeyPermissions,
  ICreateApiKeyDto,
} from '../types/index.js';

export interface IApiKeyDocument extends Document {
  key: string;
  keyHash: string;
  name: string;
  projectId?: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  permissions: IApiKeyPermissions;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  isExpired(): boolean;
  hasPermission(permission: keyof IApiKeyPermissions): boolean;
  hasProjectAccess(projectId: string | mongoose.Types.ObjectId): boolean;
  updateLastUsed(): Promise<void>;
  toPublicObject(): Record<string, unknown>;
}

interface IApiKeyModel extends Model<IApiKeyDocument> {
  hashKey(key: string): string;
  verifyKey(key: string): Promise<IApiKeyDocument | null>;
  build(dto: ICreateApiKeyDto): Promise<IApiKeyDocument>;
}

const apiKeyPermissionsSchema = new Schema<IApiKeyPermissions>(
  {
    endpoints: {
      type: [String],
      default: [],
    },
    projects: {
      type: [String],
      default: [],
    },
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    admin: { type: Boolean, default: false },
  },
  { _id: false },
);

const apiKeySchema = new Schema<IApiKeyDocument>(
  {
    key: {
      type: String,
      required: true,
      select: false,
    },
    keyHash: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    permissions: {
      type: apiKeyPermissionsSchema,
      default: () => ({
        read: true,
        write: false,
        admin: false,
      }),
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

apiKeySchema.index({ keyHash: 1 }, { unique: true });
apiKeySchema.index({ projectId: 1, createdAt: -1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

apiKeySchema.virtual('hasWriteAccess').get(function () {
  return this.permissions.write || this.permissions.admin;
});

apiKeySchema.virtual('isActive').get(function () {
  return !this.isExpired();
});

apiKeySchema.methods.isExpired = function (): boolean {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

apiKeySchema.methods.hasPermission = function (
  permission: keyof IApiKeyPermissions,
): boolean {
  if (this.permissions.admin) return true;

  if (permission === 'read') return this.permissions.read;
  if (permission === 'write') return this.permissions.write;

  return false;
};

apiKeySchema.methods.hasProjectAccess = function (
  projectId: string | mongoose.Types.ObjectId,
): boolean {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;

  if (this.permissions.admin) return true;

  if (this.permissions.projects.includes('*')) return true;

  return this.permissions.projects.some((p) => {
    if (p === '*') return true;
    try {
      return new mongoose.Types.ObjectId(p).equals(objectId);
    } catch {
      return false;
    }
  });
};

apiKeySchema.methods.updateLastUsed = async function (): Promise<void> {
  this.lastUsedAt = new Date();
  await this.save();
};

apiKeySchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    name: this.name,
    keyHash: this.keyHash,
    projectId: this.projectId,
    teamId: this.teamId,
    permissions: this.permissions,
    lastUsedAt: this.lastUsedAt,
    expiresAt: this.expiresAt,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

apiKeySchema.statics.hashKey = function (key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
};

apiKeySchema.statics.verifyKey = async function (
  key: string,
): Promise<IApiKeyDocument | null> {
  const keyHash = this.hashKey(key);

  const apiKey = await this.findOne({ keyHash }).select('+key');

  if (!apiKey) return null;

  if (apiKey.isExpired()) return null;

  return apiKey;
};

apiKeySchema.statics.build = async function (
  dto: ICreateApiKeyDto,
): Promise<IApiKeyDocument> {
  const keyHash = this.hashKey(dto.key);

  const apiKey = new this({
    key: dto.key,
    keyHash,
    name: dto.name,
    projectId: dto.projectId ? new mongoose.Types.ObjectId(dto.projectId) : undefined,
    teamId: dto.teamId ? new mongoose.Types.ObjectId(dto.teamId) : undefined,
    permissions: dto.permissions || { read: true, write: false, admin: false },
    expiresAt: dto.expiresAt,
    createdBy: new mongoose.Types.ObjectId(dto.createdBy),
  });

  return apiKey.save();
};

export const ApiKeyModel = mongoose.model<IApiKeyDocument, IApiKeyModel>('ApiKey', apiKeySchema);