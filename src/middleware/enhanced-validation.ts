/**
 * Enhanced Validation Middleware
 * Advanced input validation with detailed error reporting
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult, Result, ValidationError as ExpressValidationError } from 'express-validator';
import { z } from 'zod';
import { ValidationError } from '../errors/error-classes';
import { getCorrelationId } from './correlation-id';

/**
 * Validation options
 */
export interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  allowUnknown?: boolean;
  skipMissingProperties?: boolean;
}

/**
 * Validation field error
 */
export interface FieldError {
  field: string;
  message: string;
  value?: any;
  code?: string;
  location?: 'body' | 'query' | 'params' | 'headers';
}

/**
 * Express-validator middleware wrapper
 * Handles express-validator chains and converts errors to our format
 */
export function validateWith(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      // Get validation results
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const correlationId = getCorrelationId(req);
        
        // Convert express-validator errors to our format
        const fieldErrors: FieldError[] = errors.array().map((error: ExpressValidationError) => ({
          field: error.type === 'field' ? error.path : 'unknown',
          message: error.msg,
          value: error.type === 'field' ? error.value : undefined,
          location: (error as any).location as 'body' | 'query' | 'params' | 'headers'
        }));
        
        const validationError = new ValidationError(
          'Validation failed',
          fieldErrors,
          {
            totalErrors: fieldErrors.length,
            request: {
              method: req.method,
              url: req.originalUrl
            }
          },
          correlationId
        );
        
        return next(validationError);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Zod schema validation middleware
 * Validates request data against Zod schemas
 */
export function validateSchema(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}, options: ValidationOptions = {}) {
  const defaultOptions: ValidationOptions = {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
    skipMissingProperties: false,
    ...options
  };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: FieldError[] = [];
      
      // Validate each part of the request
      const locations = ['body', 'query', 'params', 'headers'] as const;
      
      for (const location of locations) {
        const schema = schemas[location];
        const data = req[location];
        
        if (schema && data) {
          const result = schema.safeParse(data);
          
          if (!result.success) {
            // Convert Zod validation errors
            const zodErrors = result.error.issues.map(issue => ({
              field: issue.path.join('.') || 'unknown',
              message: issue.message,
              value: issue.code === 'invalid_type' ? (issue as any).received : undefined,
              code: issue.code,
              location
            }));
            
            errors.push(...zodErrors);
          } else {
            // Update request with validated/sanitized data
            (req as any)[location] = result.data;
          }
        }
      }
      
      if (errors.length > 0) {
        const correlationId = getCorrelationId(req);
        
        const validationError = new ValidationError(
          'Schema validation failed',
          errors,
          {
            totalErrors: errors.length,
            request: {
              method: req.method,
              url: req.originalUrl
            }
          },
          correlationId
        );
        
        return next(validationError);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid(),
  optionalUuid: z.string().uuid().optional(),
  
  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).optional()
  }),
  
  // Sorting
  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  }),
  
  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear()).optional()
  }).refine((data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: "End date must be after start date",
    path: ["endDate"],
  }),
  
  // User tier validation
  userTier: z.enum(['free', 'pro', 'enterprise']),
  
  // API key validation
  apiKey: z.string().regex(/^ak_[a-zA-Z0-9_]+$/),
  
  // Email validation
  email: z.string().email().toLowerCase(),
  
  // Password validation
  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  
  // Username validation  
  username: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  
  // Search query validation
  searchQuery: z.string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9\s\-.]+$/)
};

/**
 * Validation middleware factory functions
 */
export const validators = {
  /**
   * Validate pagination parameters
   */
  pagination: () => validateSchema({
    query: commonSchemas.pagination
  }),
  
  /**
   * Validate UUID parameter
   */
  uuidParam: (paramName: string = 'id') => validateSchema({
    params: z.object({
      [paramName]: commonSchemas.uuid
    })
  }),
  
  /**
   * Validate date range query
   */
  dateRange: () => validateSchema({
    query: commonSchemas.dateRange
  }),
  
  /**
   * Validate search parameters
   */
  search: () => validateSchema({
    query: z.object({
      q: commonSchemas.searchQuery.optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).default('asc')
    })
  }),
  
  /**
   * Validate user creation
   */
  createUser: () => validateSchema({
    body: z.object({
      email: commonSchemas.email,
      username: commonSchemas.username,
      password: commonSchemas.password,
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      tier: commonSchemas.userTier.optional().default('free')
    })
  }),
  
  /**
   * Validate user update
   */
  updateUser: () => validateSchema({
    body: z.object({
      email: commonSchemas.email.optional(),
      username: commonSchemas.username.optional(),
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      tier: commonSchemas.userTier.optional()
    })
  }),

  /**
   * Validate API key authentication
   */
  apiKeyAuth: () => validateSchema({
    headers: z.object({
      'x-api-key': commonSchemas.apiKey
    })
  })
};

/**
 * Sanitization helpers
 */
export const sanitizers = {
  /**
   * Trim and normalize strings
   */
  normalizeString: (value: any): string => {
    if (typeof value !== 'string') return value;
    return value.trim().replace(/\s+/g, ' ');
  },
  
  /**
   * Sanitize search query
   */
  sanitizeSearchQuery: (value: any): string => {
    if (typeof value !== 'string') return value;
    return value
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/[{}]/g, '')  // Remove potential injection chars
      .substring(0, 200);    // Limit length
  },
  
  /**
   * Sanitize email
   */
  sanitizeEmail: (value: any): string => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase().trim();
  }
};

/**
 * Custom validation middleware for complex business rules
 */
export function createCustomValidator<T = any>(
  validatorFn: (data: T, req: Request) => Promise<FieldError[]> | FieldError[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = await validatorFn(req.body, req);
      
      if (errors.length > 0) {
        const correlationId = getCorrelationId(req);
        
        const validationError = new ValidationError(
          'Custom validation failed',
          errors,
          {
            totalErrors: errors.length,
            request: {
              method: req.method,
              url: req.originalUrl
            }
          },
          correlationId
        );
        
        return next(validationError);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}
