import type { LogEntry } from './types';
import type { LogLevel } from './validation/schemas';

/**
 * Emoji mappings for different log levels.
 */
const LOG_LEVEL_EMOJIS: Record<LogLevel, string> = {
	debug: '🔍',
	error: '❌',
	info: 'ℹ️',
	warn: '⚠️'
} as const;

/**
 * Structured logger for consistent, searchable logging across the application.
 *
 * This logger provides structured logging with metadata support, making it easier
 * to search, filter, and analyze logs in production environments. It includes
 * specialized methods for common operations like scraping, database operations,
 * and health checks.
 *
 * @example
 * ```typescript
 * const logger = new StructuredLogger('user-service');
 * logger.info('User created successfully', 'auth', { userId: '123' });
 * logger.error('Database connection failed', 'database', { error: err.message });
 * ```
 *
 * @class StructuredLogger
 */
export class StructuredLogger {
	/** Component identifier for this logger instance */
	private readonly defaultComponent: string;

	/** Session ID for tracking related log entries */
	private readonly sessionId: string;

	/**
	 * Creates a new StructuredLogger instance.
	 *
	 * @param defaultComponent - Default component name for log entries
	 * @param sessionId - Optional session ID for tracking related operations
	 */
	public constructor(defaultComponent: string = 'system', sessionId?: string) {
		this.defaultComponent = defaultComponent;
		this.sessionId = sessionId ?? this.generateSessionId();
	}

	/**
	 * Generates a unique session ID for tracking related operations.
	 *
	 * @returns A unique session ID string
	 * @private
	 */
	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
	}

	/**
	 * Core logging method that handles formatting and output.
	 *
	 * @param level - The log level
	 * @param message - The log message
	 * @param component - The component generating the log (defaults to instance default)
	 * @param metadata - Additional structured data to include
	 * @private
	 */
	private log(
		level: LogLevel,
		message: string,
		component: string = this.defaultComponent,
		metadata?: Record<string, unknown>
	): void {
		const entry: LogEntry = {
			component,
			level,
			message,
			metadata,
			timestamp: new Date().toISOString()
		};

		this.outputToConsole(entry);

		// In production, you'd send this to a logging service
		// await this.sendToLogService(entry);
	}

	/**
	 * Outputs the log entry to the console with appropriate formatting.
	 *
	 * @param entry - The log entry to output
	 * @private
	 */
	private outputToConsole(entry: LogEntry): void {
		const emoji = LOG_LEVEL_EMOJIS[entry.level];
		const formatted = `${emoji} [${entry.timestamp}] ${entry.component}: ${entry.message}`;
		const metadataString = entry.metadata
			? JSON.stringify(entry.metadata, null, 2)
			: '';

		switch (entry.level) {
			case 'error':
				console.error(formatted, metadataString);
				break;
			case 'warn':
				console.warn(formatted, metadataString);
				break;
			case 'debug':
			case 'info':
			default:
				console.log(formatted, metadataString);
				break;
		}
	}

	/**
	 * Logs a debug message.
	 *
	 * Debug messages are typically used for detailed diagnostic information
	 * that is only of interest when diagnosing problems.
	 *
	 * @param message - The debug message
	 * @param component - The component generating the log (optional)
	 * @param metadata - Additional structured data
	 * @public
	 */
	public debug(
		message: string,
		component?: string,
		metadata?: Record<string, unknown>
	): void {
		this.log('debug', message, component, metadata);
	}

	/**
	 * Logs an informational message.
	 *
	 * Info messages are used for general application flow information
	 * that might be useful in production.
	 *
	 * @param message - The info message
	 * @param component - The component generating the log (optional)
	 * @param metadata - Additional structured data
	 * @public
	 */
	public info(
		message: string,
		component?: string,
		metadata?: Record<string, unknown>
	): void {
		this.log('info', message, component, metadata);
	}

	/**
	 * Logs a warning message.
	 *
	 * Warning messages are used for potentially harmful situations
	 * that don't prevent the application from continuing.
	 *
	 * @param message - The warning message
	 * @param component - The component generating the log (optional)
	 * @param metadata - Additional structured data
	 * @public
	 */
	public warn(
		message: string,
		component?: string,
		metadata?: Record<string, unknown>
	): void {
		this.log('warn', message, component, metadata);
	}

	/**
	 * Logs an error message.
	 *
	 * Error messages are used for error events that might still allow
	 * the application to continue running.
	 *
	 * @param message - The error message
	 * @param component - The component generating the log (optional)
	 * @param metadata - Additional structured data
	 * @public
	 */
	public error(
		message: string,
		component?: string,
		metadata?: Record<string, unknown>
	): void {
		this.log('error', message, component, metadata);
	}

	// Specialized logging methods for common operations

	/**
	 * Logs the start of a scraping operation.
	 *
	 * @param url - The URL being scraped
	 * @public
	 */
	public scrapeStart(url: string): void {
		this.info('Scrape started', 'scraper', { action: 'scrape_start', url });
	}

	/**
	 * Logs successful completion of a scraping operation.
	 *
	 * @param url - The URL that was scraped
	 * @param duration - Duration in milliseconds
	 * @param recordCount - Number of records processed (optional)
	 * @public
	 */
	public scrapeSuccess(
		url: string,
		duration: number,
		recordCount?: number
	): void {
		this.info('Scrape completed successfully', 'scraper', {
			action: 'scrape_success',
			duration,
			recordCount,
			url
		});
	}

	/**
	 * Logs failure of a scraping operation.
	 *
	 * @param url - The URL that failed to scrape
	 * @param duration - Duration before failure in milliseconds
	 * @param error - Error message
	 * @param errorType - Type/category of error (optional)
	 * @public
	 */
	public scrapeFailure(
		url: string,
		duration: number,
		error: string,
		errorType?: string
	): void {
		this.error('Scrape operation failed', 'scraper', {
			action: 'scrape_failure',
			duration,
			error,
			errorType,
			url
		});
	}

	/**
	 * Logs database operations for monitoring and debugging.
	 *
	 * @param operation - Type of database operation
	 * @param table - Database table name
	 * @param recordCount - Number of records affected
	 * @param duration - Operation duration in milliseconds
	 * @public
	 */
	public databaseOperation(
		operation: string,
		table: string,
		recordCount: number,
		duration: number
	): void {
		this.info('Database operation completed', 'database', {
			action: 'db_operation',
			duration,
			operation,
			recordCount,
			table
		});
	}

	/**
	 * Logs health check results.
	 *
	 * @param status - Health check status
	 * @param metrics - Health check metrics and details
	 * @public
	 */
	public healthCheck(status: string, metrics: Record<string, unknown>): void {
		this.info('Health check completed', 'health', {
			action: 'health_check',
			metrics,
			status
		});
	}
}
