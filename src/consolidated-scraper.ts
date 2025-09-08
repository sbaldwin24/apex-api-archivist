#!/usr/bin/env node
import 'dotenv/config';
import { ScraperManager, ScraperDefinition } from './base/scraper-manager';
import BroadcastMetricsScraper from '../scrapers/broadcast-metrics-scraper';
import FinancialDataScraper from '../scrapers/financial-data-scraper';
import PerformanceDataScraper from '../scrapers/performance-data-scraper';
// import { CompleteROIScraper } from './complete-roi-scraper'; // Temporarily disabled - needs fixing
import ConfigManager from './base/config-manager';
import ErrorHandler from './base/error-handler';
import SchemaManager from './base/schema-manager';
import { StructuredLogger } from './structured-logger';
import { jobProcessor } from './queue/job-processor';
import type { ScrapingJobData } from './queue/job-processor';

// Setup global error handlers
ErrorHandler.setupGlobalHandlers();

class ConsolidatedScraperOrchestrator {
  private scraperManager: ScraperManager;
  private logger: StructuredLogger;
  private config = ConfigManager.getConfig();
  private useJobQueue: boolean;

  constructor() {
    this.scraperManager = new ScraperManager();
    this.logger = new StructuredLogger('scraper-orchestrator');
    this.useJobQueue = process.env.ENABLE_JOB_PROCESSOR === 'true';
    this.registerAllScrapers();
    
    if (this.useJobQueue) {
      this.logger.info('Job queue enabled for scraping operations', 'setup');
    }
  }

  /**
   * Register all available scrapers
   */
  private registerAllScrapers(): void {
    const scraperDefinitions: ScraperDefinition[] = [
      {
        name: 'broadcast-metrics',
        description: 'Scrape broadcast metrics, camera time, and sponsor visibility data',
        priority: 2,
        enabled: true,
        schemas: ['core', 'broadcast-metrics'],
        factory: () => new BroadcastMetricsScraper()
      },
      
      // Additional scrapers can be added here following the same pattern
      // These would be implemented similar to BroadcastMetricsScraper
      {
        name: 'financial-data',
        description: 'Scrape financial data including contracts, budgets, prize money, and ROI analysis',
        priority: 2,
        enabled: process.env.ENABLE_FINANCIAL_SCRAPER !== 'false', // Enabled by default
        schemas: ['core', 'financial'],
        factory: () => new FinancialDataScraper()
      },
      
      {
        name: 'performance-data',
        description: 'Scrape performance data including telemetry, car setup, tire strategy, and fuel efficiency',
        priority: 3,
        enabled: process.env.ENABLE_PERFORMANCE_SCRAPER !== 'false', // Enabled by default
        schemas: ['core', 'performance'],
        factory: () => new PerformanceDataScraper()
      },
      
      // {
      //   name: 'complete-roi',
      //   description: 'Advanced ROI analysis with predictive modeling, A/B testing, and multi-touch attribution',
      //   priority: 4,
      //   enabled: process.env.ENABLE_COMPLETE_ROI_SCRAPER === 'true',
      //   schemas: ['core', 'financial', 'broadcast-metrics', 'complete-roi'],
      //   dependencies: ['financial-data', 'broadcast-metrics'],
      //   factory: () => {
      //     return new CompleteROIScraper({
      //       maxConcurrency: 3,
      //       requestDelay: 1000,
      //       timeout: 300000, // 5 minutes for complex analysis
      //       retryAttempts: 3,
      //       baseUrl: '',
      //       headers: {}
      //     });
      //   }
      // } // Temporarily disabled - needs fixing
    ];

    this.scraperManager.registerScrapers(scraperDefinitions);
    
    this.logger.info('Registered all scraper definitions', 'setup', {
      totalScrapers: scraperDefinitions.length,
      enabledScrapers: scraperDefinitions.filter(s => s.enabled).length
    });
  }

  /**
   * Run scrapers based on command line arguments or configuration
   */
  async run(): Promise<void> {
    const args = process.argv.slice(2);
    
    try {
      // Log configuration summary
      this.logger.info('Starting consolidated scraper orchestrator', 'startup', {
        config: ConfigManager.getConfigSummary(),
        args
      });

      // Validate scrapers
      const validation = this.scraperManager.validateScrapers();
      if (validation.invalid.length > 0) {
        this.logger.warn('Some scrapers have validation issues', 'validation', {
          invalid: validation.invalid
        });
      }

      // Parse command line arguments
      const options = this.parseArguments(args);
      
      if (options.listScrapers) {
        this.listScrapers();
        return;
      }

      if (options.validateOnly) {
        await this.validateEnvironment();
        return;
      }

      if (options.setupSchemasOnly) {
        await this.setupAllSchemas();
        return;
      }

      // Run scrapers - either directly or via job queue
      if (this.useJobQueue && !options.runOptions.dryRun) {
        await this.queueScrapingJobs(options.scraperNames, options.runOptions);
      } else {
        if (options.scraperNames.length > 0) {
          await this.scraperManager.runScrapers(options.scraperNames, options.runOptions);
        } else {
          await this.scraperManager.runAllScrapers(options.runOptions);
        }
      }

      this.logger.info('Scraper operations initiated successfully', 'completion');
      
    } catch (error: any) {
      this.logger.error('Scraper orchestration failed', 'orchestration', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(args: string[]) {
    const options = {
      scraperNames: [] as string[],
      listScrapers: false,
      validateOnly: false,
      setupSchemasOnly: false,
      runOptions: {
        parallel: false,
        maxConcurrency: 3,
        continueOnError: false,
        dryRun: false
      }
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--list':
        case '-l':
          options.listScrapers = true;
          break;
          
        case '--validate':
        case '-v':
          options.validateOnly = true;
          break;
          
        case '--setup-schemas':
        case '-s':
          options.setupSchemasOnly = true;
          break;
          
        case '--parallel':
        case '-p':
          options.runOptions.parallel = true;
          break;
          
        case '--concurrency':
        case '-c':
          const concurrencyArg = args[++i];
          options.runOptions.maxConcurrency = concurrencyArg ? Number(concurrencyArg) || 3 : 3;
          break;
          
        case '--continue-on-error':
          options.runOptions.continueOnError = true;
          break;
          
        case '--dry-run':
        case '-n':
          options.runOptions.dryRun = true;
          break;
          
        case '--scraper':
          const scraperArg = args[++i];
          if (scraperArg) {
            options.scraperNames.push(scraperArg);
          }
          break;
          
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          
        default:
          if (arg && !arg.startsWith('-')) {
            // Assume it's a scraper name
            options.scraperNames.push(arg);
          }
          break;
      }
    }

    return options;
  }

  /**
   * Queue scraping jobs for background processing
   */
  private async queueScrapingJobs(scraperNames: string[], runOptions: any): Promise<void> {
    const scrapersToRun = scraperNames.length > 0 
      ? scraperNames 
      : this.scraperManager.listEnabledScrapers().map(s => s.name);
    
    const jobs: Array<{ type: string; data: ScrapingJobData }> = [];
    
    for (const scraperName of scrapersToRun) {
      const jobData: ScrapingJobData = {
        type: this.mapScraperNameToJobType(scraperName),
        priority: this.getJobPriority(scraperName),
        metadata: {
          scraperName,
          runOptions,
          queuedAt: new Date().toISOString()
        }
      };
      
      jobs.push({ 
        type: this.mapScraperNameToJobType(scraperName), 
        data: jobData 
      });
    }
    
    this.logger.info('Queuing scraper jobs', 'job-queue', {
      totalJobs: jobs.length,
      jobTypes: jobs.map(j => j.type)
    });
    
    const queuedJobs = await jobProcessor.addBulkScrapingJobs(jobs);
    
    this.logger.info('Scraper jobs queued successfully', 'job-queue', {
      jobIds: queuedJobs.map(j => j.id)
    });
  }
  
  /**
   * Map scraper names to job types
   */
  private mapScraperNameToJobType(scraperName: string): 'race' | 'driver' | 'season' | 'broadcast' | 'standings' {
    const mapping: Record<string, 'race' | 'driver' | 'season' | 'broadcast' | 'standings'> = {
      'broadcast-metrics': 'broadcast',
      'financial-data': 'driver',
      'performance-data': 'race',
      'complete-roi': 'broadcast',
      'standings': 'standings',
      'season': 'season'
    };
    
    return mapping[scraperName] || 'race';
  }
  
  /**
   * Get job priority based on scraper type
   */
  private getJobPriority(scraperName: string): 'low' | 'normal' | 'high' {
    const priorities: Record<string, 'low' | 'normal' | 'high'> = {
      'broadcast-metrics': 'high',
      'financial-data': 'normal',
      'performance-data': 'normal',
      'complete-roi': 'low'
    };
    
    return priorities[scraperName] || 'normal';
  }
  
  /**
   * Get queue status and statistics
   */
  async getQueueStatus(): Promise<any> {
    if (!this.useJobQueue) {
      return { status: 'disabled', message: 'Job queue is not enabled' };
    }
    
    try {
      const stats = await jobProcessor.getQueueStats();
      return { status: 'active', ...stats };
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }

  /**
   * List all available scrapers
   */
  private listScrapers(): void {
    const scrapers = this.scraperManager.listScrapers();
    const status = this.scraperManager.getStatusSummary();
    
    console.log('\n🏁 NASCAR Data Scraper - Available Scrapers\n');
    console.log(`Total: ${status.total} | Enabled: ${status.enabled} | Valid: ${status.valid}\n`);
    
    scrapers.forEach(scraper => {
      const statusIcon = scraper.enabled ? '✅' : '❌';
      const dependsOn = scraper.dependencies ? ` (depends on: ${scraper.dependencies.join(', ')})` : '';
      
      console.log(`${statusIcon} ${scraper.name} (priority: ${scraper.priority})`);
      console.log(`   ${scraper.description}${dependsOn}`);
      if (scraper.schemas) {
        console.log(`   Schemas: ${scraper.schemas.join(', ')}`);
      }
      console.log();
    });
  }

  /**
   * Validate environment and dependencies
   */
  private async validateEnvironment(): Promise<void> {
    console.log('\n🔍 Validating Environment and Dependencies\n');
    
    // Validate configuration
    console.log('✅ Configuration loaded and validated');
    
    // Validate database connection
    try {
      const { pool } = await import('./database');
      await pool.query('SELECT 1');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.log(`❌ Database connection failed: ${(error as Error).message}`);
    }
    
    // Validate schemas
    const schemaManager = new SchemaManager();
    const { valid, invalid } = schemaManager.validateAllSchemaFiles();
    console.log(`✅ Schema files: ${valid.length} valid, ${invalid.length} invalid`);
    
    if (invalid.length > 0) {
      console.log(`❌ Invalid schema files: ${invalid.join(', ')}`);
    }
    
    // Validate scrapers
    const scraperValidation = this.scraperManager.validateScrapers();
    console.log(`✅ Scrapers: ${scraperValidation.valid.length} valid, ${scraperValidation.invalid.length} invalid`);
    
    if (scraperValidation.invalid.length > 0) {
      scraperValidation.invalid.forEach(({ name, errors }) => {
        console.log(`❌ ${name}: ${errors.join(', ')}`);
      });
    }
    
    console.log('\n✅ Environment validation complete\n');
  }

  /**
   * Setup all schemas
   */
  private async setupAllSchemas(): Promise<void> {
    console.log('\n📊 Setting up database schemas\n');
    
    const schemaManager = new SchemaManager();
    await schemaManager.setupAllSchemas();
    
    console.log('\n✅ All schemas setup complete\n');
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
🏁 NASCAR Data Scraper - Consolidated Architecture

Usage: npm run scrape [options] [scrapers...]

Options:
  -l, --list                 List all available scrapers
  -v, --validate             Validate environment and dependencies
  -s, --setup-schemas        Setup database schemas only
  -p, --parallel             Run scrapers in parallel
  -c, --concurrency <num>    Max concurrent scrapers (default: 3)
  --continue-on-error        Continue if a scraper fails
  -n, --dry-run              Show what would be executed
  --scraper <name>           Run specific scraper
  -h, --help                 Show this help

Examples:
  npm run scrape                           # Run all enabled scrapers
  npm run scrape broadcast-metrics         # Run specific scraper
  npm run scrape --parallel --concurrency 2 # Run in parallel with limit
  npm run scrape --list                    # List available scrapers
  npm run scrape --validate                # Validate environment
  npm run scrape --setup-schemas           # Setup database schemas

Available scrapers: broadcast-metrics, financial-data, performance-data, complete-roi
    `);
  }
}

// Main execution
async function main(): Promise<void> {
  const orchestrator = new ConsolidatedScraperOrchestrator();
  await orchestrator.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default ConsolidatedScraperOrchestrator;
