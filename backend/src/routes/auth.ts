import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import authService from '../services/authService';
import logger from '../utils/logger';

const router = Router();

const validate = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or email already exists
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register({ email, password, name });

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user.toSafeObject(),
        tokens: result.tokens,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthServiceError') {
        const authError = error as any;
        if (authError.code === 'EMAIL_EXISTS') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      logger.error('Registration error', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [
    body('identifier')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Email or username is required'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('username')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier, email, username, password } = req.body;
      const result = await authService.login(identifier || email || username, password);

      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthServiceError') {
        res.status(401).json({ error: error.message });
        return;
      }
      logger.error('Login error', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and invalidate tokens
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.logout(req.user!.userId);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      res.json({
        message: 'Token refreshed successfully',
        tokens: result.tokens,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthServiceError') {
        res.status(401).json({ error: error.message });
        return;
      }
      logger.error('Token refresh error', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/verify-email',
  [body('token').notEmpty().withMessage('Verification token is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;
      const user = await authService.verifyEmail(token);

      res.json({
        message: 'Email verified successfully',
        user: user.toSafeObject(),
      });
    } catch (error) {
      logger.error('Email verification error', error);
      res.status(400).json({ error: 'Invalid or expired verification token' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent if account exists
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);

      res.json(result);
    } catch (error) {
      logger.error('Forgot password error', error);
      res.status(500).json({ error: 'Password reset request failed' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const user = await authService.resetPassword(token, newPassword);

      res.json({
        message: 'Password reset successful',
        user: user.toSafeObject(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthServiceError') {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error('Reset password error', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Authentication required
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: user.toSafeObject() });
  } catch (error) {
    logger.error('Get profile error', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 */
router.patch(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, avatar } = req.body;
      const user = await authService.updateUserProfile(req.user!.userId, name, avatar);

      res.json({
        message: 'Profile updated successfully',
        user: user.toSafeObject(),
      });
    } catch (error) {
      logger.error('Update profile error', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.updatePassword(req.user!.userId, currentPassword, newPassword);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthServiceError') {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error('Change password error', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

export default router;
