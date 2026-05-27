import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index';
import redisClient from '../config/redis';
import { UserRole, type ITokenPayload } from '../types/index';

export const REFRESH_TOKEN_PREFIX = 'refresh_token:';
export const TOKEN_BLACKLIST_PREFIX = 'token_blacklist:';
export const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes
export const REFRESH_TOKEN_EXPIRY = 604800; // 7 days

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

class TokenService {
  public generateAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    const payload: ITokenPayload = {
      userId: user.id,
      email: user.email,

      // This is only global account role.
      // Do NOT use this for project/team permissions.
      role: user.role,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      issuer: 'driftboard',
      jwtid: uuidv4(),
    });
  }

  public generateRefreshToken(user: {
    id: string;
    email: string;
    role: UserRole;
  }): string {
    const payload: ITokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn,
      issuer: 'driftboard',
      jwtid: uuidv4(),
    });
  }

  public generateTokenPair(user: {
    id: string;
    email: string;
    role: UserRole;
  }): TokenPair {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: new Date(Date.now() + ACCESS_TOKEN_EXPIRY * 1000),
      refreshTokenExpiry: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000),
    };
  }

  public async storeRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    const redis = redisClient.getClient();

    if (!redis) {
      throw new Error('Redis client not initialized');
    }

    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;

    const tokenData = JSON.stringify({
      token: refreshToken,
      createdAt: new Date().toISOString(),
    });

    await redis.set(key, tokenData, {
      EX: REFRESH_TOKEN_EXPIRY,
    });
  }

  public async getStoredRefreshToken(userId: string): Promise<string | null> {
    const redis = redisClient.getClient();

    if (!redis) {
      return null;
    }

    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return parsed.token || null;
    } catch {
      return null;
    }
  }

  public async deleteRefreshToken(userId: string): Promise<void> {
    const redis = redisClient.getClient();

    if (!redis) {
      return;
    }

    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
    await redis.del(key);
  }

  public async revokeAllUserTokens(userId: string): Promise<void> {
    await this.deleteRefreshToken(userId);
  }

  public async blacklistToken(
    jti: string,
    userId: string,
    expiresIn: number
  ): Promise<void> {
    const redis = redisClient.getClient();

    if (!redis || !jti || !userId) {
      return;
    }

    const key = `${TOKEN_BLACKLIST_PREFIX}${userId}:${jti}`;

    await redis.set(key, '1', {
      EX: expiresIn,
    });
  }

  public async isTokenBlacklisted(
    jti: string,
    userId: string
  ): Promise<boolean> {
    const redis = redisClient.getClient();

    if (!redis || !jti || !userId) {
      return false;
    }

    const key = `${TOKEN_BLACKLIST_PREFIX}${userId}:${jti}`;
    const result = await redis.get(key);

    return result !== null;
  }

  public verifyAccessToken(token: string): ITokenPayload & { jti?: string } {
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        issuer: 'driftboard',
      }) as ITokenPayload & { jti?: string };

      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        jti: payload.jti,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }

      throw error;
    }
  }

  public verifyRefreshToken(token: string): ITokenPayload & { jti: string } {
    try {
      const payload = jwt.verify(token, config.jwtRefreshSecret, {
        issuer: 'driftboard',
      }) as ITokenPayload & { jti: string };

      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        jti: payload.jti,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }

      throw error;
    }
  }

  public decodeToken(
    token: string
  ): (ITokenPayload & { jti?: string; exp?: number; iat?: number }) | null {
    try {
      return jwt.decode(token) as ITokenPayload & {
        jti?: string;
        exp?: number;
        iat?: number;
      };
    } catch {
      return null;
    }
  }

  public getTokenExpiry(token: string): Date | null {
    const decoded = this.decodeToken(token);

    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  public getRefreshTokenTTL(): number {
    return REFRESH_TOKEN_EXPIRY;
  }
}

export const tokenService = new TokenService();
export default tokenService;