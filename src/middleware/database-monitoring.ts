import { Pool, PoolClient } from 'pg';
import { StructuredLogger } from '../structured-logger';

interface QueryMetrics {
  sql: string;
  duration: number;
  rowCount: number;
  timestamp: string;
  correlationId?: string;
}

interface SlowQueryAlert {
  sql: string;
  duration: number;
  threshold: number;
  timestamp: string;
  stackTrace?: string;
}

export class DatabaseMonitor {
  private logger: StructuredLogger;
  private metrics: QueryMetrics[] = [];
  private slowQueryThreshold: number = 1000; // 1 second default
  private maxMetricsHistory: number = 10000;

  constructor(slowQueryThreshold: number = 1000) {
    this.logger = new StructuredLogger('database-monitor');
    this.slowQueryThreshold = slowQueryThreshold;
  }

  /**
   * Wrap a database pool to add monitoring
   */
  public wrapPool(originalPool: Pool): Pool {
    const originalQuery = originalPool.query.bind(originalPool);
    const self = this;

    // Override the query method to add monitoring
    (originalPool as any).query = function(text: any, params?: any, callback?: any) {
      const startTime = process.hrtime.bigint();
      const correlationId = self.getCorrelationId();

      // Handle different query signatures
      if (typeof params === 'function') {
        callback = params;
        params = undefined;
      }

      const onQueryComplete = (err: any, result: any) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        const sql = typeof text === 'string' ? text : text.text;
        const rowCount = result?.rowCount || 0;

        // Record metrics
        const metrics: QueryMetrics = {
          sql: self.sanitizeSql(sql),
          duration,
          rowCount,
          timestamp: new Date().toISOString(),
          correlationId
        };

        self.recordMetrics(metrics);

        // Check for slow queries
        if (duration > self.slowQueryThreshold) {
          self.handleSlowQuery(sql, duration, correlationId);
        }

        // Log query performance
        self.logger.debug('Database query executed', 'database', {
          sql: self.sanitizeSql(sql),
          duration,
          rowCount,
          correlationId,
          params: self.sanitizeParams(params)
        });

        return callback ? callback(err, result) : result;
      };

      // Execute original query with monitoring
      if (callback) {
        return originalQuery(text, params, onQueryComplete);
      } else {
        const queryPromise = originalQuery(text, params);
        
        if (queryPromise && typeof queryPromise.then === 'function') {
          return queryPromise
            .then((result: any) => {
              onQueryComplete(null, result);
              return result;
            })
            .catch((err: any) => {
              onQueryComplete(err, null);
              throw err;
            });
        }

        return queryPromise;
      }
    };

    return originalPool;
  }

  /**
   * Wrap a database client to add monitoring
   */
  public wrapClient(originalClient: PoolClient): PoolClient {
    const originalQuery = originalClient.query.bind(originalClient);
    const self = this;

    (originalClient as any).query = function(text: any, params?: any, callback?: any) {
      const startTime = process.hrtime.bigint();
      const correlationId = self.getCorrelationId();

      if (typeof params === 'function') {
        callback = params;
        params = undefined;
      }

      const onQueryComplete = (err: any, result: any) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        
        const sql = typeof text === 'string' ? text : text.text;
        const rowCount = result?.rowCount || 0;

        const metrics: QueryMetrics = {
          sql: self.sanitizeSql(sql),
          duration,
          rowCount,
          timestamp: new Date().toISOString(),
          correlationId
        };

        self.recordMetrics(metrics);

        if (duration > self.slowQueryThreshold) {
          self.handleSlowQuery(sql, duration, correlationId);
        }

        self.logger.debug('Database query executed', 'database', {
          sql: self.sanitizeSql(sql),
          duration,
          rowCount,
          correlationId,
          client: 'pooled'
        });

        return callback ? callback(err, result) : result;
      };

      if (callback) {
        return originalQuery(text, params, onQueryComplete);
      } else {
        const queryPromise = originalQuery(text, params);
        
        if (queryPromise && typeof queryPromise.then === 'function') {
          return queryPromise
            .then((result: any) => {
              onQueryComplete(null, result);
              return result;
            })
            .catch((err: any) => {
              onQueryComplete(err, null);
              throw err;
            });
        }

        return queryPromise;
      }
    };

    return originalClient;
  }

  /**
   * Record query metrics
   */
  private recordMetrics(metrics: QueryMetrics): void {
    this.metrics.push(metrics);

    // Limit metrics history to prevent memory issues
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Handle slow query detection
   */
  private handleSlowQuery(sql: string, duration: number, correlationId?: string): void {
    const alert: SlowQueryAlert = {
      sql: this.sanitizeSql(sql),
      duration,
      threshold: this.slowQueryThreshold,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    };

    this.logger.warn('Slow query detected', 'database-performance', {
      ...alert,
      correlationId
    });

    // In production, you might want to send this to an alerting system
    // this.sendSlowQueryAlert(alert);
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    queriesByType: Record<string, number>;
    topSlowQueries: QueryMetrics[];
  } {
    const totalQueries = this.metrics.length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;
    const slowQueries = this.metrics.filter(m => m.duration > this.slowQueryThreshold).length;

    // Categorize queries by type
    const queriesByType: Record<string, number> = {};
    this.metrics.forEach(m => {
      const queryType = this.getQueryType(m.sql);
      queriesByType[queryType] = (queriesByType[queryType] || 0) + 1;
    });

    // Get top 10 slowest queries
    const topSlowQueries = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalQueries,
      averageDuration,
      slowQueries,
      queriesByType,
      topSlowQueries
    };
  }

  /**
   * Get query optimization suggestions
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.getPerformanceStats();

    // Check for high slow query ratio
    if (stats.slowQueries / stats.totalQueries > 0.1) {
      suggestions.push('High percentage of slow queries detected. Consider adding indexes or optimizing query patterns.');
    }

    // Check for high average duration
    if (stats.averageDuration > 500) {
      suggestions.push('Average query duration is high. Review database schema and query optimization.');
    }

    // Check for N+1 query patterns
    const selectQueries = this.metrics.filter(m => m.sql.toLowerCase().startsWith('select'));
    if (selectQueries.length > stats.totalQueries * 0.8) {
      suggestions.push('High ratio of SELECT queries may indicate N+1 query problems. Consider using DataLoaders or batch queries.');
    }

    // Check for frequent full table scans
    const potentialScans = this.metrics.filter(m => 
      m.sql.toLowerCase().includes('select') && 
      !m.sql.toLowerCase().includes('where') &&
      m.duration > 100
    );

    if (potentialScans.length > 0) {
      suggestions.push('Potential full table scans detected. Add WHERE clauses and indexes for better performance.');
    }

    return suggestions;
  }

  /**
   * Clear metrics (useful for testing or periodic cleanup)
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Sanitize SQL for logging (remove sensitive data)
   */
  private sanitizeSql(sql: string): string {
    if (!sql) return '';
    
    // Remove potential sensitive data patterns
    return sql
      .replace(/('.*?')/g, '?')  // Replace string literals
      .replace(/(\$\d+)/g, '?')  // Replace parameter placeholders
      .trim();
  }

  /**
   * Sanitize query parameters for logging
   */
  private sanitizeParams(params: any): any {
    if (!params) return null;
    
    // For arrays of parameters, show count and types
    if (Array.isArray(params)) {
      return {
        count: params.length,
        types: params.map(p => typeof p)
      };
    }
    
    return { type: typeof params };
  }

  /**
   * Get correlation ID from async context (if available)
   */
  private getCorrelationId(): string | undefined {
    // This would typically come from request context
    // For now, generate a simple ID
    return `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine query type from SQL
   */
  private getQueryType(sql: string): string {
    if (!sql) return 'unknown';
    
    const normalized = sql.toLowerCase().trim();
    
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    if (normalized.startsWith('create')) return 'CREATE';
    if (normalized.startsWith('drop')) return 'DROP';
    if (normalized.startsWith('alter')) return 'ALTER';
    if (normalized.startsWith('begin') || normalized.startsWith('commit') || normalized.startsWith('rollback')) {
      return 'TRANSACTION';
    }
    
    return 'OTHER';
  }
}

export const databaseMonitor = new DatabaseMonitor();
