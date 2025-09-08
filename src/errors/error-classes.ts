/**
 * Custom Error Classes
 * Standardized error types for the NASCAR Data API
 */

/**
 * Base API Error Class
 * All custom errors extend from this base class
 */
export abstract class BaseAPIError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;
  
  public readonly timestamp: string;
  public readonly correlationId?: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.correlationId = correlationId;

    // Ensure proper stack trace in V8
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.context && { context: this.context })
      }
    };
  }

  /**
   * Convert error to log format
   */
  toLogFormat(): Record<string, any> {
    return {
      errorType: this.name,
      errorCode: this.errorCode,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      context: this.context,
      stack: this.stack
    };
  }
}

// ============================================================================
// CLIENT ERROR CLASSES (4xx)
// ============================================================================

/**
 * Bad Request Error (400)
 * Used for malformed requests, invalid parameters, etc.
 */
export class BadRequestError extends BaseAPIError {
  readonly statusCode = 400;
  readonly errorCode = 'BAD_REQUEST';
  readonly isOperational = true;

  constructor(message: string = 'Bad Request', context?: Record<string, any>, correlationId?: string) {
    super(message, context, correlationId);
  }
}

/**
 * Validation Error (400)
 * Used for input validation failures
 */
export class ValidationError extends BaseAPIError {
  readonly statusCode = 400;
  readonly errorCode = 'VALIDATION_ERROR';
  readonly isOperational = true;

  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string = 'Validation failed',
    validationErrors: Array<{ field: string; message: string; value?: any }> = [],
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.validationErrors = validationErrors;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        validationErrors: this.validationErrors,
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * Authentication Error (401)
 * Used for missing or invalid authentication
 */
export class AuthenticationError extends BaseAPIError {
  readonly statusCode = 401;
  readonly errorCode = 'AUTHENTICATION_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', context?: Record<string, any>, correlationId?: string) {
    super(message, context, correlationId);
  }
}

/**
 * Authorization Error (403)
 * Used for insufficient permissions
 */
export class AuthorizationError extends BaseAPIError {
  readonly statusCode = 403;
  readonly errorCode = 'AUTHORIZATION_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>, correlationId?: string) {
    super(message, context, correlationId);
  }
}

/**
 * Not Found Error (404)
 * Used when requested resources don't exist
 */
export class NotFoundError extends BaseAPIError {
  readonly statusCode = 404;
  readonly errorCode = 'NOT_FOUND';
  readonly isOperational = true;

  public readonly resource?: string;

  constructor(
    message: string = 'Resource not found',
    resource?: string,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.resource = resource;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.resource && { resource: this.resource }),
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * Conflict Error (409)
 * Used for resource conflicts (e.g., duplicate resources)
 */
export class ConflictError extends BaseAPIError {
  readonly statusCode = 409;
  readonly errorCode = 'CONFLICT';
  readonly isOperational = true;

  constructor(message: string = 'Resource conflict', context?: Record<string, any>, correlationId?: string) {
    super(message, context, correlationId);
  }
}

/**
 * Rate Limit Error (429)
 * Used when rate limits are exceeded
 */
export class RateLimitError extends BaseAPIError {
  readonly statusCode = 429;
  readonly errorCode = 'RATE_LIMIT_EXCEEDED';
  readonly isOperational = true;

  public readonly retryAfter?: number;
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly resetTime?: Date;

  constructor(
    message: string = 'Rate limit exceeded',
    rateLimitInfo?: {
      retryAfter?: number;
      limit?: number;
      remaining?: number;
      resetTime?: Date;
    },
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.retryAfter = rateLimitInfo?.retryAfter;
    this.limit = rateLimitInfo?.limit;
    this.remaining = rateLimitInfo?.remaining;
    this.resetTime = rateLimitInfo?.resetTime;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        rateLimit: {
          ...(this.retryAfter && { retryAfter: this.retryAfter }),
          ...(this.limit && { limit: this.limit }),
          ...(this.remaining !== undefined && { remaining: this.remaining }),
          ...(this.resetTime && { resetTime: this.resetTime.toISOString() })
        },
        ...(this.context && { context: this.context })
      }
    };
  }
}

// ============================================================================
// SERVER ERROR CLASSES (5xx)
// ============================================================================

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
export class InternalServerError extends BaseAPIError {
  readonly statusCode = 500;
  readonly errorCode = 'INTERNAL_SERVER_ERROR';
  readonly isOperational = false;

  constructor(message: string = 'Internal server error', context?: Record<string, any>, correlationId?: string) {
    super(message, context, correlationId);
  }
}

/**
 * Database Error (500)
 * Used for database-related errors
 */
export class DatabaseError extends BaseAPIError {
  readonly statusCode = 500;
  readonly errorCode = 'DATABASE_ERROR';
  readonly isOperational = true;

  public readonly operation?: string;
  public readonly table?: string;

  constructor(
    message: string = 'Database error occurred',
    operation?: string,
    table?: string,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.operation = operation;
    this.table = table;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.operation && { operation: this.operation }),
        ...(this.table && { table: this.table }),
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * External Service Error (502)
 * Used for errors from external services
 */
export class ExternalServiceError extends BaseAPIError {
  readonly statusCode = 502;
  readonly errorCode = 'EXTERNAL_SERVICE_ERROR';
  readonly isOperational = true;

  public readonly service?: string;
  public readonly externalStatusCode?: number;

  constructor(
    message: string = 'External service error',
    service?: string,
    externalStatusCode?: number,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.service = service;
    this.externalStatusCode = externalStatusCode;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.service && { service: this.service }),
        ...(this.externalStatusCode && { externalStatusCode: this.externalStatusCode }),
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * Service Unavailable Error (503)
 * Used when service is temporarily unavailable
 */
export class ServiceUnavailableError extends BaseAPIError {
  readonly statusCode = 503;
  readonly errorCode = 'SERVICE_UNAVAILABLE';
  readonly isOperational = true;

  public readonly retryAfter?: number;

  constructor(
    message: string = 'Service temporarily unavailable',
    retryAfter?: number,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.retryAfter = retryAfter;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.retryAfter && { retryAfter: this.retryAfter }),
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * Gateway Timeout Error (504)
 * Used for timeout errors
 */
export class TimeoutError extends BaseAPIError {
  readonly statusCode = 504;
  readonly errorCode = 'TIMEOUT';
  readonly isOperational = true;

  public readonly timeoutMs?: number;
  public readonly operation?: string;

  constructor(
    message: string = 'Request timeout',
    timeoutMs?: number,
    operation?: string,
    context?: Record<string, any>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }

  override toJSON(): Record<string, any> {
    return {
      error: {
        type: this.name,
        code: this.errorCode,
        message: this.message,
        timestamp: this.timestamp,
        correlationId: this.correlationId,
        ...(this.timeoutMs && { timeoutMs: this.timeoutMs }),
        ...(this.operation && { operation: this.operation }),
        ...(this.context && { context: this.context })
      }
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error is an operational error (expected and recoverable)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseAPIError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Create an appropriate error from a generic error
 */
export function createErrorFromGeneric(
  error: Error,
  correlationId?: string,
  context?: Record<string, any>
): BaseAPIError {
  // If it's already one of our custom errors, return as-is
  if (error instanceof BaseAPIError) {
    return error;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, [], context, correlationId);
  }

  if (error.name === 'CastError' || error.name === 'SyntaxError') {
    return new BadRequestError(error.message, context, correlationId);
  }

  if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
    return new TimeoutError(error.message, undefined, undefined, context, correlationId);
  }

  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
    return new ExternalServiceError(error.message, undefined, undefined, context, correlationId);
  }

  // Default to internal server error for unknown errors
  return new InternalServerError(
    'An unexpected error occurred',
    { originalError: error.message, ...context },
    correlationId
  );
}

/**
 * Error type guard functions
 */
export const isValidationError = (error: any): error is ValidationError => 
  error instanceof ValidationError;

export const isAuthenticationError = (error: any): error is AuthenticationError => 
  error instanceof AuthenticationError;

export const isAuthorizationError = (error: any): error is AuthorizationError => 
  error instanceof AuthorizationError;

export const isNotFoundError = (error: any): error is NotFoundError => 
  error instanceof NotFoundError;

export const isRateLimitError = (error: any): error is RateLimitError => 
  error instanceof RateLimitError;

export const isDatabaseError = (error: any): error is DatabaseError => 
  error instanceof DatabaseError;

export const isTimeoutError = (error: any): error is TimeoutError => 
  error instanceof TimeoutError;
