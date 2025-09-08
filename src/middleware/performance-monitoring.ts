import { Request, Response, NextFunction } from 'express';
import { StructuredLogger } from '../structured-logger';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: string;
  correlationId?: string;
}

export class PerformanceMonitor {
  private logger: StructuredLogger;
  private metrics: PerformanceMetrics[] = [];

  constructor() {
    this.logger = new StructuredLogger('performance-monitor');
  }

  /**
   * Express middleware for monitoring request performance
   */
  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    const correlationId = req.headers['x-correlation-id'] as string;

    // Store original end function
    const originalEnd = res.end;

    const monitor = this;
    
    // Override end function to capture metrics
    res.end = function(...args: any[]) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      const metrics: PerformanceMetrics = {
        endpoint: req.route?.path || req.path,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
        correlationId
      };

      // Log performance metrics
      monitor.logger.info('Request performance metrics', 'performance', {
        ...metrics,
        userAgent: req.headers['user-agent'],
        contentLength: res.get('content-length')
      });

      // Store metrics for analysis
      monitor.metrics.push(metrics);

      // Alert on slow requests (>5 seconds)
      if (duration > 5000) {
        monitor.logger.warn('Slow request detected', 'performance', {
          ...metrics,
          threshold: '5000ms'
        });
      }

      // Call original end function with proper typing
      return originalEnd.apply(this, args as any);
    };

    next();
  };

  /**
   * Get performance statistics for analysis
   */
  public getStats(): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: PerformanceMetrics[];
    endpointStats: Record<string, {
      count: number;
      avgDuration: number;
      maxDuration: number;
    }>;
  } {
    const slowRequests = this.metrics.filter(m => m.duration > 1000);
    
    const endpointStats: Record<string, {
      count: number;
      avgDuration: number;
      maxDuration: number;
    }> = {};

    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { count: 0, avgDuration: 0, maxDuration: 0 };
      }
      
      endpointStats[key].count++;
      endpointStats[key].maxDuration = Math.max(endpointStats[key].maxDuration, metric.duration);
    });

    // Calculate averages
    Object.keys(endpointStats).forEach(key => {
      const relevantMetrics = this.metrics.filter(m => `${m.method} ${m.endpoint}` === key);
      const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
      if (endpointStats[key]) {
        endpointStats[key].avgDuration = totalDuration / relevantMetrics.length;
      }
    });

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = this.metrics.length > 0 ? totalDuration / this.metrics.length : 0;

    return {
      totalRequests: this.metrics.length,
      averageResponseTime,
      slowRequests,
      endpointStats
    };
  }

  /**
   * Clear metrics (useful for testing or periodic cleanup)
   */
  public clearMetrics(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();
