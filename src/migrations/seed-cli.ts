#!/usr/bin/env node

/**
 * Seeder CLI Tool
 * Command-line interface for database seeding management
 */

import { Command } from 'commander';
import { Pool } from 'pg';
import { StructuredLogger } from '../structured-logger';
import { DatabaseSeeder } from './database-seeder';

const logger = new StructuredLogger('seed-cli');

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
    logger.info('Database connection established', 'seed-cli');
  } catch (error) {
    logger.error('Failed to connect to database', 'seed-cli', {
      error: (error as Error).message
    });
    
    process.exit(1);
  }

  return pool;
}

/**
 * Run seeders
 */
async function runSeeders(options: { environment?: string; dry?: boolean }): Promise<void> {
  const pool = await initializeDatabase();
  const environment = options.environment || process.env.NODE_ENV || 'development';
  const seeder = new DatabaseSeeder(pool, undefined, environment);

  try {
    if (options.dry) {
      const status = await seeder.getStatus();
      
      console.log('\n=== Seeder Status ===');
      console.log(`Environment: ${status.environment}`);
      console.log(`Run seeders: ${status.run.length}`);
      console.log(`Pending seeders: ${status.pending.length}`);
      console.log(`Total seeders: ${status.total}`);
      
      if (status.pending.length > 0) {
        console.log('\nPending seeders:');
        status.pending.forEach(seeder => {
          console.log(`  - ${seeder.name}: ${seeder.description || 'No description'} (priority: ${seeder.priority})`);
        });
      }
      
      return;
    }

    const results = await seeder.seed();
    
    if (results.length === 0) {
      console.log('No pending seeders to run');
      return;
    }

    console.log('\n=== Seeding Results ===');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.executionTime}ms`;
      console.log(`${status} ${result.name} (${time})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\nCompleted: ${successful} successful, ${failed} failed`);

  } catch (error) {
    logger.error('Seeding failed', 'seed-cli', {
      error: (error as Error).message
    });

    console.error('Seeding failed:', (error as Error).message);

    process.exit(1);
  }
}

/**
 * Rollback seeders
 */
async function rollbackSeeders(seeders?: string[], options: { environment?: string; dry?: boolean } = {}): Promise<void> {
  const pool = await initializeDatabase();
  const environment = options.environment || process.env.NODE_ENV || 'development';
  const seeder = new DatabaseSeeder(pool, undefined, environment);

  try {
    if (options.dry) {
      const runSeeders = await seeder.getRunSeeders();
      const toRollback = seeders ? 
        runSeeders.filter(s => seeders.includes(s.name)) : 
        runSeeders;
      
      console.log('\n=== Rollback Preview ===');
      console.log(`Environment: ${environment}`);
      console.log(`Seeders to rollback: ${toRollback.length}`);
      
      if (toRollback.length > 0) {
        console.log('\nSeeders that would be rolled back:');

        toRollback.forEach(seeder => {
          const date = seeder.runAt.toISOString().split('T')[0];
          console.log(`  - ${seeder.name}: ${seeder.description} (run ${date})`);
        });
      }
      
      return;
    }

    const results = await seeder.rollbackSeeders(seeders);
    
    if (results.length === 0) {
      console.log('No seeders to rollback');
      return;
    }

    console.log('\n=== Rollback Results ===');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.executionTime}ms`;

      console.log(`${status} ${result.name} (${time})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

  } catch (error) {
    logger.error('Seeder rollback failed', 'seed-cli', {
      error: (error as Error).message
    });

    console.error('Seeder rollback failed:', (error as Error).message);

    process.exit(1);
  }
}

/**
 * Show seeder status
 */
async function showStatus(options: { environment?: string } = {}): Promise<void> {
  const pool = await initializeDatabase();
  const environment = options.environment || process.env.NODE_ENV || 'development';
  const seeder = new DatabaseSeeder(pool, undefined, environment);

  try {
    const status = await seeder.getStatus();

    console.log('\n=== Seeder Status ===');
    console.log(`Environment: ${status.environment}`);
    console.log(`Run seeders: ${status.run.length}`);
    console.log(`Pending seeders: ${status.pending.length}`);
    console.log(`Total seeders: ${status.total}`);

    if (status.run.length > 0) {
      console.log('\nRun seeders:');

      status.run.forEach(seeder => {
        const date = seeder.runAt.toISOString().split('T')[0];

        console.log(`  ✅ ${seeder.name}: ${seeder.description} (run ${date})`);
      });
    }

    if (status.pending.length > 0) {
      console.log('\nPending seeders:');
      status.pending.forEach(seeder => {
        console.log(`  📋 ${seeder.name}: ${seeder.description || 'No description'}`);
        console.log(`     Priority: ${seeder.priority}, Environments: [${seeder.environments.join(', ')}]`);
        if (seeder.dependencies && seeder.dependencies.length > 0) {
          console.log(`     Dependencies: [${seeder.dependencies.join(', ')}]`);
        }
      });
    }

  } catch (error) {
    logger.error('Status check failed', 'seed-cli', {
      error: (error as Error).message
    });

    console.error('Status check failed:', (error as Error).message);

    process.exit(1);
  }
}

/**
 * Reset seeders (remove all seeder records)
 */
async function resetSeeders(options: { environment?: string; confirm?: boolean } = {}): Promise<void> {
  if (!options.confirm) {
    console.log('⚠️  This will reset ALL seeder records for the current environment!');
    console.log('Use --confirm flag to proceed: pnpm seed:reset --confirm');

    return;
  }

  const pool = await initializeDatabase();
  const environment = options.environment || process.env.NODE_ENV || 'development';
  const seeder = new DatabaseSeeder(pool, undefined, environment);

  try {
    await seeder.reset();
    console.log(`✅ All seeder records reset for environment: ${environment}`);

  } catch (error) {
    logger.error('Seeder reset failed', 'seed-cli', {
      error: (error as Error).message
    });

    console.error('Seeder reset failed:', (error as Error).message);

    process.exit(1);
  }
}

// CLI Setup
const program = new Command();

program
  .name('seed')
  .description('Database seeding management CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Run pending seeders')
  .option('-e, --environment <env>', 'Target environment (development, testing, production)')
  .option('--dry', 'Show what seeders would run without executing them')
  .action(runSeeders);

program
  .command('rollback')
  .description('Rollback seeders')
  .argument('[seeders...]', 'Specific seeder names to rollback (defaults to all)')
  .option('-e, --environment <env>', 'Target environment (development, testing, production)')
  .option('--dry', 'Show what seeders would be rolled back without executing them')
  .action(rollbackSeeders);

program
  .command('status')
  .description('Show seeder status')
  .option('-e, --environment <env>', 'Target environment (development, testing, production)')
  .action(showStatus);

program
  .command('reset')
  .description('Reset all seeder records for current environment')
  .option('-e, --environment <env>', 'Target environment (development, testing, production)')
  .option('--confirm', 'Confirm the reset operation')
  .action(resetSeeders);

/** Handle cleanup on exit */
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
export { resetSeeders, rollbackSeeders, runSeeders, showStatus };

