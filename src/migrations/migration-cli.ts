#!/usr/bin/env node

/**
 * Migration CLI Tool
 * Command-line interface for database migration management
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { StructuredLogger } from '../structured-logger';
import { MigrationRunner } from './migration-runner';

const logger = new StructuredLogger('migration-cli');

/** Database connection */
let pool: Pool;

/**
 * Initialize database connection
 */
async function initializeDatabase(): Promise<Pool> {
  if (pool) return pool;

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'apex_api',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
  };

  pool = new Pool(config);

  try {
    const client = await pool.connect();
    client.release();
    logger.info('Database connection established', 'migration-cli');
  } catch (error) {
    logger.error('Failed to connect to database', 'migration-cli', {
      error: (error as Error).message
    });
    process.exit(1);
  }

  return pool;
}

/**
 * Generate migration ID based on current timestamp
 */
function generateMigrationId(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
}

/**
 * Create a new migration file
 */
async function createMigration(name: string, options: { sql?: boolean; js?: boolean }): Promise<void> {
  const migrationsDir = path.join(process.cwd(), 'src/migrations/files');
  await fs.mkdir(migrationsDir, { recursive: true });

  const id = generateMigrationId();
  const fileName = `${id}_${name.toLowerCase().replace(/\s+/g, '_')}`;
  
  if (options.sql || !options.js) {
    // Create SQL migration file
    const sqlPath = path.join(migrationsDir, `${fileName}.sql`);
    const sqlTemplate = `-- +migrate Up
-- Create your UP migration here

-- +migrate Down  
-- Create your DOWN migration here (to rollback the above changes)
`;

    await fs.writeFile(sqlPath, sqlTemplate);
    console.log(`Created SQL migration: ${sqlPath}`);
  }

  if (options.js) {
    // Create JS/TS migration file
    const jsPath = path.join(migrationsDir, `${fileName}.ts`);
    const jsTemplate = `/**
 * Migration: ${name}
 * Generated: ${new Date().toISOString()}
 */

import { PoolClient } from 'pg';

export const migration = {
  id: '${id}',
  name: '${name}',
  timestamp: new Date('${new Date().toISOString()}'),

  async up(client: PoolClient): Promise<void> {
    // Add your UP migration logic here
    await client.query(\`
      -- Your SQL here
    \`);
  },

  async down(client: PoolClient): Promise<void> {
    // Add your DOWN migration logic here
    await client.query(\`
      -- Your rollback SQL here  
    \`);
  }
};

export default migration;
`;

    await fs.writeFile(jsPath, jsTemplate);
    console.log(`Created TypeScript migration: ${jsPath}`);
  }
}

/**
 * Run pending migrations
 */
async function runMigrations(options: { dry?: boolean; target?: string }): Promise<void> {
  const pool = await initializeDatabase();
  const runner = new MigrationRunner(pool);

  try {
    if (options.dry) {
      const status = await runner.getStatus();
      
      console.log('\n=== Migration Status ===');
      console.log(`Applied migrations: ${status.applied.length}`);
      console.log(`Pending migrations: ${status.pending.length}`);
      console.log(`Total migrations: ${status.total}`);
      
      if (status.pending.length > 0) {
        console.log('\nPending migrations:');
        status.pending.forEach(migration => {
          console.log(`  - ${migration.id}: ${migration.name}`);
        });
      }
      
      return;
    }

    const results = await runner.migrate();
    
    if (results.length === 0) {
      console.log('No pending migrations to run');
      return;
    }

    console.log('\n=== Migration Results ===');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.executionTime}ms`;
      console.log(`${status} ${result.id}: ${result.name} (${time})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\nCompleted: ${successful} successful, ${failed} failed`);

  } catch (error) {
    logger.error('Migration failed', 'migration-cli', {
      error: (error as Error).message
    });
    console.error('Migration failed:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Rollback migrations
 */
async function rollbackMigrations(count: number = 1, options: { dry?: boolean }): Promise<void> {
  const pool = await initializeDatabase();
  const runner = new MigrationRunner(pool);

  try {
    if (options.dry) {
      const applied = await runner.getAppliedMigrations();
      const toRollback = applied.slice(-count).reverse();
      
      console.log('\n=== Rollback Preview ===');
      console.log(`Migrations to rollback: ${toRollback.length}`);
      
      if (toRollback.length > 0) {
        console.log('\nMigrations that would be rolled back:');
        toRollback.forEach(migration => {
          console.log(`  - ${migration.id}: ${migration.name}`);
        });
      }
      
      return;
    }

    const results = await runner.rollback(count);
    
    if (results.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    console.log('\n=== Rollback Results ===');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.executionTime}ms`;
      console.log(`${status} ${result.id}: ${result.name} (${time})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

  } catch (error) {
    logger.error('Rollback failed', 'migration-cli', {
      error: (error as Error).message
    });

    console.error('Rollback failed:', (error as Error).message);

    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus(): Promise<void> {
  const pool = await initializeDatabase();
  const runner = new MigrationRunner(pool);

  try {
    const status = await runner.getStatus();
    const validation = await runner.validateChecksums();

    console.log('\n=== Migration Status ===');
    console.log(`Applied migrations: ${status.applied.length}`);
    console.log(`Pending migrations: ${status.pending.length}`);
    console.log(`Total migrations: ${status.total}`);
    console.log(`Checksums valid: ${validation.valid ? '✅' : '❌'}`);

    if (status.applied.length > 0) {
      console.log('\nApplied migrations:');
      status.applied.forEach(migration => {
        const date = migration.appliedAt.toISOString().split('T')[0];
        const time = `${migration.executionTime}ms`;
        
        console.log(`  ✅ ${migration.id}: ${migration.name} (${date}, ${time})`);
      });
    }

    if (status.pending.length > 0) {
      console.log('\nPending migrations:');

      status.pending.forEach(migration => {
        const date = migration.timestamp.toISOString().split('T')[0];
      
        console.log(`  📋 ${migration.id}: ${migration.name} (created ${date})`);
      });
    }

    if (!validation.valid) {
      console.log('\n❌ Checksum Issues:');

      validation.issues.forEach(issue => {
        console.log(`  - ${issue.id}: ${issue.issue}`);
      });
    }

  } catch (error) {
    logger.error('Status check failed', 'migration-cli', {
      error: (error as Error).message
    });
    console.error('Status check failed:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Reset database (rollback all migrations)
 */
async function resetDatabase(options: { confirm?: boolean }): Promise<void> {
  if (!options.confirm) {
    console.log('⚠️  This will rollback ALL migrations and reset the database!');
    console.log('Use --confirm flag to proceed: pnpm migrate:reset --confirm');
    return;
  }

  const pool = await initializeDatabase();
  const runner = new MigrationRunner(pool);

  try {
    const applied = await runner.getAppliedMigrations();
    
    if (applied.length === 0) {
      console.log('No migrations to rollback');
      
      return;
    }

    console.log(`Rolling back ${applied.length} migrations...`);
    const results = await runner.rollback(applied.length);

    console.log('\n=== Reset Results ===');

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.executionTime}ms`;

      console.log(`${status} ${result.id}: ${result.name} (${time})`);
    });

    const successful = results.filter(r => r.success).length;
    console.log(`\nDatabase reset complete: ${successful} migrations rolled back`);

  } catch (error) {
    logger.error('Database reset failed', 'migration-cli', {
      error: (error as Error).message
    });
    
    console.error('Database reset failed:', (error as Error).message);

    process.exit(1);
  }
}

// CLI Setup
const program = new Command();

program
  .name('migrate')
  .description('Database migration management CLI')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new migration file')
  .argument('<name>', 'Migration name')
  .option('--sql', 'Create SQL migration file')
  .option('--js', 'Create JavaScript/TypeScript migration file')
  .action(createMigration);

program
  .command('up')
  .description('Run pending migrations')
  .option('--dry', 'Show what migrations would run without executing them')
  .option('--target <id>', 'Run migrations up to specific migration ID')
  .action(runMigrations);

program
  .command('down')
  .description('Rollback migrations')
  .argument('[count]', 'Number of migrations to rollback', '1')
  .option('--dry', 'Show what migrations would be rolled back without executing them')
  .action((count, options) => rollbackMigrations(Number(count), options));

program
  .command('status')
  .description('Show migration status')
  .action(showStatus);

program
  .command('reset')
  .description('Reset database (rollback all migrations)')
  .option('--confirm', 'Confirm the reset operation')
  .action(resetDatabase);

// Handle cleanup on exit
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

/** Parse command line arguments */
program.parse();

/** Export for testing */
export { createMigration, resetDatabase, rollbackMigrations, runMigrations, showStatus };

