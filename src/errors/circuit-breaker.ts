/**
 * Circuit Breaker Pattern Implementation
 * Protects against cascading failures when calling external services
 */

import { EventEmitter } from 'events';
import { StructuredLogger } from '../structured-logger';
import { ExternalServiceError, ServiceUnavailableError, TimeoutError } from './error-classes';

const logger = new StructuredLogger('circuit-breaker');

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, rejecting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  successThreshold: number;     // Number of successes to close from half-open
  timeout: number;              // Timeout in milliseconds
  resetTimeout: number;         // Time to wait before trying half-open
  monitoringPeriod: number;     // Time window for failure counting
  expectedErrors?: string[];    // Error types that should trigger the circuit
  name?: string;                // Circuit breaker name for logging
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  requestCount: number;
  successCount: number;
  failureCount: number;
  errorRate: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChanges: number;
  uptime: number;
}

/**
 * Circuit breaker execution result
 */
export interface ExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
  fromCache?: boolean;
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 10000,          // 10 seconds
  resetTimeout: 30000,     // 30 seconds
  monitoringPeriod: 60000, // 1 minute
  expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'TIMEOUT'],
  name: 'unnamed'
};

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private stateChanges: number = 0;
  private createdAt: Date = new Date();
  
  // Metrics tracking
  private requestCount: number = 0;
  private totalResponseTime: number = 0;
  private recentRequests: Array<{ success: boolean; timestamp: Date; responseTime: number }> = [];
  
  // Timers
  private resetTimer?: NodeJS.Timeout;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    logger.info('Circuit breaker created', 'circuit-breaker', {
      name: this.config.name,
      config: this.config
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Check if circuit is open
      if (this.state === CircuitBreakerState.OPEN) {
        if (!this.canAttemptRequest()) {
          const error = new ServiceUnavailableError(
            `Circuit breaker is OPEN for ${this.config.name}`,
            Math.ceil((this.nextAttemptTime!.getTime() - Date.now()) / 1000),
            { circuitBreaker: this.config.name },
            correlationId
          );
          
          await this.recordFailure(Date.now() - startTime, error);
          throw error;
        }
        
        // Try transitioning to half-open
        this.state = CircuitBreakerState.HALF_OPEN;
        this.emit('stateChange', {
          from: CircuitBreakerState.OPEN,
          to: CircuitBreakerState.HALF_OPEN,
          timestamp: new Date(),
          name: this.config.name
        });
        this.stateChanges++;
        
        logger.info('Circuit breaker transitioning to HALF_OPEN', 'circuit-breaker', {
          name: this.config.name,
          correlationId
        });
      }

      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn);
      const executionTime = Date.now() - startTime;
      
      await this.recordSuccess(executionTime);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      await this.recordFailure(executionTime, error as Error);
      throw error;
    }
  }

  /**
   * Execute function with timeout protection
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${this.config.timeout}ms`,
          this.config.timeout,
          this.config.name
        ));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record successful execution
   */
  private async recordSuccess(executionTime: number): Promise<void> {
    this.requestCount++;
    this.totalResponseTime += executionTime;
    this.lastSuccessTime = new Date();
    
    this.addRecentRequest(true, executionTime);
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        
        this.emit('stateChange', {
          from: CircuitBreakerState.HALF_OPEN,
          to: CircuitBreakerState.CLOSED,
          timestamp: new Date(),
          name: this.config.name
        });
        this.stateChanges++;
        
        logger.info('Circuit breaker closed - service recovered', 'circuit-breaker', {
          name: this.config.name,
          successCount: this.successCount
        });
      }
    }
    
    this.emit('success', {
      executionTime,
      timestamp: new Date(),
      state: this.state,
      name: this.config.name
    });
  }

  /**
   * Record failed execution
   */
  private async recordFailure(executionTime: number, error: Error): Promise<void> {
    this.requestCount++;
    this.totalResponseTime += executionTime;
    this.lastFailureTime = new Date();
    
    this.addRecentRequest(false, executionTime);
    
    // Check if this is an expected error that should trigger the circuit
    const isExpectedError = this.isExpectedError(error);
    
    if (isExpectedError) {
      this.failureCount++;
      
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // Single failure in half-open state opens the circuit
        await this.openCircuit();
      } else if (this.state === CircuitBreakerState.CLOSED && 
                 this.failureCount >= this.config.failureThreshold) {
        // Too many failures in closed state opens the circuit
        await this.openCircuit();
      }
    }
    
    this.emit('failure', {
      error,
      executionTime,
      timestamp: new Date(),
      state: this.state,
      failureCount: this.failureCount,
      name: this.config.name,
      isExpectedError
    });
  }

  /**
   * Open the circuit breaker
   */
  private async openCircuit(): Promise<void> {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    this.successCount = 0;
    
    // Set timer to attempt reset
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        logger.info('Circuit breaker reset timeout reached', 'circuit-breaker', {
          name: this.config.name
        });
      }
    }, this.config.resetTimeout);
    
    this.emit('stateChange', {
      from: previousState,
      to: CircuitBreakerState.OPEN,
      timestamp: new Date(),
      name: this.config.name
    });
    this.stateChanges++;
    
    logger.warn('Circuit breaker opened', 'circuit-breaker', {
      name: this.config.name,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      resetTime: this.nextAttemptTime
    });
  }

  /**
   * Check if this error type should trigger circuit breaker
   */
  private isExpectedError(error: Error): boolean {
    if (!this.config.expectedErrors) return true;
    
    return this.config.expectedErrors.some(expectedError => 
      error.name.includes(expectedError) || 
      error.message.includes(expectedError) ||
      (error as any).code === expectedError
    );
  }

  /**
   * Check if we can attempt a request when circuit is open
   */
  private canAttemptRequest(): boolean {
    if (!this.nextAttemptTime) return true;
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Add request to recent requests tracking
   */
  private addRecentRequest(success: boolean, responseTime: number): void {
    const now = new Date();
    this.recentRequests.push({ success, timestamp: now, responseTime });
    
    // Clean old requests outside monitoring period
    const cutoff = new Date(now.getTime() - this.config.monitoringPeriod);
    this.recentRequests = this.recentRequests.filter(req => req.timestamp >= cutoff);
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const now = new Date();
    const recentFailures = this.recentRequests.filter(req => !req.success).length;
    const recentRequests = this.recentRequests.length;
    
    return {
      requestCount: this.requestCount,
      successCount: this.requestCount - this.getTotalFailureCount(),
      failureCount: this.getTotalFailureCount(),
      errorRate: recentRequests > 0 ? (recentFailures / recentRequests) * 100 : 0,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChanges: this.stateChanges,
      uptime: now.getTime() - this.createdAt.getTime()
    };
  }

  /**
   * Get total failure count
   */
  private getTotalFailureCount(): number {
    return this.recentRequests.filter(req => !req.success).length;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.config.name || 'unnamed';
  }

  /**
   * Force reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
    
    logger.info('Circuit breaker manually reset', 'circuit-breaker', {
      name: this.config.name
    });
    
    this.emit('reset', {
      timestamp: new Date(),
      name: this.config.name
    });
  }

  /**
   * Health check for circuit breaker
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
  } {
    const metrics = this.getMetrics();
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (this.state === CircuitBreakerState.OPEN) {
      status = 'unhealthy';
    } else if (this.state === CircuitBreakerState.HALF_OPEN || metrics.errorRate > 50) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    return {
      status,
      state: this.state,
      metrics
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
    
    this.removeAllListeners();
    
    logger.info('Circuit breaker cleaned up', 'circuit-breaker', {
      name: this.config.name
    });
  }
}

/**
 * Circuit breaker factory for creating commonly used circuit breakers
 */
export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker instance
   */
  static getCircuitBreaker(
    name: string, 
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const circuitBreaker = new CircuitBreaker({
      ...config,
      name
    });

    this.instances.set(name, circuitBreaker);
    return circuitBreaker;
  }

  /**
   * Get all circuit breaker instances
   */
  static getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.instances);
  }

  /**
   * Remove a circuit breaker instance
   */
  static removeCircuitBreaker(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.cleanup();
      return this.instances.delete(name);
    }
    return false;
  }

  /**
   * Cleanup all circuit breakers
   */
  static cleanup(): void {
    for (const [name, instance] of this.instances) {
      instance.cleanup();
    }
    this.instances.clear();
  }

  /**
   * Get health status of all circuit breakers
   */
  static getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreakers: Record<string, ReturnType<CircuitBreaker['healthCheck']>>;
  } {
    const circuitBreakers: Record<string, ReturnType<CircuitBreaker['healthCheck']>> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const [name, instance] of this.instances) {
      const health = instance.healthCheck();
      circuitBreakers[name] = health;

      switch (health.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
      }
    }

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      circuitBreakers
    };
  }
}
