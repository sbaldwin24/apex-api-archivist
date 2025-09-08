import { Pool, PoolConfig, QueryResult, PoolClient, QueryResultRow } from 'pg';
import { StructuredLogger } from '../structured-logger';
import { databaseMonitor } from '../middleware/database-monitoring';

export interface AdvancedPoolConfig {
  // Connection settings
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  
  // Pool settings
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  
  // Performance settings
  statement_timeout?: number;
  query_timeout?: number;
  application_name?: string;
  
  // Monitoring settings
  enableQueryLogging?: boolean;
  slowQueryThreshold?: number;
  enableHealthCheck?: boolean;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  useReadReplica?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingCount: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  uptime: number;
}

/**
 * Advanced PostgreSQL connection pool for NASCAR API
 * Provides intelligent connection management, query optimization,
 * read replica support, and comprehensive monitoring
 */
export class AdvancedPool {
  private primaryPool: Pool;
  private readReplicaPool?: Pool;
  private logger: StructuredLogger;
  private config: AdvancedPoolConfig;
  private stats: PoolStats;
  private startTime: number;

  constructor(config: AdvancedPoolConfig, readReplicaConfig?: AdvancedPoolConfig) {
    this.config = config;
    this.logger = new StructuredLogger('advanced-pool');
    this.startTime = Date.now();
    
    // Initialize statistics
    this.stats = {
      totalConnections: 0,
      idleConnections: 0,
      waitingCount: 0,
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      uptime: 0
    };

    this.primaryPool = this.createPool(config, 'primary');
    
    if (readReplicaConfig) {
      this.readReplicaPool = this.createPool(readReplicaConfig, 'read-replica');
    }

    this.setupPoolMonitoring();
    
    if (config.enableHealthCheck) {
      this.startHealthCheck();
    }
  }

  private createPool(config: AdvancedPoolConfig, type: 'primary' | 'read-replica'): Pool {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      
      // Pool configuration
      min: config.min || 5,
      max: config.max || 50,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      
      // PostgreSQL connection parameters
      statement_timeout: config.statement_timeout || 60000,
      query_timeout: config.query_timeout || 30000,
      application_name: config.application_name || `nascar-api-${type}`,
      
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      
      // Connection validation
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    // Wrap pool with monitoring
    const monitoredPool = databaseMonitor.wrapPool(pool);

    this.logger.info(`${type} pool created`, 'pool-creation', {
      host: config.host,
      database: config.database,
      minConnections: config.min || 5,
      maxConnections: config.max || 50
    });

    return monitoredPool;
  }

  private setupPoolMonitoring(): void {
    // Monitor primary pool
    this.primaryPool.on('connect', (client) => {
      this.stats.totalConnections++;
      this.logger.debug('Client connected to primary pool', 'connection', {
        totalConnections: this.primaryPool.totalCount,
        idleConnections: this.primaryPool.idleCount,
        waitingCount: this.primaryPool.waitingCount
      });
    });

    this.primaryPool.on('acquire', (client) => {
      this.logger.debug('Client acquired from primary pool', 'connection');
    });

    this.primaryPool.on('release', (client) => {
      this.logger.debug('Client released to primary pool', 'connection');
    });

    this.primaryPool.on('error', (err, client) => {
      this.logger.error('Pool error', 'pool-error', {
        error: err.message,
        stack: err.stack
      });
    });

    // Monitor read replica pool if exists
    if (this.readReplicaPool) {
      this.readReplicaPool.on('error', (err, client) => {
        this.logger.error('Read replica pool error', 'pool-error', {
          error: err.message,
          stack: err.stack
        });
      });
    }
  }

  /**
   * Execute a query with intelligent routing and monitoring
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = process.hrtime.bigint();
    const pool = this.selectPool(text, options);
    
    try {
      // Apply timeout if specified
      const queryTimeout = options.timeout || this.config.query_timeout || 30000;
      
      const result = await Promise.race([
        pool.query(text, params),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), queryTimeout)
        )
      ]);

      const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000;
      
      // Update statistics
      this.updateQueryStats(duration);
      
      // Log slow queries
      if (this.config.enableQueryLogging && duration > (this.config.slowQueryThreshold || 1000)) {
        this.logger.warn('Slow query detected', 'slow-query', {
          duration,
          query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          rowCount: result.rowCount
        });
        this.stats.slowQueries++;
      }

      return result as QueryResult<T>;
    } catch (error) {
      this.logger.error('Query execution failed', 'query-error', {
        query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        error: (error as Error).message,
        retries: options.retries || 0
      });

      // Retry logic for specific errors
      if (options.retries && options.retries > 0 && this.shouldRetry(error as Error)) {
        this.logger.info('Retrying query', 'query-retry', {
          remainingRetries: options.retries - 1
        });
        
        return this.query(text, params, { ...options, retries: options.retries - 1 });
      }

      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async connect(options: QueryOptions = {}): Promise<PoolClient> {
    const pool = this.selectPool('SELECT 1', options); // Default to primary for transactions
    return pool.connect();
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const client = await this.connect(options);
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      this.logger.debug('Transaction committed successfully', 'transaction');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      
      this.logger.error('Transaction rolled back', 'transaction', {
        error: (error as Error).message
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * NASCAR-specific optimized queries
   */
  async getRaceResults(raceId: string, useCache = true): Promise<any[]> {
    const query = `
      SELECT 
        rr.*,
        d.first_name || ' ' || d.last_name as driver_name,
        t.name as team_name,
        tr.name as track_name
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      JOIN teams t ON rr.team_id = t.id
      JOIN events e ON rr.event_id = e.id
      JOIN tracks tr ON e.track_id = tr.id
      WHERE e.id = $1
      ORDER BY rr.finish_position
    `;

    return (await this.query(query, [raceId], { useReadReplica: true })).rows;
  }

  async getDriverStandings(year: number, seriesId: string = 'nascar_cup_series'): Promise<any[]> {
    const query = `
      SELECT 
        d.id as driver_id,
        d.first_name || ' ' || d.last_name as driver_name,
        SUM(rr.points) as total_points,
        COUNT(rr.event_id) as races,
        COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
        COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
        COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
        AVG(rr.finish_position) as avg_finish
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      JOIN events e ON rr.event_id = e.id
      JOIN seasons s ON e.season_id = s.id
      WHERE s.year = $1 AND s.series_id = $2
      GROUP BY d.id, d.first_name, d.last_name
      ORDER BY total_points DESC, wins DESC
    `;

    return (await this.query(query, [year, seriesId], { useReadReplica: true })).rows;
  }

  async getTopPerformers(trackId: string, year?: number): Promise<any[]> {
    const query = `
      SELECT 
        d.first_name || ' ' || d.last_name as driver_name,
        COUNT(*) as races,
        AVG(rr.finish_position) as avg_finish,
        COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
        COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
        AVG(rr.driver_rating) as avg_rating
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      JOIN events e ON rr.event_id = e.id
      WHERE e.track_id = $1 
        AND ($2::int IS NULL OR EXTRACT(YEAR FROM e.event_date) = $2)
      GROUP BY d.id, d.first_name, d.last_name
      HAVING COUNT(*) >= 3
      ORDER BY avg_rating DESC NULLS LAST, avg_finish ASC
      LIMIT 20
    `;

    return (await this.query(query, [trackId, year], { useReadReplica: true })).rows;
  }

  /**
   * Bulk insert with automatic batching
   */
  async bulkInsert(
    tableName: string, 
    columns: string[], 
    data: any[][],
    batchSize: number = 1000
  ): Promise<void> {
    if (data.length === 0) return;

    const placeholderRows = columns.map((_, i) => `$${i + 1}`).join(', ');
    const baseQuery = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES `;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values: any[] = [];
      const valuePlaceholders: string[] = [];
      
      batch.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        row.forEach((value, colIndex) => {
          values.push(value);
          rowPlaceholders.push(`$${values.length}`);
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      });
      
      const query = baseQuery + valuePlaceholders.join(', ') + ' ON CONFLICT DO NOTHING';
      
      await this.query(query, values);
      
      this.logger.debug('Batch inserted', 'bulk-insert', {
        table: tableName,
        batchNumber: Math.floor(i / batchSize) + 1,
        recordsInBatch: batch.length
      });
    }
  }

  private selectPool(query: string, options: QueryOptions): Pool {
    // Route read queries to read replica if available and requested
    if (this.readReplicaPool && options.useReadReplica !== false) {
      const normalizedQuery = query.toLowerCase().trim();
      if (normalizedQuery.startsWith('select') || 
          normalizedQuery.startsWith('with') ||
          normalizedQuery.startsWith('explain')) {
        return this.readReplicaPool;
      }
    }
    
    return this.primaryPool;
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'connection terminated',
      'connection reset by peer',
      'connection timed out',
      'server closed the connection unexpectedly'
    ];
    
    return retryableErrors.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  private updateQueryStats(duration: number): void {
    this.stats.totalQueries++;
    
    // Update running average
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + duration) / 
      this.stats.totalQueries;
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        await this.primaryPool.query('SELECT 1');
        
        if (this.readReplicaPool) {
          await this.readReplicaPool.query('SELECT 1');
        }
        
        this.logger.debug('Pool health check passed', 'health-check');
      } catch (error) {
        this.logger.error('Pool health check failed', 'health-check', {
          error: (error as Error).message
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get comprehensive pool statistics
   */
  getPoolStats(): PoolStats {
    return {
      ...this.stats,
      totalConnections: this.primaryPool.totalCount,
      idleConnections: this.primaryPool.idleCount,
      waitingCount: this.primaryPool.waitingCount,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Force close all connections
   */
  async close(): Promise<void> {
    this.logger.info('Closing database pools', 'shutdown');
    
    await Promise.all([
      this.primaryPool.end(),
      this.readReplicaPool?.end()
    ]);
    
    this.logger.info('Database pools closed', 'shutdown');
  }
}

// Export factory function for easy configuration
export function createAdvancedPool(config: AdvancedPoolConfig, readReplicaConfig?: AdvancedPoolConfig): AdvancedPool {
  return new AdvancedPool(config, readReplicaConfig);
}

export default AdvancedPool;
