/**
 * Core type definitions for the NASCAR Data API.
 * This file contains all shared interfaces, types, and enums used across the application.
 *
 * @fileoverview Central type definitions for maintainability and consistency
 * @author Sterling Baldwin
 * @version 1.0.0
 */

/**
 * Application environment types.
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Logging level types.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Database configuration interface.
 * Contains all necessary settings for database connection and pooling.
 */
export interface DatabaseConfig {
	/** Database host address */
	readonly host: string;
	/** Database port number */
	readonly port: number;
	/** Database username */
	readonly user: string;
	/** Database password */
	readonly password: string;
	/** Database name */
	readonly database: string;
	/** Whether to use SSL connection */
	readonly ssl?: boolean;
	/** Maximum number of connections in pool */
	readonly maxConnections?: number;
	/** Idle timeout in milliseconds */
	readonly idleTimeout?: number;
	/** Connection timeout in milliseconds */
	readonly connectionTimeout?: number;
}

/**
 * Scraping configuration interface.
 * Controls the behavior and scope of data scraping operations.
 */
export interface ScrapingConfig {
	/** Target year for scraping */
	readonly year?: number;
	/** Starting race number */
	readonly startRace?: number;
	/** Ending race number */
	readonly endRace?: number;
	/** Whether to use incremental scraping */
	readonly incremental?: boolean;
	/** Enable driver statistics scraping */
	readonly enableDriverStats?: boolean;
	/** Enable historical data scraping */
	readonly enableHistorical?: boolean;
	/** Number of historical years to scrape */
	readonly historicalYears?: number;
	/** Session ID for resuming scraping */
	readonly resumeSession?: string;
}

/**
 * Proxy configuration interface.
 * Settings for proxy server usage in web scraping.
 */
export interface ProxyConfig {
	/** Whether proxy is enabled */
	readonly enabled: boolean;
	/** Proxy username */
	readonly username?: string;
	/** Proxy password */
	readonly password?: string;
	/** List of proxy endpoints */
	readonly endpoints?: ReadonlyArray<string>;
}

/**
 * API rate limiting configuration.
 */
export interface RateLimitConfig {
	/** Time window in milliseconds */
	readonly windowMs: number;
	/** Maximum requests per window */
	readonly maxRequests: number;
}

/**
 * API caching configuration.
 */
export interface CachingConfig {
	/** Whether caching is enabled */
	readonly enabled: boolean;
	/** Default TTL in milliseconds */
	readonly defaultTtl: number;
	/** Cleanup interval in milliseconds */
	readonly cleanupInterval: number;
}

/**
 * API server configuration interface.
 * Controls API server behavior, security, and features.
 */
export interface APIConfig {
	/** API server port */
	readonly port: number;
	/** Enable CORS */
	readonly enableCors: boolean;
	/** Enable GraphQL endpoint */
	readonly enableGraphQL: boolean;
	/** Rate limiting configuration */
	readonly rateLimit?: RateLimitConfig;
	/** Caching configuration */
	readonly caching?: CachingConfig;
}

/**
 * Complete application configuration interface.
 * Root configuration object containing all subsystem configurations.
 */
export interface AppConfig {
	/** Application environment */
	readonly environment: Environment;
	/** Logging level */
	readonly logLevel: LogLevel;
	/** Database configuration */
	readonly database: DatabaseConfig;
	/** Scraping configuration */
	readonly scraping: ScrapingConfig;
	/** Proxy configuration */
	readonly proxy: ProxyConfig;
	/** API configuration */
	readonly api: APIConfig;
}

/**
 * NASCAR driver information.
 */
export interface Driver {
	/** Unique driver identifier */
	readonly id: string;
	/** Driver's first name */
	readonly firstName?: string;
	/** Driver's last name */
	readonly lastName: string;
	/** Driver's date of birth */
	readonly dateOfBirth?: Date;
	/** Driver's hometown */
	readonly hometown?: string;
}

/**
 * NASCAR team information.
 */
export interface Team {
	/** Unique team identifier */
	readonly id: string;
	/** Team name */
	readonly name: string;
	/** Manufacturer (e.g., Chevrolet, Ford, Toyota) */
	readonly manufacturer?: string;
}

/**
 * NASCAR track information.
 */
export interface Track {
	/** Unique track identifier */
	readonly id: string;
	/** Track name */
	readonly name: string;
	/** Track city */
	readonly city?: string;
	/** Track state */
	readonly state?: string;
	/** Track length in miles */
	readonly lengthMiles?: number;
	/** Track type (e.g., Superspeedway, Short Track) */
	readonly type?: string;
}

/**
 * NASCAR series information.
 */
export interface Series {
	/** Unique series identifier */
	readonly id: string;
	/** Series name */
	readonly name: string;
	/** Series generation (e.g., Next Gen) */
	readonly generation?: string;
}

/**
 * NASCAR season information.
 */
export interface Season {
	/** Unique season identifier */
	readonly id: number;
	/** Series identifier */
	readonly seriesId: string;
	/** Season year */
	readonly year: number;
}

/**
 * NASCAR race event information.
 */
export interface Event {
	/** Unique event identifier */
	readonly id: string;
	/** Season identifier */
	readonly seasonId: number;
	/** Track identifier */
	readonly trackId: string;
	/** Event name */
	readonly name: string;
	/** Event date */
	readonly eventDate: Date;
}

/**
 * Race finish status types.
 */
export type RaceStatus =
	| 'Running'
	| 'Accident'
	| 'Engine'
	| 'Transmission'
	| 'Suspension'
	| 'Withdrawn';

/**
 * Individual driver's race result.
 */
export interface RaceResult {
	/** Unique result identifier */
	readonly id: number;
	/** Event identifier */
	readonly eventId: string;
	/** Driver identifier */
	readonly driverId: string;
	/** Team identifier */
	readonly teamId: string;
	/** Car number */
	readonly carNumber: string;
	/** Finishing position */
	readonly finishPosition: number;
	/** Starting position */
	readonly startPosition?: number;
	/** Laps led */
	readonly lapsLed: number;
	/** Laps completed */
	readonly lapsCompleted?: number;
	/** Finish status */
	readonly status?: RaceStatus;
	/** Additional metadata */
	readonly metadata?: Record<string, unknown>;
}

/**
 * Error severity levels.
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error context for structured error handling.
 */
export interface ErrorContext {
	/** Operation that failed */
	readonly operation: string;
	/** Component where error occurred */
	readonly component: string;
	/** Additional metadata */
	readonly metadata?: Record<string, unknown>;
	/** Whether error is retryable */
	readonly retryable?: boolean;
	/** Error severity level */
	readonly severity?: ErrorSeverity;
}

/**
 * Retry configuration options.
 */
export interface RetryOptions {
	/** Maximum retry attempts */
	readonly maxAttempts: number;
	/** Base delay between retries in milliseconds */
	readonly baseDelay: number;
	/** Maximum delay between retries in milliseconds */
	readonly maxDelay: number;
	/** Exponential backoff factor */
	readonly backoffFactor: number;
	/** List of error patterns that should be retried */
	readonly retryableErrors?: ReadonlyArray<string>;
}

/**
 * Scraper execution options.
 */
export interface ScraperRunOptions {
	/** Run scrapers in parallel */
	readonly parallel?: boolean;
	/** Maximum number of concurrent scrapers */
	readonly maxConcurrency?: number;
	/** Continue execution if a scraper fails */
	readonly continueOnError?: boolean;
	/** Dry run mode - don't actually execute */
	readonly dryRun?: boolean;
}

/**
 * Scraper definition interface.
 */
export interface ScraperDefinition {
	/** Scraper name */
	readonly name: string;
	/** Scraper description */
	readonly description: string;
	/** Dependencies on other scrapers */
	readonly dependencies?: ReadonlyArray<string>;
	/** Execution priority */
	readonly priority: number;
	/** Whether scraper is enabled */
	readonly enabled: boolean;
	/** Required database schemas */
	readonly schemas?: ReadonlyArray<string>;
	/** Factory function to create scraper instance */
	readonly factory: () => BaseScraper;
}

/**
 * Base scraper interface that all scrapers must implement.
 */
export interface BaseScraper {
	/** Execute the scraping operation */
	run(): Promise<void>;
	/** Scrape and return data */
	scrapeData(): Promise<unknown>;
	/** Get summary sections for logging */
	getSummarySections(): Record<string, unknown>;
}

/**
 * Schema configuration interface.
 */
export interface SchemaConfig {
	/** Schema name */
	readonly name: string;
	/** Schema file path */
	readonly file: string;
	/** Dependencies on other schemas */
	readonly dependencies?: ReadonlyArray<string>;
	/** Execution priority */
	readonly priority?: number;
}

/**
 * Structured log entry interface.
 */
export interface LogEntry {
	/** Timestamp */
	readonly timestamp: string;
	/** Log level */
	readonly level: LogLevel;
	/** Log message */
	readonly message: string;
	/** Component that generated the log */
	readonly component: string;
	/** Additional metadata */
	readonly metadata?: Record<string, unknown>;
}

/**
 * API response wrapper interface.
 */
export interface ApiResponse<T = unknown> {
	/** Response data */
	readonly data?: T;
	/** Error information */
	readonly error?: string;
	/** Response metadata */
	readonly meta?: {
		/** Request timestamp */
		readonly timestamp: string;
		/** Response time in milliseconds */
		readonly responseTime: number;
		/** API version */
		readonly version: string;
	};
}

/**
 * Pagination information interface.
 */
export interface PaginationInfo {
	/** Current page number */
	readonly page: number;
	/** Number of items per page */
	readonly limit: number;
	/** Total number of items */
	readonly total: number;
	/** Total number of pages */
	readonly totalPages: number;
	/** Whether there is a next page */
	readonly hasNext: boolean;
	/** Whether there is a previous page */
	readonly hasPrevious: boolean;
}

/**
 * Paginated API response interface.
 */
export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
	/** Pagination information */
	readonly pagination: PaginationInfo;
}

/**
 * Health check status.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check response interface.
 */
export interface HealthCheckResponse {
	/** Overall system status */
	readonly status: HealthStatus;
	/** Timestamp of check */
	readonly timestamp: string;
	/** Individual service statuses */
	readonly services: Record<
		string,
		{
			readonly status: HealthStatus;
			readonly responseTime?: number;
			readonly details?: string;
		}
	>;
}

/**
 * Comprehensive health check result interface.
 */
export interface HealthCheckResult {
	/** Overall system status */
	readonly status: HealthStatus;
	/** Check timestamp */
	readonly timestamp: string;
	/** System uptime in milliseconds */
	readonly uptime: number;
	/** Health check response time */
	readonly responseTime: number;
	/** Individual health checks */
	readonly checks: Record<
		string,
		{
			readonly status: HealthStatus;
			readonly message?: string;
			readonly details?: Record<string, unknown>;
			readonly responseTime?: number;
			readonly lastCheck?: Date;
		}
	>;
	/** Application version */
	readonly version: string;
	/** Environment */
	readonly environment: string;
	/** Error information if check failed */
	readonly error?: string;
}

/**
 * System metrics interface for monitoring.
 */
export interface SystemMetrics {
	/** Metrics timestamp */
	readonly timestamp: string;
	/** Process uptime in seconds */
	readonly uptime: number;
	/** Memory usage metrics */
	readonly memory: {
		readonly heapUsed: number;
		readonly heapTotal: number;
		readonly rss: number;
		readonly external: number;
		readonly systemTotal: number;
		readonly systemFree: number;
	};
	/** CPU usage metrics */
	readonly cpu: {
		readonly usage: NodeJS.CpuUsage;
		readonly loadAverage: number[];
		readonly count: number;
	};
	/** Cache metrics */
	readonly cache: {
		readonly hitRate: number;
		readonly size: number;
		readonly memoryUsed: number;
		readonly operations: number;
	};
	/** Message queue metrics */
	readonly messageQueue: {
		readonly pendingJobs: number;
		readonly completedJobs: number;
		readonly failedJobs: number;
		readonly activeWorkers: number;
		readonly avgProcessingTime: number;
	};
}

/**
 * Enhanced cache statistics interface for Redis cache
 */
export interface CacheStats {
	/** Cache hit rate as percentage */
	readonly hitRate: number;
	/** Number of entries in cache */
	readonly size: number;
	/** Memory used by cache in bytes */
	readonly memoryUsed: number;
	/** Total cache operations */
	readonly operations: number;
	/** Individual entry statistics */
	readonly entries: ReadonlyArray<{
		readonly key: string;
		readonly hits: number;
		readonly expiry: number;
	}>;
}

/**
 * Job queue statistics interface
 */
export interface QueueStats {
	/** Number of pending jobs */
	readonly pendingJobs: number;
	/** Number of completed jobs */
	readonly completedJobs: number;
	/** Number of failed jobs */
	readonly failedJobs: number;
	/** Number of active workers */
	readonly activeWorkers: number;
	/** Average processing time in milliseconds */
	readonly avgProcessingTime: number;
}

/**
 * Database pool configuration interface
 */
export interface DatabasePoolConfig {
	/** Database connection URL */
	readonly connectionString: string;
	/** Maximum number of connections */
	readonly max: number;
	/** Minimum number of connections */
	readonly min: number;
	/** Acquire timeout in milliseconds */
	readonly acquireTimeoutMillis: number;
	/** Idle timeout in milliseconds */
	readonly idleTimeoutMillis: number;
	/** Query timeout in milliseconds */
	readonly queryTimeout: number;
	/** Connection timeout in milliseconds */
	readonly connectionTimeout: number;
	/** Whether to enable read-replica support */
	readonly enableReadReplicas: boolean;
	/** Read replica connection strings */
	readonly readReplicaUrls: ReadonlyArray<string>;
}
