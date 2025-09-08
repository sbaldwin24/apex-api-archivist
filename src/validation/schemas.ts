/**
 * Zod Schema Validation System
 * Comprehensive validation schemas for NASCAR API data types
 */

import { z } from 'zod';

// Re-export z for use in other modules
export { z };

/**
 * Environment and configuration schemas
 */
export const EnvironmentSchema = z.enum(['development', 'production', 'test']);
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

/**
 * Database configuration schema
 */
export const DatabaseConfigSchema = z.object({
	connectionTimeout: z.number().int().positive().optional(),
	database: z.string().min(1),
	host: z.string().min(1),
	idleTimeout: z.number().int().positive().optional(),
	maxConnections: z.number().int().positive().optional(),
	password: z.string().min(1),
	port: z.number().int().min(1).max(65535),
	ssl: z.boolean().optional(),
	user: z.string().min(1)
});

/**
 * Scraping configuration schema
 */
export const ScrapingConfigSchema = z.object({
	enableDriverStats: z.boolean().optional(),
	enableHistorical: z.boolean().optional(),
	endRace: z.number().int().min(1).optional(),
	historicalYears: z.number().int().positive().optional(),
	incremental: z.boolean().optional(),
	resumeSession: z.string().optional(),
	startRace: z.number().int().min(1).optional(),
	year: z.number().int().min(1950).max(2030).optional()
});

/**
 * Proxy configuration schema
 */
export const ProxyConfigSchema = z.object({
	enabled: z.boolean(),
	endpoints: z.array(z.string().url()).optional(),
	password: z.string().optional(),
	username: z.string().optional()
});

/**
 * Rate limiting configuration schema
 */
export const RateLimitConfigSchema = z.object({
	maxRequests: z.number().int().positive(),
	windowMs: z.number().int().positive()
});

/**
 * Caching configuration schema
 */
export const CachingConfigSchema = z.object({
	cleanupInterval: z.number().int().positive(),
	defaultTtl: z.number().int().positive(),
	enabled: z.boolean()
});

/**
 * API configuration schema
 */
export const APIConfigSchema = z.object({
	caching: CachingConfigSchema.optional(),
	enableCors: z.boolean(),
	enableGraphQL: z.boolean(),
	port: z.number().int().min(1).max(65535),
	rateLimit: RateLimitConfigSchema.optional()
});

/**
 * Application configuration schema
 */
export const AppConfigSchema = z.object({
	api: APIConfigSchema,
	database: DatabaseConfigSchema,
	environment: EnvironmentSchema,
	logLevel: LogLevelSchema,
	proxy: ProxyConfigSchema,
	scraping: ScrapingConfigSchema
});

/**
 * NASCAR data schemas
 */

/**
 * Driver schema
 */
export const DriverSchema = z.object({
	dateOfBirth: z.date().optional(),
	firstName: z.string().optional(),
	hometown: z.string().optional(),
	id: z.string().min(1),
	lastName: z.string().min(1)
});

/**
 * Team schema
 */
export const TeamSchema = z.object({
	id: z.string().min(1),
	manufacturer: z.string().optional(),
	name: z.string().min(1)
});

/**
 * Track schema
 */
export const TrackSchema = z.object({
	city: z.string().optional(),
	id: z.string().min(1),
	lengthMiles: z.number().positive().optional(),
	name: z.string().min(1),
	state: z.string().optional(),
	type: z.string().optional()
});

/**
 * Series schema
 */
export const SeriesSchema = z.object({
	generation: z.string().optional(),
	id: z.string().min(1),
	name: z.string().min(1)
});

/**
 * Season schema
 */
export const SeasonSchema = z.object({
	id: z.number().int().positive(),
	seriesId: z.string().min(1),
	year: z.number().int().min(1950).max(2030)
});

/**
 * Event schema
 */
export const EventSchema = z.object({
	eventDate: z.date(),
	id: z.string().min(1),
	name: z.string().min(1),
	seasonId: z.number().int().positive(),
	trackId: z.string().min(1)
});

/**
 * Race status schema
 */
export const RaceStatusSchema = z.enum([
	'Running',
	'Accident',
	'Engine',
	'Transmission',
	'Suspension',
	'Withdrawn'
]);

/**
 * Race result schema
 */
export const RaceResultSchema = z.object({
	carNumber: z.string().min(1),
	driverId: z.string().min(1),
	eventId: z.string().min(1),
	finishPosition: z.number().int().min(1),
	id: z.number().int().positive(),
	lapsCompleted: z.number().int().min(0).optional(),
	lapsLed: z.number().int().min(0),
	metadata: z.record(z.string(), z.unknown()).optional(),
	startPosition: z.number().int().min(1).optional(),
	status: RaceStatusSchema.optional(),
	teamId: z.string().min(1)
});

/**
 * Health check schemas
 */
export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export const HealthCheckSchema = z.object({
	details: z.record(z.string(), z.unknown()).optional(),
	lastCheck: z.date().optional(),
	message: z.string().optional(),
	name: z.string(),
	responseTime: z.number().positive().optional(),
	status: HealthStatusSchema
});

export const HealthCheckResultSchema = z.object({
	checks: z.record(z.string(), HealthCheckSchema),
	environment: z.string(),
	error: z.string().optional(),
	responseTime: z.number().positive(),
	status: HealthStatusSchema,
	timestamp: z.string().datetime(),
	uptime: z.number().nonnegative(),
	version: z.string()
});

/**
 * System metrics schemas
 */
export const SystemMetricsSchema = z.object({
	cache: z.object({
		hitRate: z.number().min(0).max(1),
		memoryUsed: z.number().nonnegative(),
		operations: z.number().int().nonnegative(),
		size: z.number().int().nonnegative()
	}),
	cpu: z.object({
		count: z.number().int().positive(),
		loadAverage: z.array(z.number().nonnegative()).length(3),
		usage: z.object({
			system: z.number().nonnegative(),
			user: z.number().nonnegative()
		})
	}),
	memory: z.object({
		external: z.number().nonnegative(),
		heapTotal: z.number().positive(),
		heapUsed: z.number().nonnegative(),
		rss: z.number().nonnegative(),
		systemFree: z.number().nonnegative(),
		systemTotal: z.number().positive()
	}),
	messageQueue: z.object({
		activeWorkers: z.number().int().nonnegative(),
		avgProcessingTime: z.number().nonnegative(),
		completedJobs: z.number().int().nonnegative(),
		failedJobs: z.number().int().nonnegative(),
		pendingJobs: z.number().int().nonnegative()
	}),
	timestamp: z.string().datetime(),
	uptime: z.number().nonnegative()
});

/**
 * Error handling schemas
 */
export const ErrorSeveritySchema = z.enum([
	'low',
	'medium',
	'high',
	'critical'
]);

export const ErrorContextSchema = z.object({
	component: z.string().min(1),
	metadata: z.record(z.string(), z.unknown()).optional(),
	operation: z.string().min(1),
	retryable: z.boolean().optional(),
	severity: ErrorSeveritySchema.optional()
});

/**
 * API response schemas
 */
export const ApiResponseSchema = z.object({
	data: z.unknown().optional(),
	error: z.string().optional(),
	meta: z
		.object({
			responseTime: z.number().positive(),
			timestamp: z.string().datetime(),
			version: z.string()
		})
		.optional()
});

export const PaginationInfoSchema = z.object({
	hasNext: z.boolean(),
	hasPrevious: z.boolean(),
	limit: z.number().int().positive(),
	page: z.number().int().positive(),
	total: z.number().int().nonnegative(),
	totalPages: z.number().int().nonnegative()
});

export const PaginatedResponseSchema = ApiResponseSchema.extend({
	pagination: PaginationInfoSchema
});

/**
 * Cache and queue statistics schemas
 */
export const CacheStatsSchema = z.object({
	entries: z.array(
		z.object({
			expiry: z.number().int().nonnegative(),
			hits: z.number().int().nonnegative(),
			key: z.string()
		})
	),
	hitRate: z.number().min(0).max(1),
	memoryUsed: z.number().nonnegative(),
	operations: z.number().int().nonnegative(),
	size: z.number().int().nonnegative()
});

export const QueueStatsSchema = z.object({
	activeWorkers: z.number().int().nonnegative(),
	avgProcessingTime: z.number().nonnegative(),
	completedJobs: z.number().int().nonnegative(),
	failedJobs: z.number().int().nonnegative(),
	pendingJobs: z.number().int().nonnegative()
});

/**
 * Database pool configuration schema
 */
export const DatabasePoolConfigSchema = z.object({
	acquireTimeoutMillis: z.number().int().positive(),
	connectionString: z.string().url(),
	connectionTimeout: z.number().int().positive(),
	enableReadReplicas: z.boolean(),
	idleTimeoutMillis: z.number().int().positive(),
	max: z.number().int().positive(),
	min: z.number().int().nonnegative(),
	queryTimeout: z.number().int().positive(),
	readReplicaUrls: z.array(z.string().url())
});

/**
 * Job processing schemas
 */
export const JobTypeSchema = z.enum([
	'race',
	'driver',
	'season',
	'broadcast',
	'standings'
]);

export const ScrapingJobDataSchema = z.object({
	metadata: z.record(z.string(), z.unknown()).optional(),
	options: z.record(z.string(), z.unknown()).optional(),
	priority: z.number().int().min(1).max(10).optional(),
	scraperName: z.string().min(1),
	type: JobTypeSchema
});

export const JobProcessingOptionsSchema = z.object({
	attempts: z.number().int().positive(),
	backoff: z
		.object({
			delay: z.number().int().positive(),
			type: z.string()
		})
		.optional(),
	delay: z.number().int().nonnegative(),
	removeOnComplete: z.number().int().nonnegative().optional(),
	removeOnFail: z.number().int().nonnegative().optional()
});

/**
 * Validation helper functions
 */

/**
 * Validates data against a schema and returns validated data or throws error
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
	try {
		return schema.parse(data);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const messages = error.issues.map(
				(e) => `${e.path.join('.')}: ${e.message}`
			);
			throw new Error(`Validation failed: ${messages.join(', ')}`);
		}
		throw error;
	}
}

/**
 * Safely validates data and returns success/error result
 */
export function safeValidate<T>(
	schema: z.ZodSchema<T>,
	data: unknown
): { success: true; data: T } | { success: false; error: string } {
	try {
		const validatedData = schema.parse(data);
		return { data: validatedData, success: true };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const messages = error.issues.map(
				(e) => `${e.path.join('.')}: ${e.message}`
			);
			return {
				error: `Validation failed: ${messages.join(', ')}`,
				success: false
			};
		}
		return { error: 'Unknown validation error', success: false };
	}
}

/**
 * Type inference helpers
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type ScrapingConfig = z.infer<typeof ScrapingConfigSchema>;
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;
export type APIConfig = z.infer<typeof APIConfigSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type Driver = z.infer<typeof DriverSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Series = z.infer<typeof SeriesSchema>;
export type Season = z.infer<typeof SeasonSchema>;
export type Event = z.infer<typeof EventSchema>;
export type RaceResult = z.infer<typeof RaceResultSchema>;
export type RaceStatus = z.infer<typeof RaceStatusSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
export type SystemMetrics = z.infer<typeof SystemMetricsSchema>;
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;
export type ErrorContext = z.infer<typeof ErrorContextSchema>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
	data?: T;
};
export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;
export type PaginatedResponse<T = unknown> = z.infer<
	typeof PaginatedResponseSchema
> & { data?: T };
export type CacheStats = z.infer<typeof CacheStatsSchema>;
export type QueueStats = z.infer<typeof QueueStatsSchema>;
export type DatabasePoolConfig = z.infer<typeof DatabasePoolConfigSchema>;
export type ScrapingJobData = z.infer<typeof ScrapingJobDataSchema>;
export type JobProcessingOptions = z.infer<typeof JobProcessingOptionsSchema>;

/**
 * Security and API validation schemas
 */

// API key validation
export const ApiKeySchema = z.string().regex(/^nascar_[a-zA-Z0-9]{20,40}$/);

// Car number validation
export const CarNumberSchema = z.string().regex(/^[0-9]{1,3}[A-Z]?$/);

// Password validation with complexity requirements
export const PasswordSchema = z.string()
	.min(8)
	.max(128)
	.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);

// Search query validation
export const SearchQuerySchema = z.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[a-zA-Z0-9\s\-.]+$/);

// Sort options
export const SortBySchema = z.enum(['name', 'date', 'position', 'points']);
export const SortOrderSchema = z.enum(['asc', 'desc']);

// Pagination schemas
export const PaginationLimitSchema = z.number().int().min(1).max(100).default(50);
export const PaginationOffsetSchema = z.number().int().min(0).default(0);

// Race-specific validations
export const RaceNumberSchema = z.number().int().min(1).max(40);
export const YearSchema = z.number().int().min(1949).max(2030);

// Request validation schemas
export const RequestValidationSchema = z.object({
	body: z.object({
		email: z.string().email().optional(),
		password: PasswordSchema.optional(),
		apiKey: ApiKeySchema.optional()
	}).optional(),
	query: z.object({
		limit: PaginationLimitSchema.optional(),
		offset: PaginationOffsetSchema.optional(),
		search: SearchQuerySchema.optional(),
		sortBy: SortBySchema.optional(),
		sortOrder: SortOrderSchema.optional(),
		year: YearSchema.optional()
	}).optional(),
	params: z.object({
		id: z.string().uuid().optional(),
		year: YearSchema.optional(),
		raceNumber: RaceNumberSchema.optional()
	}).optional(),
	headers: z.object({
		'x-api-key': ApiKeySchema.optional(),
		'authorization': z.string().optional()
	}).optional()
});

/**
 * Type exports for security schemas
 */
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type CarNumber = z.infer<typeof CarNumberSchema>;
export type Password = z.infer<typeof PasswordSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SortBy = z.infer<typeof SortBySchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type RaceNumber = z.infer<typeof RaceNumberSchema>;
export type Year = z.infer<typeof YearSchema>;
