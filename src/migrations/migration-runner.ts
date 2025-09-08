/**
 * Database Migration Runner
 * Handles database schema versioning, migrations, and rollbacks
 */

import fs from 'fs/promises';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { StructuredLogger } from '../structured-logger';

const logger = new StructuredLogger('migration-runner');

/**
 * Migration interface
 */
export interface Migration {
  id: string;
  name: string;
  timestamp: Date;
  up: string;
  down: string;
  checksum?: string;
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  id: string;
  name: string;
  success: boolean;
  executionTime: number;
  error?: string;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  id: string;
  name: string;
  appliedAt: Date;
  checksum: string;
  executionTime: number;
}

/**
 * Migration Runner Class
 */
export class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;
  private tableName = 'schema_migrations';

  constructor(pool: Pool, migrationsDir?: string) {
    this.pool = pool;
    this.migrationsDir = migrationsDir || path.join(process.cwd(), 'src/migrations/files');
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create migrations tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL,
          execution_time INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create index for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_applied_at 
        ON ${this.tableName} (applied_at);
      `);

      logger.info('Migration tracking table initialized', 'migration-runner');
    } catch (error) {
      logger.error('Failed to initialize migration tracking', 'migration-runner', {
        error: (error as Error).message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Load migration files from directory
   */
  async loadMigrations(): Promise<Migration[]> {
    try {
      // Ensure migrations directory exists
      await fs.mkdir(this.migrationsDir, { recursive: true });
      
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.ts'))
        .sort(); // Sort to ensure proper order

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const migration = await this.loadMigrationFile(file);
        if (migration) {
          migrations.push(migration);
        }
      }

      logger.info('Loaded migration files', 'migration-runner', {
        count: migrations.length,
        files: migrations.map(m => m.name)
      });

      return migrations;
    } catch (error) {
      logger.error('Failed to load migrations', 'migration-runner', {
        error: (error as Error).message,
        migrationsDir: this.migrationsDir
      });
      throw error;
    }
  }

  /**
   * Load individual migration file
   */
  private async loadMigrationFile(filename: string): Promise<Migration | null> {
    const fullPath = path.join(this.migrationsDir, filename);
    
    try {
      if (filename.endsWith('.sql')) {
        // For SQL files, expect format: YYYYMMDDHHMMSS_migration_name.sql
        return await this.loadSQLMigration(fullPath, filename);
      } else if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        // For JS/TS files, expect exported migration object
        return await this.loadJSMigration(fullPath, filename);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to load migration file', 'migration-runner', {
        filename,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Load SQL migration file
   */
  private async loadSQLMigration(fullPath: string, filename: string): Promise<Migration> {
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Parse migration ID and name from filename
    const match = filename.match(/^(\d{14})_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename format: ${filename}`);
    }
    
    const [, id, name] = match;
    if (!id || !name) {
      throw new Error(`Invalid migration filename format: ${filename}`);
    }
    
    const timestamp = new Date(
      Number(id.substring(0, 4)),  // year
      Number(id.substring(4, 6)) - 1,  // month (0-indexed)
      Number(id.substring(6, 8)),  // day
      Number(id.substring(8, 10)),  // hour
      Number(id.substring(10, 12)),  // minute
      Number(id.substring(12, 14))   // second
    );

    // Split content into UP and DOWN sections
    const sections = this.parseSQLSections(content);
    
    return {
      id,
      name: name.replace(/_/g, ' '),
      timestamp,
      up: sections.up,
      down: sections.down,
      checksum: this.generateChecksum(content)
    };
  }

  /**
   * Load JavaScript/TypeScript migration file
   */
  private async loadJSMigration(fullPath: string, filename: string): Promise<Migration> {
    // Dynamic import for JS/TS files
    const module = await import(fullPath);
    const migration = module.default || module;
    
    if (!migration.id || !migration.up) {
      throw new Error(`Invalid migration module: ${filename}`);
    }
    
    return {
      id: migration.id,
      name: migration.name || filename,
      timestamp: migration.timestamp || new Date(),
      up: migration.up,
      down: migration.down || '',
      checksum: this.generateChecksum(JSON.stringify(migration))
    };
  }

  /**
   * Parse SQL file sections (UP/DOWN)
   */
  private parseSQLSections(content: string): { up: string; down: string } {
    const lines = content.split('\n');
    let currentSection = '';
    let upSQL = '';
    let downSQL = '';
    
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.startsWith('-- +migrate up') || trimmed.startsWith('-- migrate:up')) {
        currentSection = 'up';
        continue;
      } else if (trimmed.startsWith('-- +migrate down') || trimmed.startsWith('-- migrate:down')) {
        currentSection = 'down';
        continue;
      }
      
      if (currentSection === 'up') {
        upSQL += line + '\n';
      } else if (currentSection === 'down') {
        downSQL += line + '\n';
      } else if (!currentSection && !trimmed.startsWith('--')) {
        // If no sections defined, assume entire file is UP
        upSQL += line + '\n';
      }
    }
    
    return {
      up: upSQL.trim(),
      down: downSQL.trim()
    };
  }

  /**
   * Generate checksum for migration content
   */
  private generateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationStatus[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, name, applied_at, checksum, execution_time
        FROM ${this.tableName}
        ORDER BY applied_at ASC
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        appliedAt: row.applied_at,
        checksum: row.checksum,
        executionTime: row.execution_time
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    return allMigrations.filter(migration => !appliedIds.has(migration.id));
  }

  /**
   * Run a single migration
   */
  async runMigration(migration: Migration, direction: 'up' | 'down' = 'up'): Promise<MigrationResult> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      await client.query('BEGIN');
      
      const sql = direction === 'up' ? migration.up : migration.down;
      if (!sql.trim()) {
        throw new Error(`No ${direction} migration defined`);
      }
      
      // Execute migration SQL
      await client.query(sql);
      
      // Update migration tracking
      if (direction === 'up') {
        await client.query(`
          INSERT INTO ${this.tableName} (id, name, checksum, execution_time)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            applied_at = NOW(),
            checksum = EXCLUDED.checksum,
            execution_time = EXCLUDED.execution_time,
            updated_at = NOW()
        `, [migration.id, migration.name, migration.checksum, Date.now() - startTime]);
      } else {
        await client.query(`
          DELETE FROM ${this.tableName} WHERE id = $1
        `, [migration.id]);
      }
      
      await client.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      
      logger.info(`Migration ${direction} completed`, 'migration-runner', {
        id: migration.id,
        name: migration.name,
        direction,
        executionTime
      });
      
      return {
        id: migration.id,
        name: migration.name,
        success: true,
        executionTime
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      logger.error(`Migration ${direction} failed`, 'migration-runner', {
        id: migration.id,
        name: migration.name,
        direction,
        error: errorMessage,
        executionTime
      });
      
      return {
        id: migration.id,
        name: migration.name,
        success: false,
        executionTime,
        error: errorMessage
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    await this.initialize();
    
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations', 'migration-runner');
      return [];
    }
    
    logger.info('Running pending migrations', 'migration-runner', {
      count: pendingMigrations.length,
      migrations: pendingMigrations.map(m => ({ id: m.id, name: m.name }))
    });
    
    const results: MigrationResult[] = [];
    
    for (const migration of pendingMigrations) {
      const result = await this.runMigration(migration, 'up');
      results.push(result);
      
      if (!result.success) {
        logger.error('Migration failed, stopping execution', 'migration-runner', {
          failedMigration: migration.id
        });
        break;
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    logger.info('Migration batch completed', 'migration-runner', {
      total: results.length,
      successful: successCount,
      failed: failureCount
    });
    
    return results;
  }

  /**
   * Rollback last N migrations
   */
  async rollback(count: number = 1): Promise<MigrationResult[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationsToRollback = appliedMigrations
      .slice(-count)  // Get last N migrations
      .reverse();     // Rollback in reverse order
    
    if (migrationsToRollback.length === 0) {
      logger.info('No migrations to rollback', 'migration-runner');
      return [];
    }
    
    logger.info('Rolling back migrations', 'migration-runner', {
      count: migrationsToRollback.length,
      migrations: migrationsToRollback.map(m => ({ id: m.id, name: m.name }))
    });
    
    const allMigrations = await this.loadMigrations();
    const results: MigrationResult[] = [];
    
    for (const appliedMigration of migrationsToRollback) {
      const migration = allMigrations.find(m => m.id === appliedMigration.id);
      
      if (!migration) {
        logger.error('Migration file not found for rollback', 'migration-runner', {
          id: appliedMigration.id
        });
        continue;
      }
      
      const result = await this.runMigration(migration, 'down');
      results.push(result);
      
      if (!result.success) {
        logger.error('Rollback failed, stopping execution', 'migration-runner', {
          failedMigration: migration.id
        });
        break;
      }
    }
    
    return results;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: MigrationStatus[];
    pending: Migration[];
    total: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      applied,
      pending,
      total: applied.length + pending.length
    };
  }

  /**
   * Validate migration checksums
   */
  async validateChecksums(): Promise<{
    valid: boolean;
    issues: Array<{ id: string; issue: string }>;
  }> {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = await this.loadMigrations();
    const issues: Array<{ id: string; issue: string }> = [];
    
    for (const applied of appliedMigrations) {
      const migration = allMigrations.find(m => m.id === applied.id);
      
      if (!migration) {
        issues.push({
          id: applied.id,
          issue: 'Migration file not found'
        });
        continue;
      }
      
      if (migration.checksum !== applied.checksum) {
        issues.push({
          id: applied.id,
          issue: 'Checksum mismatch - migration file has been modified'
        });
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}
