/**
 * Database Seeder
 * Handles database seeding with test data, fixtures, and demo data
 */

import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { StructuredLogger } from '../structured-logger';

const logger = new StructuredLogger('database-seeder');

/**
 * Seeder interface
 */
export interface Seeder {
  name: string;
  description?: string;
  priority: number; // Lower numbers run first
  dependencies?: string[]; // List of seeder names this depends on
  environments: string[]; // Which environments this seeder should run in
  run: (client: PoolClient) => Promise<void>;
  rollback?: (client: PoolClient) => Promise<void>;
}

/**
 * Seeder execution result
 */
export interface SeederResult {
  name: string;
  success: boolean;
  executionTime: number;
  error?: string;
}

/**
 * Seeder status
 */
export interface SeederStatus {
  name: string;
  description: string;
  runAt: Date;
  environment: string;
}

/**
 * Database Seeder Class
 */
export class DatabaseSeeder {
  private pool: Pool;
  private seedersDir: string;
  private environment: string;
  private tableName = 'database_seeders';

  constructor(pool: Pool, seedersDir?: string, environment?: string) {
    this.pool = pool;
    this.seedersDir = seedersDir || path.join(process.cwd(), 'src/migrations/seeders');
    this.environment = environment || process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize seeder tracking table
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      /** Create seeders tracking table */
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          name VARCHAR(255) PRIMARY KEY,
          description TEXT,
          run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          environment VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      /** Create index for faster lookups */
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_environment 
        ON ${this.tableName} (environment);
      `);

      logger.info('Seeder tracking table initialized', 'database-seeder');
    } catch (error) {
      logger.error('Failed to initialize seeder tracking', 'database-seeder', {
        error: (error as Error).message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Load seeder files from directory
   */
  async loadSeeders(): Promise<Seeder[]> {
    try {
      /** Ensure seeders directory exists */
      await fs.mkdir(this.seedersDir, { recursive: true });
      
      const files = await fs.readdir(this.seedersDir);
      const seederFiles = files
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort(); // Basic sort - will be re-sorted by priority

      const seeders: Seeder[] = [];

      for (const file of seederFiles) {
        const seeder = await this.loadSeederFile(file);

        if (seeder) {
          seeders.push(seeder);
        }
      }

      /** Sort by priority and resolve dependencies */
      const sortedSeeders = this.resolveDependencies(seeders);

      logger.info('Loaded seeder files', 'database-seeder', {
        count: sortedSeeders.length,
        seeders: sortedSeeders.map(s => ({ name: s.name, priority: s.priority }))
      });

      return sortedSeeders;
    } catch (error) {
      logger.error('Failed to load seeders', 'database-seeder', {
        error: (error as Error).message,
        seedersDir: this.seedersDir
      });

      throw error;
    }
  }

  /**
   * Load individual seeder file
   */
  private async loadSeederFile(filename: string): Promise<Seeder | null> {
    const fullPath = path.join(this.seedersDir, filename);
    
    try {
      /** Dynamic import for JS/TS files */
      const module = await import(fullPath);
      const seeder = module.default || module.seeder || module;
      
      if (!seeder.name || !seeder.run) {
        logger.warn('Invalid seeder module', 'database-seeder', {
          filename,
          hasName: !!seeder.name,
          hasRun: !!seeder.run
        });

        return null;
      }
      
      /** Set defaults */
      return {
        priority: 100,
        environments: ['development', 'testing'],
        dependencies: [],
        ...seeder
      };
      
    } catch (error) {
      logger.error('Failed to load seeder file', 'database-seeder', {
        filename,
        error: (error as Error).message
      });

      return null;
    }
  }

  /**
   * Resolve seeder dependencies and sort by priority
   */
  private resolveDependencies(seeders: Seeder[]): Seeder[] {
    const seederMap = new Map(seeders.map(s => [s.name, s]));
    const resolved: Seeder[] = [];
    const resolving = new Set<string>();
    const visited = new Set<string>();

    const resolve = (seederName: string): void => {
      if (visited.has(seederName)) return;
      
      if (resolving.has(seederName)) {
        throw new Error(`Circular dependency detected involving seeder: ${seederName}`);
      }
      
      const seeder = seederMap.get(seederName);

      if (!seeder) {
        throw new Error(`Seeder dependency not found: ${seederName}`);
      }
      
      resolving.add(seederName);
      
      /** Resolve dependencies first */
      if (seeder.dependencies) {
        for (const dep of seeder.dependencies) {
          resolve(dep);
        }
      }
      
      resolving.delete(seederName);
      visited.add(seederName);
      resolved.push(seeder);
    };

    /** Resolve all seeders */
    for (const seeder of seeders) {
      resolve(seeder.name);
    }

    /** Sort by priority (lower priority numbers run first) */
    return resolved.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get list of run seeders for current environment
   */
  async getRunSeeders(): Promise<SeederStatus[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT name, description, run_at, environment
        FROM ${this.tableName}
        WHERE environment = $1
        ORDER BY run_at ASC
      `, [this.environment]);
      
      return result.rows.map(row => ({
        name: row.name,
        description: row.description || '',
        runAt: row.run_at,
        environment: row.environment
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get pending seeders for current environment
   */
  async getPendingSeeders(): Promise<Seeder[]> {
    const allSeeders = await this.loadSeeders();
    const runSeeders = await this.getRunSeeders();
    const runNames = new Set(runSeeders.map(s => s.name));
    
    return allSeeders.filter(seeder => 
      seeder.environments.includes(this.environment) && 
      !runNames.has(seeder.name)
    );
  }

  /**
   * Run a single seeder
   */
  async runSeeder(seeder: Seeder): Promise<SeederResult> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      await client.query('BEGIN');
      
      /** Execute seeder */
      await seeder.run(client);
      
      /** Record seeder execution */
      await client.query(`
        INSERT INTO ${this.tableName} (name, description, environment)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET
          run_at = NOW(),
          description = EXCLUDED.description,
          environment = EXCLUDED.environment
      `, [seeder.name, seeder.description || '', this.environment]);
      
      await client.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Seeder completed successfully', 'database-seeder', {
        name: seeder.name,
        environment: this.environment,
        executionTime
      });
      
      return {
        name: seeder.name,
        success: true,
        executionTime
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      logger.error('Seeder failed', 'database-seeder', {
        name: seeder.name,
        environment: this.environment,
        error: errorMessage,
        executionTime
      });
      
      return {
        name: seeder.name,
        success: false,
        executionTime,
        error: errorMessage
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending seeders
   */
  async seed(): Promise<SeederResult[]> {
    await this.initialize();
    
    const pendingSeeders = await this.getPendingSeeders();
    
    if (pendingSeeders.length === 0) {
      logger.info('No pending seeders', 'database-seeder', {
        environment: this.environment
      });
      return [];
    }
    
    logger.info('Running pending seeders', 'database-seeder', {
      count: pendingSeeders.length,
      environment: this.environment,
      seeders: pendingSeeders.map(s => ({ name: s.name, priority: s.priority }))
    });
    
    const results: SeederResult[] = [];
    
    for (const seeder of pendingSeeders) {
      const result = await this.runSeeder(seeder);
      results.push(result);
      
      if (!result.success) {
        logger.error('Seeder failed, stopping execution', 'database-seeder', {
          failedSeeder: seeder.name
        });
        break;
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    logger.info('Seeding batch completed', 'database-seeder', {
      environment: this.environment,
      total: results.length,
      successful: successCount,
      failed: failureCount
    });
    
    return results;
  }

  /**
   * Rollback seeders (if rollback method exists)
   */
  async rollbackSeeders(seederNames?: string[]): Promise<SeederResult[]> {
    const allSeeders = await this.loadSeeders();
    const runSeeders = await this.getRunSeeders();
    
    let seedersToRollback: Seeder[];
    
    if (seederNames) {
      /** Rollback specific seeders */
      seedersToRollback = allSeeders.filter(s => seederNames.includes(s.name));
    } else {
      /** Rollback all run seeders (in reverse order) */
      const runSeederNames = runSeeders.map(s => s.name);
      seedersToRollback = allSeeders
        .filter(s => runSeederNames.includes(s.name))
        .reverse(); // Reverse dependency order
    }
    
    if (seedersToRollback.length === 0) {
      logger.info('No seeders to rollback', 'database-seeder');

      return [];
    }
    
    logger.info('Rolling back seeders', 'database-seeder', {
      count: seedersToRollback.length,
      seeders: seedersToRollback.map(s => s.name)
    });
    
    const results: SeederResult[] = [];
    
    for (const seeder of seedersToRollback) {
      if (!seeder.rollback) {
        logger.warn('Seeder has no rollback method', 'database-seeder', {
          name: seeder.name
        });
        continue;
      }
      
      const result = await this.rollbackSeeder(seeder);
      results.push(result);
      
      if (!result.success) {
        logger.error('Seeder rollback failed, stopping execution', 'database-seeder', {
          failedSeeder: seeder.name
        });

        break;
      }
    }
    
    return results;
  }

  /**
   * Rollback a single seeder
   */
  private async rollbackSeeder(seeder: Seeder): Promise<SeederResult> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      await client.query('BEGIN');
      
      if (seeder.rollback) {
        await seeder.rollback(client);
      }
      
      /** Remove seeder record */
      await client.query(`
        DELETE FROM ${this.tableName} 
        WHERE name = $1 AND environment = $2
      `, [seeder.name, this.environment]);
      
      await client.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Seeder rollback completed', 'database-seeder', {
        name: seeder.name,
        environment: this.environment,
        executionTime
      });
      
      return {
        name: seeder.name,
        success: true,
        executionTime
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      logger.error('Seeder rollback failed', 'database-seeder', {
        name: seeder.name,
        environment: this.environment,
        error: errorMessage,
        executionTime
      });
      
      return {
        name: seeder.name,
        success: false,
        executionTime,
        error: errorMessage
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Get seeder status
   */
  async getStatus(): Promise<{
    environment: string;
    run: SeederStatus[];
    pending: Seeder[];
    total: number;
  }> {
    const run = await this.getRunSeeders();
    const pending = await this.getPendingSeeders();
    
    return {
      environment: this.environment,
      run,
      pending,
      total: run.length + pending.length
    };
  }

  /**
   * Reset all seeders for current environment
   */
  async reset(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        DELETE FROM ${this.tableName} WHERE environment = $1
      `, [this.environment]);
      
      logger.info('Seeder records reset', 'database-seeder', {
        environment: this.environment
      });
      
    } finally {
      client.release();
    }
  }
}
