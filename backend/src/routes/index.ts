import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import teamRoutes from './teams';
import projectRoutes from './projects';
import endpointRoutes from './endpoints';
import driftRoutes from './drift';
import notificationRoutes from './notifications';
import apiKeyRoutes from './apikeys';
import analyticsRoutes from './analytics';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teams', teamRoutes);
router.use('/projects', projectRoutes);
router.use('/endpoints', endpointRoutes);
router.use('/drift', driftRoutes);
router.use('/notifications', notificationRoutes);
router.use('/apikeys', apiKeyRoutes);
router.use('/analytics', analyticsRoutes);

export default router;