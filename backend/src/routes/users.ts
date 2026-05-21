import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserModel } from '../models/User';
import { TeamModel } from '../models/Team';
import { ProjectModel } from '../models/Project';
import { UserRole } from '../types';
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

const validateObjectId = (value: string): boolean => {
  return mongoose.Types.ObjectId.isValid(value);
};

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, owner, member, viewer]
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Admin access required
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
    query('role').optional().isIn(Object.values(UserRole)),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const skip = (page - 1) * limit;
      const search = req.query.search as string;
      const role = req.query.role as UserRole;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }
      if (role) {
        filter.role = role;
      }

      const [users, total] = await Promise.all([
        UserModel.find(filter).select('-passwordHash -refreshToken').skip(skip).limit(limit).sort({ createdAt: -1 }),
        UserModel.countDocuments(filter),
      ]);

      res.json({
        users: users.map((u) => u.toSafeObject()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('List users error', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  authenticate,
  [
    param('id').custom(validateObjectId).withMessage('Invalid user ID'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await UserModel.findById(req.params.id).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: user.toSafeObject() });
    } catch (error) {
      logger.error('Get user error', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               avatar:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, owner, member, viewer]
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.patch(
  '/:id',
  authenticate,
  [
    param('id').custom(validateObjectId).withMessage('Invalid user ID'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
    body('role').optional().isIn(Object.values(UserRole)),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, avatar, role } = req.body;
      const updates: Record<string, unknown> = {};

      if (name) updates.name = name;
      if (avatar !== undefined) updates.avatar = avatar;
      if (role) updates.role = role;

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true }
      ).select('-passwordHash -refreshToken');

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        message: 'User updated successfully',
        user: user.toSafeObject(),
      });
    } catch (error) {
      logger.error('Update user error', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  [
    param('id').custom(validateObjectId).withMessage('Invalid user ID'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await UserModel.findByIdAndDelete(req.params.id);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Delete user error', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/teams:
 *   get:
 *     summary: Get user's teams
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User's teams
 *       404:
 *         description: User not found
 */
router.get(
  '/:id/teams',
  authenticate,
  [
    param('id').custom(validateObjectId).withMessage('Invalid user ID'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await UserModel.findById(req.params.id);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const teams = await TeamModel.find({
        $or: [
          { ownerId: req.params.id },
          { memberIds: req.params.id },
        ],
      });

      res.json({ teams: teams.map((t) => t.toPublicObject()) });
    } catch (error) {
      logger.error('Get user teams error', error);
      res.status(500).json({ error: 'Failed to get user teams' });
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/projects:
 *   get:
 *     summary: Get user's projects
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User's projects
 *       404:
 *         description: User not found
 */
router.get(
  '/:id/projects',
  authenticate,
  [
    param('id').custom(validateObjectId).withMessage('Invalid user ID'),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await UserModel.findById(req.params.id);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userTeamIds = [...user.teamIds];
      const userTeams = await TeamModel.find({
        $or: [
          { ownerId: req.params.id },
          { memberIds: req.params.id },
        ],
      });

      for (const team of userTeams) {
        if (!userTeamIds.some((id) => id.equals(team._id))) {
          userTeamIds.push(team._id);
        }
      }

      const projects = await ProjectModel.find({
        teamId: { $in: userTeamIds },
      });

      res.json({ projects: projects.map((p) => p.toPublicObject()) });
    } catch (error) {
      logger.error('Get user projects error', error);
      res.status(500).json({ error: 'Failed to get user projects' });
    }
  }
);

export default router;