/**
 * Global Error Handler Middleware
 * Centralized error handling for the Express application
 */

import { Request, Response, NextFunction } from 'express';
import { 
  BaseAPIError, 
  InternalServerError, 
  createErrorFromGeneric,
  isOperationalError 
} from './error-classes';
import { StructuredLogger } from '../structured-logger';
import { getCorrelationId } from '../middleware/correlation-id';

const logger = new StructuredLogger('error-handler');

/**
 * Error Handler Configuration
 */
export interface ErrorHandlerConfig {
  includeStackTrace?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  sensitiveHeaders?: string[];
  maxContextSize?: number;
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  includeStackTrace: process.env.NODE_ENV !== 'production',
  logLevel: 'error',
  sensitiveHeaders: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
  maxContextSize: 10240 // 10KB max context
};

/**
 * Sanitize request data for logging (remove sensitive information)
 */
function sanitizeRequest(req: Request, sensitiveHeaders: string[]): Record<string, any> {
  const headers = { ...req.headers };
  
  // Remove sensitive headers
  sensitiveHeaders.forEach(header => {
    if (headers[header.toLowerCase()]) {
      headers[header.toLowerCase()] = '[REDACTED]';
    }
  });

  return {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    params: req.params,
    headers,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  };
}

/**
 * Truncate context if it's too large
 */
function truncateContext(context: any, maxSize: number): any {
  const stringified = JSON.stringify(context);
  if (stringified.length <= maxSize) {
    return context;
  }

  return {
    ...context,
    _truncated: true,
    _originalSize: stringified.length,
    _maxSize: maxSize
  };
}

/**
 * Determine if error details should be exposed to client
 */
function shouldExposeError(error: BaseAPIError): boolean {
  // Always expose operational errors (they're expected)
  if (error.isOperational) {
    return true;
  }

  // In development, expose all errors
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, only expose operational errors
  return false;
}

/**
 * Create sanitized error response for client
 */
function createErrorResponse(error: BaseAPIError, includeStackTrace: boolean): Record<string, any> {
  const shouldExpose = shouldExposeError(error);
  
  if (!shouldExpose) {
    // Generic error response for non-operational errors in production
    return {
      error: {
        type: 'InternalServerError',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        correlationId: error.correlationId
      }
    };
  }

  const errorResponse = error.toJSON();
  
  // Add stack trace if configured and in development
  if (includeStackTrace && process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = error.stack;
  }

  return errorResponse;
}

/**
 * Set appropriate response headers for error
 */
function setErrorResponseHeaders(res: Response, error: BaseAPIError): void {
  // Set correlation ID header
  if (error.correlationId) {
    res.set('X-Correlation-ID', error.correlationId);
  }

  // Set cache control for errors
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // Set specific headers based on error type
  if (error.errorCode === 'RATE_LIMIT_EXCEEDED') {
    const rateLimitError = error as any;
    if (rateLimitError.retryAfter) {
      res.set('Retry-After', rateLimitError.retryAfter.toString());
    }
    if (rateLimitError.limit !== undefined) {
      res.set('X-RateLimit-Limit', rateLimitError.limit.toString());
    }
    if (rateLimitError.remaining !== undefined) {
      res.set('X-RateLimit-Remaining', rateLimitError.remaining.toString());
    }
    if (rateLimitError.resetTime) {
      res.set('X-RateLimit-Reset', Math.floor(rateLimitError.resetTime.getTime() / 1000).toString());
    }
  }

  if (error.errorCode === 'SERVICE_UNAVAILABLE') {
    const serviceError = error as any;
    if (serviceError.retryAfter) {
      res.set('Retry-After', serviceError.retryAfter.toString());
    }
  }
}

/**
 * Log error with appropriate level and context
 */
function logError(
  error: BaseAPIError, 
  req: Request, 
  config: ErrorHandlerConfig
): void {
  const correlationId = getCorrelationId(req);
  const requestContext = sanitizeRequest(req, config.sensitiveHeaders || []);
  
  const logContext = truncateContext({
    request: requestContext,
    error: error.toLogFormat(),
    correlationId
  }, config.maxContextSize || DEFAULT_CONFIG.maxContextSize!);

  // Determine log level
  let logLevel = config.logLevel || DEFAULT_CONFIG.logLevel!;
  
  // Override log level for specific error types
  if (error.statusCode >= 500) {
    logLevel = 'error';
  } else if (error.statusCode >= 400) {
    logLevel = 'warn';
  }

  // Log the error
  switch (logLevel) {
    case 'error':
      logger.error('Request error occurred', 'error-handler', logContext);
      break;
    case 'warn':
      logger.warn('Request warning occurred', 'error-handler', logContext);
      break;
    case 'info':
      logger.info('Request info occurred', 'error-handler', logContext);
      break;
  }
}

/**
 * Main Error Handler Middleware
 */
export function createErrorHandler(config: ErrorHandlerConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    const correlationId = getCorrelationId(req);
    
    // Convert generic errors to structured errors
    let structuredError: BaseAPIError;
    if (error instanceof BaseAPIError) {
      structuredError = error;
      // Add correlation ID if not present
      if (!structuredError.correlationId) {
        (structuredError as any).correlationId = correlationId;
      }
    } else {
      structuredError = createErrorFromGeneric(error, correlationId);
    }

    // Log the error
    logError(structuredError, req, finalConfig);

    // Set response headers
    setErrorResponseHeaders(res, structuredError);

    // Create and send error response
    const errorResponse = createErrorResponse(
      structuredError, 
      finalConfig.includeStackTrace || false
    );

    res.status(structuredError.statusCode).json(errorResponse);
  };
}

/**
 * Default error handler instance
 */
export const errorHandler = createErrorHandler();

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to the error handler
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found Handler (404)
 * Should be used as the last route handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const correlationId = getCorrelationId(req);
  const error = new (require('./error-classes').NotFoundError)(
    `Route not found: ${req.method} ${req.originalUrl}`,
    `${req.method} ${req.originalUrl}`,
    {
      method: req.method,
      path: req.originalUrl,
      query: req.query
    },
    correlationId
  );
  
  next(error);
}

/**
 * Unhandled Promise Rejection Handler
 */
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', 'error-handler', {
      reason: reason?.toString(),
      stack: reason?.stack,
      promise: promise.toString()
    });

    // In production, consider graceful shutdown
    if (process.env.NODE_ENV === 'production') {
      logger.error('Shutting down due to unhandled promise rejection', 'error-handler');
      process.exit(1);
    }
  });
}

/**
 * Uncaught Exception Handler
 */
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', 'error-handler', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    // Always exit on uncaught exceptions
    logger.error('Shutting down due to uncaught exception', 'error-handler');
    process.exit(1);
  });
}

/**
 * Initialize global error handling
 */
export function initializeErrorHandling(): void {
  handleUnhandledRejection();
  handleUncaughtException();
  
  logger.info('Global error handling initialized', 'error-handler');
}

/**
 * Health check for error handling system
 */
export function errorHandlerHealthCheck(): {
  status: 'healthy' | 'unhealthy';
  details: Record<string, any>;
} {
  try {
    // Basic functionality test
    const testError = new InternalServerError('Test error');
    const canSerialize = !!testError.toJSON();
    const canLog = !!testError.toLogFormat();
    
    return {
      status: canSerialize && canLog ? 'healthy' : 'unhealthy',
      details: {
        serialization: canSerialize,
        logging: canLog,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}
