import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { pool } from '../database';
import { StructuredLogger } from '../structured-logger';

export interface ScrapingConfig {
  schemaFile?: string;
  scraperName: string;
  enableSummary?: boolean;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
}

export interface SummarySection {
  title: string;
  icon: string;
  query: string;
  formatter: (stats: any) => void;
}

export abstract class BaseScraper {
  protected logger: StructuredLogger;
  protected config: ScrapingConfig;
  
  constructor(config: ScrapingConfig) {
    this.config = config;
    this.logger = new StructuredLogger(config.scraperName);
  }

  /**
   * Setup database schema from SQL file
   */
  protected async setupSchema(): Promise<void> {
    if (!this.config.schemaFile) return;

    const client = await pool.connect();
    try {
      const schema = readFileSync(this.config.schemaFile, 'utf8');
      await client.query(schema);
      this.logger.info(`${this.config.scraperName} schemas created successfully!`, 'setup');
    } catch (error: any) {
      this.logger.error(`Error creating ${this.config.scraperName} schemas`, 'setup', {
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute database query with connection management
   */
  protected async executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } catch (error: any) {
      this.logger.error('Database query failed', 'database', {
        query: query.substring(0, 100) + '...',
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run scraper with standardized error handling and cleanup
   */
  public async run(): Promise<void> {
    try {
      this.logger.info(`Starting ${this.config.scraperName} scraper`, 'lifecycle');
      
      // Setup schema if configured
      if (this.config.schemaFile) {
        await this.setupSchema();
      }
      
      // Execute scraping logic
      await this.scrapeData();
      
      // Show summary if enabled
      if (this.config.enableSummary) {
        await this.showSummary();
      }
      
      this.logger.info(`${this.config.scraperName} scraper completed successfully`, 'lifecycle');
    } catch (error: any) {
      this.logger.error(`Error in ${this.config.scraperName} scraper`, 'lifecycle', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Display formatted summary with sections
   */
  protected async showSummary(): Promise<void> {
    const sections = this.getSummarySections();
    
    console.log(`\n=== ${this.config.scraperName.toUpperCase()} SCRAPING RESULTS ===`);
    
    for (const section of sections) {
      try {
        const stats = await this.executeQuery(section.query);
        if (stats.length > 0) {
          console.log(`\n${section.icon} ${section.title}:`);
          section.formatter(stats[0]);
        }
      } catch (error: any) {
        this.logger.warn(`Failed to generate summary section: ${section.title}`, 'summary', {
          error: error.message
        });
      }
    }
  }

  /**
   * Format currency values consistently
   */
  protected formatCurrency(value: number | string, inMillions = false): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (inMillions) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    return `$${num.toLocaleString()}`;
  }

  /**
   * Format numbers consistently
   */
  protected formatNumber(value: number | string, decimals = 0): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toFixed(decimals);
  }

  /**
   * Format duration in seconds to minutes
   */
  protected formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60).toLocaleString()} minutes`;
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    try {
      await pool.end();
    } catch (error: any) {
      this.logger.warn('Error during cleanup', 'cleanup', {
        error: error.message
      });
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract scrapeData(): Promise<void>;
  protected abstract getSummarySections(): SummarySection[];
}

export default BaseScraper;
