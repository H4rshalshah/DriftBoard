import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { AppError } from './errorHandler';

export interface ValidationSchema {
  body?: ValidationChain[];
  params?: ValidationChain[];
  query?: ValidationChain[];
}

export const validate = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body: bodyValidators, params: paramValidators, query: queryValidators } = schema;

      if (bodyValidators) {
        await Promise.all(bodyValidators.map((chain) => chain.run(req.body)));
      }

      if (paramValidators) {
        await Promise.all(paramValidators.map((chain) => chain.run(req.params)));
      }

      if (queryValidators) {
        await Promise.all(queryValidators.map((chain) => chain.run(req.query)));
      }

      const errors = validationResult(req);

      if (errors.isEmpty()) {
        next();
        return;
      }

      const formattedErrors = errors.array().map((err) => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
        type: err.type,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: formattedErrors,
      });
    } catch (error) {
      next(error);
    }
  };
};

export const validateRequest = (...validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await Promise.all(validations.map((validation) => validation.run(req)));

      const errors = validationResult(req);

      if (errors.isEmpty()) {
        next();
        return;
      }

      const formattedErrors = errors.array().map((err) => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
        type: err.type,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: formattedErrors,
      });
    } catch (error) {
      next(error);
    }
  };
};

export const validateParam = (paramName: string, ...validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await Promise.all(validations.map((validation) => validation.run(req.params)));

      const errors = validationResult(req);

      if (errors.isEmpty()) {
        next();
        return;
      }

      const formattedErrors = errors.array().map((err) => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
        type: err.type,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: formattedErrors,
      });
    } catch (error) {
      next(error);
    }
  };
};

export const validateQuery = (...validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await Promise.all(validations.map((validation) => validation.run(req.query)));

      const errors = validationResult(req);

      if (errors.isEmpty()) {
        next();
        return;
      }

      const formattedErrors = errors.array().map((err) => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
        type: err.type,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: formattedErrors,
      });
    } catch (error) {
      next(error);
    }
  };
};

export const checkRequired = (fields: string[], source: 'body' | 'params' | 'query' = 'body') => {
  return fields.map((field) =>
    body(field)
      .exists({ values: [null, undefined, ''] })
      .withMessage(`${field} is required`)
      .bail()
      .notEmpty()
      .withMessage(`${field} cannot be empty`)
  );
};

export const checkOptional = (fields: string[], source: 'body' | 'params' | 'query' = 'body') => {
  return fields.map((field) =>
    body(field)
      .optional()
      .custom((value) => {
        if (value === undefined || value === null || value === '') return true;
        return true;
      })
  );
};