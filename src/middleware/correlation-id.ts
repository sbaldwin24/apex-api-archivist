/**
 * Correlation ID Middleware
 * Assigns unique IDs to requests for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Header name for correlation ID
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || generateCorrelationId();
}

/**
 * Correlation ID middleware
 * Extracts or generates correlation ID for request tracking
 */
export function correlationIdMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Try to get correlation ID from header first
  let correlationId = req.get(CORRELATION_ID_HEADER);
  
  // If not present, generate a new one
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }
  
  // Attach to request object
  req.correlationId = correlationId;
  
  // Set response header
  res.set(CORRELATION_ID_HEADER, correlationId);
  
  next();
}
