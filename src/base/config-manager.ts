import 'dotenv/config';

import type {
  AppConfig,
  DatabaseConfig,
  ScrapingConfig,
  ProxyConfig,
  APIConfig,
  Environment,
  LogLevel
} from '../validation/schemas';
import { StructuredLogger } from '../structured-logger';

/**
 * Configuration manager for the NASCAR Data API.
 * 
 * This class implements the singleton pattern to ensure consistent configuration
 * across the entire application. It loads configuration from environment variables,
 * validates the configuration, and provides type-safe access to configuration values.
 * 
 * @example
 * ```typescript
 * const config = ConfigManager.getInstance();
 * const dbConfig = config.getDatabaseConfig();
 * console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}`);
 * ```
 * 
 * @singleton
 * @class ConfigManager
 */
export class ConfigManager {
  /** Singleton instance of the ConfigManager */
  private static instance: ConfigManager;
  
  /** The loaded and validated application configuration */
  private config: AppConfig;
  
  /** Logger instance for configuration-related messages */
  private readonly logger: StructuredLogger;

  /**
   * Private constructor to enforce singleton pattern.
   * Loads configuration from environment variables and validates it.
   * 
   * @private
   * @throws {Error} If configuration validation fails
   */
  private constructor() {
    this.logger = new StructuredLogger('config-manager');
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Gets the singleton instance of the ConfigManager.
   * Creates a new instance if one doesn't exist.
   * 
   * @returns {ConfigManager} The singleton ConfigManager instance
   * @static
   * @public
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Loads configuration from environment variables with sensible defaults.
   * 
   * This method reads configuration values from process.env and applies
   * appropriate type conversions and default values. All sensitive information
   * should be provided via environment variables.
   * 
   * @returns {AppConfig} The loaded configuration object
   * @private
   */
  private loadConfiguration(): AppConfig {
    return {
      environment: (process.env.NODE_ENV as Environment) || 'development',
      logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
      
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'apex_user',
        password: process.env.DB_PASSWORD || 'apex_password',
        database: process.env.DB_NAME || 'apex_data',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: Number(process.env.DB_MAX_CONNECTIONS || '20'),
        idleTimeout: Number(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || '2000')
      },
      
      scraping: {
        year: Number(process.env.SCRAPE_YEAR || new Date().getFullYear().toString()),
        startRace: Number(process.env.START_RACE || '1'),
        endRace: Number(process.env.END_RACE || '36'),
        incremental: process.env.INCREMENTAL === 'true',
        enableDriverStats: process.env.SCRAPE_DRIVER_STATS === 'true',
        enableHistorical: process.env.SCRAPE_HISTORICAL === 'true',
        historicalYears: Number(process.env.HISTORICAL_YEARS || '5'),
        resumeSession: process.env.RESUME_SESSION
      },
      
      proxy: {
        enabled: process.env.PROXY_ENABLED === 'true',
        username: process.env.PROXYMESH_USERNAME,
        password: process.env.PROXYMESH_PASSWORD,
        endpoints: process.env.PROXY_ENDPOINTS?.split(',') || []
      },
      
      api: {
        port: Number(process.env.API_PORT || '3000'),
        enableCors: process.env.ENABLE_CORS !== 'false',
        enableGraphQL: process.env.ENABLE_GRAPHQL !== 'false',
        rateLimit: {
          windowMs: Number(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
          maxRequests: Number(process.env.RATE_LIMIT_MAX || '100')
        },
        caching: {
          enabled: process.env.CACHING_ENABLED !== 'false',
          defaultTtl: Number(process.env.CACHE_DEFAULT_TTL || '600000'), // 10 minutes
          cleanupInterval: Number(process.env.CACHE_CLEANUP_INTERVAL || '3600000') // 1 hour
        }
      }
    };
  }

  /**
   * Validates the loaded configuration for correctness and completeness.
   * 
   * This method performs comprehensive validation of all configuration values,
   * checking for required fields, valid ranges, and logical consistency.
   * Throws an error if any validation fails.
   * 
   * @throws {Error} If any configuration validation fails
   * @private
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Database validation
    if (!this.config.database.host) {
      errors.push('Database host is required');
    }
    if (!this.config.database.user) {
      errors.push('Database user is required');
    }
    if (!this.config.database.password) {
      errors.push('Database password is required');
    }
    if (!this.config.database.database) {
      errors.push('Database name is required');
    }

    // Scraping validation
    if (this.config.scraping.year && (this.config.scraping.year < 1950 || this.config.scraping.year > new Date().getFullYear())) {
      errors.push('Invalid scraping year');
    }
    if (this.config.scraping.startRace && this.config.scraping.startRace < 1) {
      errors.push('Start race must be >= 1');
    }
    if (this.config.scraping.endRace && this.config.scraping.endRace > 50) {
      errors.push('End race must be <= 50');
    }

    // API validation
    if (this.config.api.port < 1 || this.config.api.port > 65535) {
      errors.push('Invalid API port');
    }

    if (errors.length > 0) {
      this.logger.error('Configuration validation failed', 'validation', {
        errors
      });
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    this.logger.info('Configuration loaded and validated successfully', 'config');
  }

  /**
   * Get full configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  /**
   * Get scraping configuration
   */
  public getScrapingConfig(): ScrapingConfig {
    return { ...this.config.scraping };
  }

  /**
   * Get proxy configuration
   */
  public getProxyConfig(): ProxyConfig {
    return { ...this.config.proxy };
  }

  /**
   * Get API configuration
   */
  public getAPIConfig(): APIConfig {
    return { ...this.config.api };
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Get log level
   */
  public getLogLevel(): string {
    return this.config.logLevel;
  }

  /**
   * Update configuration (for testing)
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
  }

  /**
   * Get configuration summary for logging
   */
  public getConfigSummary(): Record<string, any> {
    return {
      environment: this.config.environment,
      logLevel: this.config.logLevel,
      database: {
        host: this.config.database.host,
        port: this.config.database.port,
        database: this.config.database.database,
        ssl: this.config.database.ssl
      },
      scraping: {
        year: this.config.scraping.year,
        incremental: this.config.scraping.incremental,
        enableDriverStats: this.config.scraping.enableDriverStats,
        enableHistorical: this.config.scraping.enableHistorical
      },
      proxy: {
        enabled: this.config.proxy.enabled
      },
      api: {
        port: this.config.api.port,
        enableCors: this.config.api.enableCors,
        enableGraphQL: this.config.api.enableGraphQL
      }
    };
  }
}

// Export singleton instance
export default ConfigManager.getInstance();
