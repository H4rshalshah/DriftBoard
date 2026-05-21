import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { UserRole } from '../types/index';
import { ProjectModel } from '../models/Project';
import { TeamModel } from '../models/Team';
import logger from '../utils/logger';

export const PERMISSIONS = {
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_ADMIN: 'project:admin',
  TEAM_READ: 'team:read',
  TEAM_WRITE: 'team:write',
  TEAM_ADMIN: 'team:admin',
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_ADMIN: 'user:admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.OWNER]: 3,
  [UserRole.ADMIN]: 4,
};

export const hasMinimumRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole,
      });
      return;
    }

    next();
  };
};

export const authorizeAny = (...middlewares: RequestHandler[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    let index = 0;

    const runNext = (): void => {
      if (index >= middlewares.length) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const middleware = middlewares[index++];
      middleware(req, res, runNext);
    };

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    runNext();
  };
};

export const authorizeProject = (permission: Permission): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

    if (!projectId) {
      res.status(400).json({ error: 'Project ID required' });
      return;
    }

    try {
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      const project = await ProjectModel.findById(projectId);

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const team = await TeamModel.findById(project.teamId);

      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }

      const isOwner = team.ownerId.toString() === req.user.userId;
      const isMember = team.memberIds.some((id) => id.toString() === req.user?.userId);

      if (!isOwner && !isMember) {
        res.status(403).json({ error: 'Not a member of this project\'s team' });
        return;
      }

      switch (permission) {
        case PERMISSIONS.PROJECT_READ:
          next();
          return;
        case PERMISSIONS.PROJECT_WRITE:
          if (isOwner || hasMinimumRole(req.user.role, UserRole.MEMBER)) {
            next();
            return;
          }
          break;
        case PERMISSIONS.PROJECT_ADMIN:
          if (isOwner || req.user.role === UserRole.ADMIN) {
            next();
            return;
          }
          break;
      }

      res.status(403).json({ error: 'Insufficient project permissions' });
    } catch (error) {
      logger.error('Project authorization error', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

export const authorizeTeam = (permission: Permission): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const teamId = req.params.teamId || req.body.teamId || req.query.teamId;

    if (!teamId) {
      res.status(400).json({ error: 'Team ID required' });
      return;
    }

    try {
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      const team = await TeamModel.findById(teamId);

      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }

      const isOwner = team.ownerId.toString() === req.user.userId;
      const isMember = team.memberIds.some((id) => id.toString() === req.user?.userId);

      if (!isOwner && !isMember) {
        res.status(403).json({ error: 'Not a member of this team' });
        return;
      }

      switch (permission) {
        case PERMISSIONS.TEAM_READ:
          next();
          return;
        case PERMISSIONS.TEAM_WRITE:
          if (isOwner || hasMinimumRole(req.user.role, UserRole.MEMBER)) {
            next();
            return;
          }
          break;
        case PERMISSIONS.TEAM_ADMIN:
          if (isOwner) {
            next();
            return;
          }
          break;
      }

      res.status(403).json({ error: 'Insufficient team permissions' });
    } catch (error) {
      logger.error('Team authorization error', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

export const checkProjectMembership = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  try {
    const project = await ProjectModel.findById(projectId);
    if (!project) return false;

    const team = await TeamModel.findById(project.teamId);
    if (!team) return false;

    const isOwner = team.ownerId.toString() === userId;
    const isMember = team.memberIds.some((id) => id.toString() === userId);

    return isOwner || isMember;
  } catch {
    return false;
  }
};

export const checkTeamMembership = async (
  userId: string,
  teamId: string,
): Promise<boolean> => {
  try {
    const team = await TeamModel.findById(teamId);
    if (!team) return false;

    const isOwner = team.ownerId.toString() === userId;
    const isMember = team.memberIds.some((id) => id.toString() === userId);

    return isOwner || isMember;
  } catch {
    return false;
  }
};

export const checkOwnership = async (
  userId: string,
  resourceType: 'project' | 'team',
  resourceId: string,
): Promise<boolean> => {
  try {
    if (resourceType === 'team') {
      const team = await TeamModel.findById(resourceId);
      return team?.ownerId.toString() === userId;
    }

    if (resourceType === 'project') {
      const project = await ProjectModel.findById(resourceId);
      if (!project) return false;
      const team = await TeamModel.findById(project.teamId);
      return team?.ownerId.toString() === userId;
    }

    return false;
  } catch {
    return false;
  }
};