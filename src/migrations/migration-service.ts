/**
 * Migration Service
 * Integrates database migrations and seeding into the application lifecycle
 */

import { Pool } from 'pg';
import { MigrationRunner } from './migration-runner';
import { DatabaseSeeder } from './database-seeder';
import { StructuredLogger } from '../structured-logger';

const logger = new StructuredLogger('migration-service');

export interface MigrationServiceConfig {
  pool: Pool;
  autoMigrate?: boolean;
  autoSeed?: boolean;
  environment?: string;
  migrationsDir?: string;
  seedersDir?: string;
}

/**
 * Migration Service Class
 * Provides high-level API for migration and seeding operations
 */
export class MigrationService {
  private migrationRunner: MigrationRunner;
  private databaseSeeder: DatabaseSeeder;
  private config: Required<MigrationServiceConfig>;

  constructor(config: MigrationServiceConfig) {
    this.config = {
      autoMigrate: false,
      autoSeed: false,
      environment: process.env.NODE_ENV || 'development',
      migrationsDir: './migrations',
      seedersDir: './seeders',
      ...config
    };

    this.migrationRunner = new MigrationRunner(
      this.config.pool,
      this.config.migrationsDir
    );

    this.databaseSeeder = new DatabaseSeeder(
      this.config.pool,
      this.config.seedersDir,
      this.config.environment
    );
  }

  /**
   * Initialize the migration service
   * Called during application startup
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing migration service', 'migration-service', {
        environment: this.config.environment,
        autoMigrate: this.config.autoMigrate,
        autoSeed: this.config.autoSeed
      });

      // Initialize migration and seeder tracking tables
      await this.migrationRunner.initialize();
      await this.databaseSeeder.initialize();

      // Auto-migrate if enabled
      if (this.config.autoMigrate) {
        await this.runMigrations();
      }

      // Auto-seed if enabled
      if (this.config.autoSeed) {
        await this.runSeeders();
      }

      logger.info('Migration service initialized successfully', 'migration-service');

    } catch (error) {
      logger.error('Failed to initialize migration service', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations', 'migration-service');
      
      const results = await this.migrationRunner.migrate();
      
      if (results.length === 0) {
        logger.info('No pending migrations to run', 'migration-service');
        return;
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info('Migration batch completed', 'migration-service', {
        total: results.length,
        successful,
        failed,
        migrations: results.map(r => ({
          id: r.id,
          name: r.name,
          success: r.success,
          executionTime: r.executionTime,
          error: r.error
        }))
      });

      if (failed > 0) {
        throw new Error(`${failed} migrations failed`);
      }

    } catch (error) {
      logger.error('Migration execution failed', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Run pending seeders
   */
  async runSeeders(): Promise<void> {
    try {
      logger.info('Running database seeders', 'migration-service', {
        environment: this.config.environment
      });
      
      const results = await this.databaseSeeder.seed();
      
      if (results.length === 0) {
        logger.info('No pending seeders to run', 'migration-service');
        return;
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info('Seeding batch completed', 'migration-service', {
        environment: this.config.environment,
        total: results.length,
        successful,
        failed,
        seeders: results.map(r => ({
          name: r.name,
          success: r.success,
          executionTime: r.executionTime,
          error: r.error
        }))
      });

      if (failed > 0) {
        throw new Error(`${failed} seeders failed`);
      }

    } catch (error) {
      logger.error('Seeding execution failed', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    return await this.migrationRunner.getStatus();
  }

  /**
   * Get seeder status
   */
  async getSeederStatus() {
    return await this.databaseSeeder.getStatus();
  }

  /**
   * Validate migration checksums
   */
  async validateMigrations() {
    return await this.migrationRunner.validateChecksums();
  }

  /**
   * Get comprehensive database status
   */
  async getDatabaseStatus() {
    try {
      const [migrationStatus, seederStatus, validation] = await Promise.all([
        this.getMigrationStatus(),
        this.getSeederStatus(),
        this.validateMigrations()
      ]);

      return {
        environment: this.config.environment,
        migrations: {
          applied: migrationStatus.applied.length,
          pending: migrationStatus.pending.length,
          total: migrationStatus.total,
          valid: validation.valid,
          issues: validation.issues
        },
        seeders: {
          run: seederStatus.run.length,
          pending: seederStatus.pending.length,
          total: seederStatus.total
        },
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to get database status', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Rollback migrations
   */
  async rollbackMigrations(count: number = 1) {
    try {
      logger.info('Rolling back migrations', 'migration-service', { count });
      
      const results = await this.migrationRunner.rollback(count);
      
      logger.info('Migration rollback completed', 'migration-service', {
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          success: r.success,
          executionTime: r.executionTime,
          error: r.error
        }))
      });

      return results;

    } catch (error) {
      logger.error('Migration rollback failed', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Rollback seeders
   */
  async rollbackSeeders(seederNames?: string[]) {
    try {
      logger.info('Rolling back seeders', 'migration-service', {
        environment: this.config.environment,
        seeders: seederNames || 'all'
      });
      
      const results = await this.databaseSeeder.rollbackSeeders(seederNames);
      
      logger.info('Seeder rollback completed', 'migration-service', {
        environment: this.config.environment,
        count: results.length,
        results: results.map(r => ({
          name: r.name,
          success: r.success,
          executionTime: r.executionTime,
          error: r.error
        }))
      });

      return results;

    } catch (error) {
      logger.error('Seeder rollback failed', 'migration-service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Health check for migration service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      migrations: { valid: boolean; issues: number };
      database: { connected: boolean };
    };
  }> {
    try {
      // Test database connection
      const client = await this.config.pool.connect();
      client.release();
      
      // Validate migrations
      const validation = await this.validateMigrations();
      
      const isHealthy = validation.valid;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          migrations: {
            valid: validation.valid,
            issues: validation.issues.length
          },
          database: {
            connected: true
          }
        }
      };

    } catch (error) {
      logger.error('Migration service health check failed', 'migration-service', {
        error: (error as Error).message
      });
      
      return {
        status: 'unhealthy',
        details: {
          migrations: {
            valid: false,
            issues: -1
          },
          database: {
            connected: false
          }
        }
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up migration service', 'migration-service');
    // The pool cleanup should be handled by the application
    // This method is for future cleanup logic if needed
  }
}
