import { v4 as uuidv4 } from 'uuid';
import { UserModel, type IUserDocument } from '../models/User';
import tokenService from './tokenService';
import logger from '../utils/logger';
import config from '../config/index';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

export interface UserRegistration {
  email: string;
  password: string;
  name: string;
}

export interface LoginResult {
  user: Record<string, unknown>;
  tokens: AuthTokens;
}

export interface RefreshResult {
  tokens: AuthTokens;
}

export class AuthServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

class AuthService {
  public async register(dto: UserRegistration): Promise<{ user: IUserDocument; tokens: AuthTokens }> {
    const existingUser = await UserModel.findByEmail(dto.email);
    if (existingUser) {
      throw new AuthServiceError('Email already registered', 'EMAIL_EXISTS');
    }

    if (dto.password.length < 8) {
      throw new AuthServiceError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
    }

    const user = await UserModel.build({
      email: dto.email,
      password: dto.password,
      name: dto.name,
    });

    const tokens = tokenService.generateTokenPair({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await tokenService.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    logger.info('User registered', { userId: user._id, email: user.email });

    return { user, tokens };
  }

  public async login(identifier: string, password: string): Promise<LoginResult> {
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
    const user = await UserModel.findOne({
      $or: [
        { email: normalizedIdentifier },
        { username: normalizedIdentifier },
      ],
    }).select('+passwordHash +refreshToken');

    if (!user) {
      throw new AuthServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const tokens = tokenService.generateTokenPair({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await tokenService.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    user.lastLogin = new Date();
    await user.save();

    logger.info('User logged in', { userId: user._id, email: user.email });

    return {
      user: user.toSafeObject(),
      tokens,
    };
  }

  public async logout(userId: string): Promise<void> {
    await tokenService.deleteRefreshToken(userId);
    logger.info('User logged out', { userId });
  }

  public async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    const storedToken = await tokenService.getStoredRefreshToken(decoded.userId);

    if (!storedToken || storedToken !== refreshToken) {
      throw new AuthServiceError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      throw new AuthServiceError('User not found', 'USER_NOT_FOUND');
    }

    const tokens = tokenService.generateTokenPair({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await tokenService.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    logger.debug('Tokens refreshed', { userId: user._id });

    return { tokens };
  }

  public async verifyEmail(token: string): Promise<IUserDocument> {
    const decoded = tokenService.verifyAccessToken(token);
    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      throw new AuthServiceError('User not found', 'USER_NOT_FOUND');
    }

    if (user.emailVerified) {
      return user;
    }

    user.emailVerified = true;
    await user.save();

    logger.info('Email verified', { userId: user._id });

    return user;
  }

  public async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await UserModel.findByEmail(email);

    if (!user) {
      logger.debug('Password reset requested for unknown email', { email });
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    logger.info('Password reset requested', { userId: user._id, email });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  public async resetPassword(token: string, newPassword: string): Promise<IUserDocument> {
    if (newPassword.length < 8) {
      throw new AuthServiceError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
    }

    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new AuthServiceError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
    }

    user.passwordHash = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await tokenService.revokeAllUserTokens(user._id.toString());

    logger.info('Password reset completed', { userId: user._id });

    return user;
  }

  public async revokeAllTokens(userId: string): Promise<void> {
    await tokenService.revokeAllUserTokens(userId);
    logger.info('All tokens revoked for user', { userId });
  }

  public async getUserById(userId: string): Promise<IUserDocument | null> {
    return UserModel.findById(userId);
  }

  public async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new AuthServiceError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AuthServiceError('User not found', 'USER_NOT_FOUND');
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new AuthServiceError('Current password is incorrect', 'INVALID_PASSWORD');
    }

    user.passwordHash = newPassword;
    await user.save();

    await tokenService.revokeAllUserTokens(userId);

    logger.info('Password updated', { userId });
  }

  public async updateUserProfile(userId: string, name?: string, avatar?: string): Promise<IUserDocument> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AuthServiceError('User not found', 'USER_NOT_FOUND');
    }

    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();

    logger.info('User profile updated', { userId });

    return user;
  }

  public async verifyApiKey(key: string): Promise<IUserDocument | null> {
    return null;
  }
}

export const authService = new AuthService();
export default authService;
