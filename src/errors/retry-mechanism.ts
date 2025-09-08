/**
 * Retry Mechanism with Exponential Backoff
 * Provides intelligent retry logic for failed operations
 */

import { StructuredLogger } from '../structured-logger';
import { 
  BaseAPIError, 
  isOperationalError,
  TimeoutError,
  ExternalServiceError,
  ServiceUnavailableError,
  InternalServerError 
} from './error-classes';

const logger = new StructuredLogger('retry-mechanism');

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  maxAttempts: number;        // Maximum number of retry attempts
  baseDelayMs: number;        // Base delay between retries
  maxDelayMs: number;         // Maximum delay between retries
  backoffMultiplier: number;  // Exponential backoff multiplier
  jitterMax: number;          // Maximum jitter to add (0-1)
  retryableErrors: string[];  // Error codes that should trigger retry
  abortOnErrors: string[];    // Error codes that should abort retry
  timeoutMs?: number;         // Overall timeout for all attempts
  name?: string;              // Retry context name for logging
}

/**
 * Retry attempt result
 */
export interface RetryAttemptResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempt: number;
  totalAttempts: number;
  executionTime: number;
  totalExecutionTime: number;
  nextDelayMs?: number;
}

/**
 * Retry execution result
 */
export interface RetryExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  totalAttempts: number;
  totalExecutionTime: number;
  attempts: RetryAttemptResult<T>[];
  aborted: boolean;
  timedOut: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMax: 0.1,
  retryableErrors: [
    'TIMEOUT',
    'EXTERNAL_SERVICE_ERROR', 
    'SERVICE_UNAVAILABLE',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET'
  ],
  abortOnErrors: [
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'VALIDATION_ERROR',
    'BAD_REQUEST'
  ],
  name: 'unnamed'
};

/**
 * Retry Mechanism Implementation
 */
export class RetryMechanism {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    logger.info('Retry mechanism created', 'retry-mechanism', {
      name: this.config.name,
      config: this.config
    });
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    const startTime = Date.now();
    const attempts: RetryAttemptResult<T>[] = [];
    let lastError: Error | undefined;
    let aborted = false;
    let timedOut = false;

    // Set overall timeout if configured
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (this.config.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
      }, this.config.timeoutMs);
    }

    try {
      for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
        if (timedOut) {
          break;
        }

        const attemptStartTime = Date.now();

        try {
          logger.debug('Retry attempt starting', 'retry-mechanism', {
            name: this.config.name,
            attempt,
            maxAttempts: this.config.maxAttempts,
            correlationId
          });

          const result = await fn();
          const executionTime = Date.now() - attemptStartTime;
          const totalExecutionTime = Date.now() - startTime;

          // Success - record and return
          const attemptResult: RetryAttemptResult<T> = {
            success: true,
            result,
            attempt,
            totalAttempts: attempt,
            executionTime,
            totalExecutionTime
          };
          
          attempts.push(attemptResult);

          logger.info('Retry mechanism succeeded', 'retry-mechanism', {
            name: this.config.name,
            attempt,
            totalAttempts: attempt,
            executionTime,
            totalExecutionTime,
            correlationId
          });

          return result;

        } catch (error) {
          const executionTime = Date.now() - attemptStartTime;
          const totalExecutionTime = Date.now() - startTime;
          lastError = error as Error;

          // Check if we should abort retry
          const shouldAbort = this.shouldAbortRetry(lastError);
          if (shouldAbort) {
            aborted = true;
            
            logger.warn('Retry aborted due to non-retryable error', 'retry-mechanism', {
              name: this.config.name,
              attempt,
              errorType: lastError.name,
              errorCode: (lastError as BaseAPIError).errorCode,
              correlationId
            });
          }

          // Calculate next delay
          let nextDelayMs: number | undefined;
          if (attempt < this.config.maxAttempts && !shouldAbort && !timedOut) {
            nextDelayMs = this.calculateDelay(attempt);
          }

          const attemptResult: RetryAttemptResult<T> = {
            success: false,
            error: lastError,
            attempt,
            totalAttempts: this.config.maxAttempts,
            executionTime,
            totalExecutionTime,
            nextDelayMs
          };

          attempts.push(attemptResult);

          // Log the attempt failure
          logger.warn('Retry attempt failed', 'retry-mechanism', {
            name: this.config.name,
            attempt,
            maxAttempts: this.config.maxAttempts,
            errorType: lastError.name,
            errorMessage: lastError.message,
            executionTime,
            totalExecutionTime,
            nextDelayMs,
            shouldAbort,
            correlationId
          });

          // Break if we should abort or this was the last attempt
          if (shouldAbort || attempt === this.config.maxAttempts || timedOut) {
            break;
          }

          // Wait before next attempt
          if (nextDelayMs && nextDelayMs > 0) {
            await this.delay(nextDelayMs);
          }
        }
      }

      // All attempts failed
      const totalExecutionTime = Date.now() - startTime;
      
      const executionResult: RetryExecutionResult<T> = {
        success: false,
        error: lastError,
        totalAttempts: attempts.length,
        totalExecutionTime,
        attempts,
        aborted,
        timedOut
      };

      logger.error('Retry mechanism exhausted', 'retry-mechanism', {
        name: this.config.name,
        ...executionResult,
        correlationId
      });

      // Determine which error to throw
      if (timedOut) {
        throw new TimeoutError(
          `Retry mechanism timed out after ${this.config.timeoutMs}ms`,
          this.config.timeoutMs,
          this.config.name,
          { retryResult: executionResult },
          correlationId
        );
      }

      if (lastError) {
        // Add retry context to the original error if it's one of ours
        if (lastError instanceof BaseAPIError) {
          (lastError as any).context = {
            ...lastError.context,
            retryResult: executionResult
          };
        }
        throw lastError;
      }

      throw new InternalServerError(
        'Retry mechanism failed without specific error',
        { retryResult: executionResult },
        correlationId
      );

    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Check if error should abort retry attempts
   */
  private shouldAbortRetry(error: Error): boolean {
    // Check abort list first
    if (this.config.abortOnErrors.some(abortError => 
      error.name.includes(abortError) || 
      error.message.includes(abortError) ||
      (error as BaseAPIError).errorCode === abortError
    )) {
      return true;
    }

    // Check if it's a retryable error
    const isRetryable = this.config.retryableErrors.some(retryableError => 
      error.name.includes(retryableError) || 
      error.message.includes(retryableError) ||
      (error as BaseAPIError).errorCode === retryableError
    );

    // If it's explicitly retryable, don't abort
    if (isRetryable) {
      return false;
    }

    // For custom errors, only retry operational errors
    if (error instanceof BaseAPIError) {
      return !isOperationalError(error);
    }

    // For other errors, use a more conservative approach
    // Only retry known network/timeout errors
    const networkErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'];
    return !networkErrors.some(netError => 
      error.message.includes(netError) || error.name.includes(netError)
    );
  }

  /**
   * Calculate delay for next attempt using exponential backoff with jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    // Add jitter to avoid thundering herd
    const jitter = cappedDelay * this.config.jitterMax * Math.random();
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Retry configuration updated', 'retry-mechanism', {
      name: this.config.name,
      newConfig: this.config
    });
  }
}

/**
 * Utility function to create a retry mechanism with common configurations
 */
export function createRetryMechanism(
  name: string,
  config?: Partial<RetryConfig>
): RetryMechanism {
  return new RetryMechanism({
    ...config,
    name
  });
}

/**
 * Pre-configured retry mechanisms for common use cases
 */
export const retryMechanisms = {
  /**
   * Quick retry for fast operations
   */
  quick: createRetryMechanism('quick', {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 1.5
  }),

  /**
   * Standard retry for most operations
   */
  standard: createRetryMechanism('standard', {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  }),

  /**
   * Patient retry for slow/unreliable services
   */
  patient: createRetryMechanism('patient', {
    maxAttempts: 10,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 1.8,
    timeoutMs: 300000 // 5 minutes total
  }),

  /**
   * Network retry for network-related operations
   */
  network: createRetryMechanism('network', {
    maxAttempts: 7,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2.2,
    retryableErrors: [
      'TIMEOUT',
      'ECONNREFUSED',
      'ENOTFOUND', 
      'ETIMEDOUT',
      'ECONNRESET',
      'EHOSTUNREACH',
      'EXTERNAL_SERVICE_ERROR'
    ]
  }),

  /**
   * Database retry for database operations
   */
  database: createRetryMechanism('database', {
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'DATABASE_ERROR',
      'ECONNREFUSED',
      'CONNECTION_ERROR',
      'TIMEOUT'
    ],
    abortOnErrors: [
      'VALIDATION_ERROR',
      'CONSTRAINT_ERROR',
      'AUTHENTICATION_ERROR'
    ]
  })
};

/**
 * Decorator function for automatic retry
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  retryMechanism: RetryMechanism,
  correlationId?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retryMechanism.execute(
        () => originalMethod.apply(this, args),
        correlationId
      );
    };

    return descriptor;
  };
}

/**
 * Higher-order function for adding retry to any async function
 */
export function addRetry<T>(
  fn: () => Promise<T>,
  retryConfig?: Partial<RetryConfig>,
  correlationId?: string
): Promise<T> {
  const retryMechanism = new RetryMechanism(retryConfig);
  return retryMechanism.execute(fn, correlationId);
}
