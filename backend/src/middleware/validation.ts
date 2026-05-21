import { body, param, query } from 'express-validator';
import { ValidationSchema } from './validate';
import { HttpMethod, NotificationType } from '../types';

export const registerValidation: ValidationSchema = {
  body: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email must be less than 255 characters'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s\-'\.]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
  ],
};

export const loginValidation: ValidationSchema = {
  body: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
};

export const refreshTokenValidation: ValidationSchema = {
  body: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isJWT()
      .withMessage('Invalid refresh token format'),
  ],
};

export const forgotPasswordValidation: ValidationSchema = {
  body: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
  ],
};

export const resetPasswordValidation: ValidationSchema = {
  body: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
};

export const updateUserValidation: ValidationSchema = {
  body: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s\-'\.]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL'),
  ],
};

export const createTeamValidation: ValidationSchema = {
  body: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Team name must be between 2 and 100 characters'),
    body('slug')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Slug must be between 2 and 50 characters')
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],
};

export const updateTeamValidation: ValidationSchema = {
  body: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Team name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),
    body('settings.logo')
      .optional()
      .isURL()
      .withMessage('Logo must be a valid URL'),
    body('settings.primaryColor')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Primary color must be a valid hex color'),
    body('settings.secondaryColor')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Secondary color must be a valid hex color'),
  ],
};

export const createProjectValidation: ValidationSchema = {
  body: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Project name must be between 2 and 100 characters'),
    body('slug')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Slug must be between 2 and 50 characters')
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('teamId')
      .notEmpty()
      .withMessage('Team ID is required')
      .isMongoId()
      .withMessage('Team ID must be a valid MongoDB ObjectId'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags: string[]) => {
        if (tags.length > 20) throw new Error('Maximum 20 tags allowed');
        return true;
      }),
  ],
};

export const updateProjectValidation: ValidationSchema = {
  body: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Project name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),
    body('settings.retentionDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Retention days must be between 1 and 365'),
    body('settings.autoRemediate')
      .optional()
      .isBoolean()
      .withMessage('Auto remediate must be a boolean'),
    body('settings.diffContext')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Diff context must be between 1 and 50'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ],
};

export const createEndpointValidation: ValidationSchema = {
  body: [
    body('path')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Path must be between 1 and 500 characters')
      .matches(/^\/[a-zA-Z0-9\-\/_{}]+$/)
      .withMessage('Path must start with / and contain only alphanumeric characters, hyphens, underscores, and curly braces'),
    body('method')
      .isIn(Object.values(HttpMethod))
      .withMessage('Method must be a valid HTTP method'),
    body('projectId')
      .notEmpty()
      .withMessage('Project ID is required')
      .isMongoId()
      .withMessage('Project ID must be a valid MongoDB ObjectId'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('deprecated')
      .optional()
      .isBoolean()
      .withMessage('Deprecated must be a boolean'),
  ],
};

export const updateEndpointValidation: ValidationSchema = {
  body: [
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('deprecated')
      .optional()
      .isBoolean()
      .withMessage('Deprecated must be a boolean'),
    body('currentSchema')
      .optional()
      .isObject()
      .withMessage('Current schema must be an object'),
  ],
};

export const createNotificationValidation: ValidationSchema = {
  body: [
    body('type')
      .isIn(Object.values(NotificationType))
      .withMessage('Type must be a valid notification type'),
    body('config')
      .isObject()
      .withMessage('Config is required and must be an object'),
    body('config.webhookUrl')
      .optional()
      .custom((value: string) => {
        if (value && !value.match(/^https?:\/\/.+/)) {
          throw new Error('Webhook URL must be a valid HTTP/HTTPS URL');
        }
        return true;
      }),
    body('config.fromEmail')
      .optional()
      .isEmail()
      .withMessage('From email must be a valid email address'),
    body('config.toEmails')
      .optional()
      .isArray()
      .withMessage('To emails must be an array'),
    body('config.toEmails.*')
      .optional()
      .isEmail()
      .withMessage('Each to email must be a valid email address'),
    body('config.channel')
      .optional()
      .isString()
      .withMessage('Channel must be a string'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('filters.severities')
      .optional()
      .isArray()
      .withMessage('Severities must be an array'),
  ],
};

export const updateNotificationValidation: ValidationSchema = {
  body: [
    body('type')
      .optional()
      .isIn(Object.values(NotificationType))
      .withMessage('Type must be a valid notification type'),
    body('config')
      .optional()
      .isObject()
      .withMessage('Config must be an object'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
  ],
};

export const createApiKeyValidation: ValidationSchema = {
  body: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('projectId')
      .optional()
      .isMongoId()
      .withMessage('Project ID must be a valid MongoDB ObjectId'),
    body('teamId')
      .optional()
      .isMongoId()
      .withMessage('Team ID must be a valid MongoDB ObjectId'),
    body('permissions')
      .optional()
      .isObject()
      .withMessage('Permissions must be an object'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expires at must be a valid ISO 8601 date'),
  ],
};

export const schemaSubmissionValidation: ValidationSchema = {
  body: [
    body('endpointId')
      .notEmpty()
      .withMessage('Endpoint ID is required')
      .isMongoId()
      .withMessage('Endpoint ID must be a valid MongoDB ObjectId'),
    body('schema')
      .isObject()
      .withMessage('Schema is required and must be an object'),
    body('requestSchema')
      .optional()
      .isObject()
      .withMessage('Request schema must be an object'),
    body('responseSchema')
      .optional()
      .isObject()
      .withMessage('Response schema must be an object'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
    body('metadata.size')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Size must be a positive integer'),
    body('metadata.fieldCount')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Field count must be a positive integer'),
    body('metadata.depth')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Depth must be at least 1'),
  ],
};

export const paginationValidation: ValidationSchema = {
  query: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('sort')
      .optional()
      .isString()
      .withMessage('Sort must be a string'),
    query('order')
      .optional()
      .isIn(['asc', 'desc', 'ASC', 'DESC'])
      .withMessage('Order must be asc or desc'),
  ],
};

export const idParamValidation: ValidationSchema = {
  params: [
    param('id')
      .isMongoId()
      .withMessage('ID must be a valid MongoDB ObjectId'),
  ],
};

export const projectIdParamValidation: ValidationSchema = {
  params: [
    param('projectId')
      .isMongoId()
      .withMessage('Project ID must be a valid MongoDB ObjectId'),
  ],
};

export const teamIdParamValidation: ValidationSchema = {
  params: [
    param('teamId')
      .isMongoId()
      .withMessage('Team ID must be a valid MongoDB ObjectId'),
  ],
};

export const endpointIdParamValidation: ValidationSchema = {
  params: [
    param('endpointId')
      .isMongoId()
      .withMessage('Endpoint ID must be a valid MongoDB ObjectId'),
  ],
};

export const searchValidation: ValidationSchema = {
  query: [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('filter')
      .optional()
      .isString()
      .withMessage('Filter must be a string'),
  ],
};

export const filterValidation: ValidationSchema = {
  query: [
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'breaking'])
      .withMessage('Severity must be low, medium, or breaking'),
    query('status')
      .optional()
      .isIn(['active', 'resolved', 'all'])
      .withMessage('Status must be active, resolved, or all'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
};

export const mongodbIdValidation = (field: string) =>
  body(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);

export const emailValidation = (field: string = 'email') =>
  body(field)
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail();

export const urlValidation = (field: string) =>
  body(field)
    .optional()
    .isURL()
    .withMessage(`${field} must be a valid URL`);

export const dateRangeValidation: ValidationSchema = {
  query: [
    query('from')
      .optional()
      .isISO8601()
      .withMessage('From must be a valid ISO 8601 date'),
    query('to')
      .optional()
      .isISO8601()
      .withMessage('To must be a valid ISO 8601 date')
      .custom((to: string, { req }) => {
        const from = req.query.from;
        if (from && new Date(to) < new Date(from as string)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
  ],
};