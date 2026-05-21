import bcrypt from 'bcrypt';
import { v4 as uuidv4, randomBytes } from 'uuid';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { UserModel, type IUserDocument } from '../models/User';
import { ApiKeyModel, type IApiKeyDocument } from '../models/ApiKey';
import { type IApiKeyPermissions } from '../types/index';
import logger from '../utils/logger';

export interface ApiKeyResponse {
  id: string;
  key: string;
  name: string;
  keyHash: string;
  permissions: IApiKeyPermissions;
  expiresAt?: Date;
  createdAt: Date;
}

class ApiKeyService {
  public async generateApiKey(
    projectId: string | null,
    teamId: string | null,
    name: string,
    permissions: IApiKeyPermissions,
    createdBy: string,
    expiresAt?: Date,
  ): Promise<ApiKeyResponse> {
    const rawKey = this.generateSecureKey();

    const apiKey = await ApiKeyModel.build({
      key: rawKey,
      name,
      projectId: projectId || undefined,
      teamId: teamId || undefined,
      permissions,
      expiresAt,
      createdBy,
    });

    logger.info('API key generated', {
      keyId: apiKey._id,
      name,
      projectId,
      teamId,
    });

    return {
      id: apiKey._id.toString(),
      key: rawKey,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
    };
  }

  public async validateApiKey(key: string): Promise<IApiKeyDocument | null> {
    if (!key || key.length < 32) {
      return null;
    }

    const apiKey = await ApiKeyModel.verifyKey(key);

    if (apiKey) {
      await apiKey.updateLastUsed();
      logger.debug('API key validated', { keyId: apiKey._id });
    }

    return apiKey;
  }

  public async revokeApiKey(keyId: string, revokedBy: string): Promise<boolean> {
    const key = await ApiKeyModel.findById(keyId);

    if (!key) {
      logger.warn('API key not found for revocation', { keyId });
      return false;
    }

    await ApiKeyModel.deleteOne({ _id: keyId });

    logger.info('API key revoked', {
      keyId,
      name: key.name,
      revokedBy,
    });

    return true;
  }

  public async listApiKeys(projectId: string): Promise<Record<string, unknown>[]> {
    const keys = await ApiKeyModel.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 });

    return keys.map((key) => key.toPublicObject());
  }

  public async listTeamApiKeys(teamId: string): Promise<Record<string, unknown>[]> {
    const keys = await ApiKeyModel.find({ teamId: new mongoose.Types.ObjectId(teamId) })
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 });

    return keys.map((key) => key.toPublicObject());
  }

  public async rotateApiKey(keyId: string): Promise<{ newKey: string } | null> {
    const oldKey = await ApiKeyModel.findById(keyId);

    if (!oldKey) {
      return null;
    }

    const newRawKey = this.generateSecureKey();
    const newKeyHash = ApiKeyModel.hashKey(newRawKey);

    oldKey.key = newRawKey;
    oldKey.keyHash = newKeyHash;
    await oldKey.save();

    logger.info('API key rotated', { keyId, name: oldKey.name });

    return { newKey: newRawKey };
  }

  public async getKeyById(keyId: string): Promise<IApiKeyDocument | null> {
    return ApiKeyModel.findById(keyId);
  }

  public async updateKeyPermissions(
    keyId: string,
    permissions: IApiKeyPermissions,
  ): Promise<IApiKeyDocument | null> {
    const key = await ApiKeyModel.findByIdAndUpdate(
      keyId,
      { permissions },
      { new: true },
    );

    if (key) {
      logger.info('API key permissions updated', {
        keyId,
        permissions,
      });
    }

    return key;
  }

  public async cleanupExpiredKeys(): Promise<number> {
    const result = await ApiKeyModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    if (result.deletedCount > 0) {
      logger.info('Expired API keys cleaned up', {
        count: result.deletedCount,
      });
    }

    return result.deletedCount;
  }

  private generateSecureKey(): string {
    const prefix = 'db_key_';
    const randomPart = randomBytes(24).toString('base64url');
    return `${prefix}${randomPart}`;
  }

  public hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

export const apiKeyService = new ApiKeyService();
export default apiKeyService;