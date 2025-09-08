import { StructuredLogger } from '../structured-logger';

export interface ErrorContext {
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  retryable?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors?: string[];
}

export class ErrorHandler {
  private logger: StructuredLogger;

  constructor(component: string) {
    this.logger = new StructuredLogger(component);
  }

  /**
   * Handle and log errors with context
   */
  handleError(error: Error | unknown, context: ErrorContext): Error {
    const errorObj = this.normalizeError(error);
    const severity = context.severity || this.determineSeverity(errorObj, context);
    
    this.logger.error(
      `${context.operation} failed in ${context.component}`,
      context.component,
      {
        error: errorObj.message,
        stack: errorObj.stack,
        retryable: context.retryable,
        severity,
        ...context.metadata
      }
    );

    // Enrich error with context
    const enrichedError = new Error(`${context.operation} failed: ${errorObj.message}`);
    enrichedError.stack = errorObj.stack;
    (enrichedError as any).context = context;
    (enrichedError as any).originalError = errorObj;

    return enrichedError;
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: RetryOptions = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2
    }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeError(error);
        
        const isRetryable = this.isRetryable(lastError, options.retryableErrors);
        const isLastAttempt = attempt === options.maxAttempts;
        
        if (!isRetryable || isLastAttempt) {
          throw this.handleError(lastError, {
            ...context,
            retryable: isRetryable,
            metadata: {
              ...context.metadata,
              attempts: attempt,
              finalAttempt: isLastAttempt
            }
          });
        }

        const delay = this.calculateDelay(attempt, options);
        
        this.logger.warn(
          `Attempt ${attempt} failed for ${context.operation}, retrying in ${delay}ms`,
          context.component,
          {
            error: lastError.message,
            attempt,
            maxAttempts: options.maxAttempts,
            delay
          }
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    failureThreshold = 5,
    recoveryTimeout = 60000
  ): Promise<T> {
    // Simple circuit breaker implementation
    const circuitKey = `${context.component}:${context.operation}`;
    const now = Date.now();
    
    // For now, just execute the operation (could be enhanced with actual circuit breaker state)
    try {
      return await operation();
    } catch (error) {
      throw this.handleError(error, {
        ...context,
        metadata: {
          ...context.metadata,
          circuitKey,
          timestamp: now
        }
      });
    }
  }

  /**
   * Normalize different error types to Error objects
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (typeof error === 'object' && error !== null) {
      const message = (error as any).message || JSON.stringify(error);
      return new Error(message);
    }
    
    return new Error('Unknown error occurred');
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // Database errors are usually high severity
    if (error.message.includes('ECONNREFUSED') || error.message.includes('database')) {
      return 'high';
    }
    
    // Network timeouts are medium severity
    if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      return 'medium';
    }
    
    // HTTP 5xx errors are high severity
    if (error.message.includes('HTTP 5')) {
      return 'high';
    }
    
    // HTTP 4xx errors are medium severity
    if (error.message.includes('HTTP 4')) {
      return 'medium';
    }
    
    // Schema or validation errors are critical
    if (context.operation.includes('schema') || context.operation.includes('validation')) {
      return 'critical';
    }
    
    return 'medium';
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error, retryableErrors?: string[]): boolean {
    const defaultRetryableErrors = [
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'HTTP 5',
      'ETIMEDOUT',
      'socket hang up'
    ];
    
    const errorPatterns = retryableErrors || defaultRetryableErrors;
    
    return errorPatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = Math.min(
      options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
      options.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error handler for specific component
   */
  static forComponent(component: string): ErrorHandler {
    return new ErrorHandler(component);
  }

  /**
   * Global unhandled error handler
   */
  static setupGlobalHandlers(): void {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const handler = ErrorHandler.forComponent('global');
      handler.handleError(reason, {
        operation: 'unhandled_rejection',
        component: 'global',
        severity: 'critical',
        metadata: {
          promise: promise.toString()
        }
      });
      
      // Exit gracefully
      process.exit(1);
    });

    process.on('uncaughtException', (error: Error) => {
      const handler = ErrorHandler.forComponent('global');
      handler.handleError(error, {
        operation: 'uncaught_exception',
        component: 'global',
        severity: 'critical'
      });
      
      // Exit gracefully
      process.exit(1);
    });
  }
}

export default ErrorHandler;
