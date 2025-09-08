/**
 * Security Middleware
 * Comprehensive security measures including Helmet, rate limiting, and input validation
 */

import type {
	Express,
	NextFunction,
	Request,
	RequestHandler,
	Response
} from 'express';
import rateLimit from 'express-rate-limit';
import { param, query, validationResult } from 'express-validator';
import helmet from 'helmet';
import { AuthService, UserTier } from './auth-service';
import { StructuredLogger } from './structured-logger';
import {
	ApiKeySchema,
	CarNumberSchema,
	PaginationLimitSchema,
	PaginationOffsetSchema,
	PasswordSchema,
	RaceNumberSchema,
	SearchQuerySchema,
	SortBySchema,
	SortOrderSchema,
	YearSchema,
	z
} from './validation/schemas';

const logger = new StructuredLogger('security-middleware');

/**
 * Security configuration based on environment
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Helmet security configuration
 */
export const helmetConfig = helmet({
	/** Content Security Policy */
	contentSecurityPolicy: {
		directives: {
			connectSrc: ["'self'", 'https:'],
			defaultSrc: ["'self'"],
			fontSrc: ["'self'", 'https:'],
			frameSrc: ["'none'"],
			imgSrc: ["'self'", 'data:', 'https:'],
			mediaSrc: ["'self'"],
			objectSrc: ["'none'"],
			scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
			styleSrc: ["'self'", "'unsafe-inline'", 'https:']
		}
	},

	/** Cross-Origin Resource Policy */
	crossOriginResourcePolicy: {
		policy: isProduction ? 'same-site' : 'cross-origin'
	},

	/** DNS Prefetch Control */
	dnsPrefetchControl: {
		allow: false
	},

	/** Frame Guard */
	frameguard: {
		action: 'deny'
	},

	/** Hide Powered-By Header */
	hidePoweredBy: true,

	/** HSTS (only in production) */
	hsts: isProduction
		? {
				includeSubDomains: true,
				maxAge: 31536000, // 1 year
				preload: true
			}
		: false,

	/** IE No Open */
	ieNoOpen: true,

	/** No Sniff */
	noSniff: true,

	/** Origin Agent Cluster */
	originAgentCluster: true,

	/** Permitted Cross-Domain Policies */
	permittedCrossDomainPolicies: false,

	/** Referrer Policy */
	referrerPolicy: {
		policy: ['same-origin']
	},

	/** X-XSS-Protection */
	xssFilter: true
});

/**
 * Rate limiting store for tracking requests using a Map
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Custom rate limit store implementation for rate limiting
 */
class CustomRateLimitStore {
	private store = rateLimitStore;

	incr(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
		return new Promise((resolve) => {
			const now = Date.now();
			const existing = this.store.get(key);

			if (existing && existing.resetTime > now) {
				/** Increment existing count */
				existing.count++;

				resolve({
					resetTime: new Date(existing.resetTime),
					totalHits: existing.count
				});
			} else {
				/** Create new entry with 1-hour window */
				const resetTime = now + 60 * 60 * 1000; // 1 hour

				this.store.set(key, { count: 1, resetTime });

				resolve({
					resetTime: new Date(resetTime),
					totalHits: 1
				});
			}
		});
	}

	decrement(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
		return new Promise((resolve) => {
			const existing = this.store.get(key);
			if (existing) {
				existing.count = Math.max(0, existing.count - 1);
				resolve({
					resetTime: new Date(existing.resetTime),
					totalHits: existing.count
				});
			} else {
				resolve({ totalHits: 0 });
			}
		});
	}

	resetKey(key: string): Promise<void> {
		return new Promise((resolve) => {
			this.store.delete(key);
			resolve();
		});
	}

	resetAll(): Promise<void> {
		return new Promise((resolve) => {
			this.store.clear();
			resolve();
		});
	}
}

/**
 * Create rate limiter based on user tier
 */
export const createRateLimiter = (
	options: {
		windowMs?: number;
		max?: number;
		message?: string;
		skipSuccessfulRequests?: boolean;
	} = {}
) => {
	const store = new CustomRateLimitStore();

	return rateLimit({
		/** Custom rate limit logic based on user tier */
		handler: (req: Request, res: Response) => {
			const user = (req as any).user;
			const userTier = user?.tier || UserTier.FREE;
			const limit = AuthService.getRateLimitForTier(userTier);

			logger.warn('Rate limit exceeded', 'security-middleware', {
				ip: req.ip,
				limit: limit.requests,
				path: req.path,
				userId: user?.id,
				userTier
			});

			res.status(429).json({
				code: 'RATE_LIMIT_EXCEEDED',
				error: `Rate limit exceeded for ${userTier} tier`,
				limit: limit.requests,
				retryAfter: Math.ceil(limit.window / 60) + ' minutes',
				window: limit.window
			});
		},

		/** Custom key generator that considers user tier */
		keyGenerator: (req: Request): string => {
			const user = (req as any).user;
			const ip = req.ip || req.connection.remoteAddress || 'unknown';

			if (user) {
				return `${user.id}:${user.tier}`;
			}
			return `ip:${ip}`;
		},
		legacyHeaders: false,
		max: options.max || 100, // Default to free tier limit
		message: {
			code: 'RATE_LIMIT_EXCEEDED',
			error: options.message || 'Too many requests from this IP',
			retryAfter: '1 hour'
		},

		// Skip rate limiting for certain conditions
		skip: (req: Request): boolean => {
			/** Skip for health checks */
			if (req.path.startsWith('/health')) {
				return true;
			}

			/** Skip for admin users in development */
			if (!isProduction && (req as any).user?.tier === UserTier.ADMIN) {
				return true;
			}

			return false;
		},
		skipSuccessfulRequests: options.skipSuccessfulRequests || false,
		standardHeaders: true,
		store: store as any,
		windowMs: options.windowMs || 60 * 60 * 1000 // 1 hour default
	});
};

/**
 * Tier-based rate limiters
 */
export const rateLimiters = {
	admin: createRateLimiter({ max: 50000 }),
	enterprise: createRateLimiter({ max: 10000 }),
	free: createRateLimiter({ max: 100 }),
	pro: createRateLimiter({ max: 1000 })
};

/**
 * Dynamic rate limiter that adjusts based on user tier
 */
export const dynamicRateLimit = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const user = (req as any).user;
	const userTier = user?.tier || UserTier.FREE;

	let limiter: any;
	switch (userTier) {
		case UserTier.ADMIN:
			limiter = rateLimiters.admin;
			break;
		case UserTier.ENTERPRISE:
			limiter = rateLimiters.enterprise;
			break;
		case UserTier.PRO:
			limiter = rateLimiters.pro;
			break;
		default:
			limiter = rateLimiters.free;
	}

	limiter(req, res, next);
};

/**
 * Input validation schemas using centralized Zod schemas
 */
export const validationSchemas = {
	/** API key validation */
	apiKey: ApiKeySchema,
	carNumber: CarNumberSchema,

	/** User validations */
	email: z.string().email(),
	limit: PaginationLimitSchema,
	offset: PaginationOffsetSchema,
	password: PasswordSchema,

	/** Race specific validations */
	raceNumber: RaceNumberSchema,

	/** Search and filter validations */
	search: SearchQuerySchema,
	sortBy: SortBySchema.default('name'),
	sortOrder: SortOrderSchema.default('asc'),
	/** Common parameter validations */
	year: YearSchema
};

/**
 * Zod validation middleware factory
 */
export const validateSchema = <T = any>(
	schema: z.ZodType<T>,
	source: 'body' | 'query' | 'params' = 'body'
): RequestHandler => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const dataToValidate =
			source === 'body'
				? req.body
				: source === 'query'
					? req.query
					: req.params;

		const result = schema.safeParse(dataToValidate);

		if (!result.success) {
			const errors = result.error.issues.map((issue) => ({
				field: issue.path.join('.'),
				message: issue.message,
				type: issue.code,
				value:
					issue.code === 'invalid_type' ? (issue as any).received : undefined
			}));

			logger.warn('Input validation failed', 'security-middleware', {
				errors,
				path: req.path,
				source
			});

			res.status(400).json({
				code: 'VALIDATION_ERROR',
				details: errors,
				error: 'Validation failed'
			});
			return;
		}

		/** Replace the original data with validated/sanitized data */
		if (source === 'body') req.body = result.data;
		else if (source === 'query') req.query = result.data as any;
		else if (source === 'params') req.params = result.data as any;

		next();
	};
};

/**
 * Express-validator based validations for common use cases
 */
export const commonValidations = {
	/** Pagination validation */
	pagination: [
		query('limit')
			.optional()
			.isInt({ max: 100, min: 1 })
			.toInt()
			.withMessage('Limit must be between 1 and 100'),
		query('offset')
			.optional()
			.isInt({ min: 0 })
			.toInt()
			.withMessage('Offset must be a non-negative integer')
	],

	/** Search query validation */
	searchQuery: [
		query('search')
			.optional()
			.trim()
			.escape()
			.isLength({ max: 100, min: 1 })
			.matches(/^[a-zA-Z0-9\s\-.]+$/)
			.withMessage('Search term contains invalid characters')
	],

	/** Year parameter validation */
	yearParam: [
		param('year')
			.isInt({ max: 2030, min: 1949 })
			.withMessage('Year must be between 1949 and 2030')
	]
};

/**
 * Validation error handler middleware for express-validator
 */
export const handleValidationErrors = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		logger.warn('Express-validator validation failed', 'security-middleware', {
			errors: errors.array(),
			path: req.path
		});

		res.status(400).json({
			code: 'VALIDATION_ERROR',
			details: errors.array().map((error) => ({
				field: error.type === 'field' ? (error as any).path : error.type,
				message: error.msg,
				value: (error as any).value
			})),
			error: 'Validation failed'
		});

		return;
	}

	next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	/** Remove server information */
	res.removeHeader('X-Powered-By');

	/** Add custom security headers */
	res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
	res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');

	/** Cache control for API responses */
	if (req.path.startsWith('/api/')) {
		res.setHeader(
			'Cache-Control',
			'private, no-cache, no-store, must-revalidate'
		);
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Expires', '0');
	}

	next();
};

/**
 * CORS configuration
 */
export const corsOptions = {
	allowedHeaders: [
		'Origin',
		'X-Requested-With',
		'Content-Type',
		'Accept',
		'Authorization',
		'X-API-Key',
		'X-Request-ID'
	],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	optionsSuccessStatus: 200,
	origin: (
		origin: string | undefined,
		callback: (error: Error | null, allow?: boolean) => void
	) => {
		/** Allow requests with no origin (like mobile apps or curl requests) */
		if (!origin) return callback(null, true);

		/** Allow all origins in development */
		if (!isProduction) return callback(null, true);

		/** Production origin whitelist */
		const allowedOrigins = [
			'https://nascar-data-api.com',
			'https://www.nascar-data-api.com',
			'https://staging-api.nascar-data.com',
			'https://admin.nascar-data-api.com'
		];

		/** Add custom origins from environment */
		const customOrigins = process.env.CORS_ORIGINS?.split(',') || [];
		allowedOrigins.push(...customOrigins);

		if (allowedOrigins.indexOf(origin) !== -1) {
			callback(null, true);
		} else {
			logger.warn('CORS blocked request', 'security-middleware', { origin });

			callback(new Error('Not allowed by CORS'), false);
		}
	}
};

/**
 * Request logging middleware for security monitoring
 */
export const securityLogger = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const startTime = Date.now();

	/** Log suspicious patterns */
	const suspiciousPatterns = [
		/\.\./, // Path traversal
		/<script/i, // XSS attempts
		/union.*select/i, // SQL injection
		/javascript:/i, // JavaScript protocol
		/on\w+\s*=/i // Event handlers
	];

	const requestData =
		JSON.stringify(req.body || {}) +
		req.url +
		(req.headers['user-agent'] || '');

	/** Check if the request is suspicious */
	const isSuspicious = suspiciousPatterns.some((pattern) =>
		pattern.test(requestData)
	);

	/** Log the request if it is suspicious */
	if (isSuspicious) {
		logger.warn('Suspicious request detected', 'security-middleware', {
			body: req.body,
			ip: req.ip,
			method: req.method,
			path: req.path,
			query: req.query,
			userAgent: req.headers['user-agent']
		});
	}

	/** Log the response when it finishes */
	res.on('finish', () => {
		const responseTime = Date.now() - startTime;

		logger.info('Request completed', 'security-middleware', {
			ip: req.ip,
			isSuspicious,
			method: req.method,
			path: req.path,
			responseTime,
			statusCode: res.statusCode,
			userAgent: req.headers['user-agent'],
			userId: (req as any).user?.id
		});
	});

	next();
};

/**
 * Setup all security middleware for Express app
 */
export const setupSecurity = (app: Express): void => {
	logger.info('Setting up security middleware', 'security-middleware', {
		environment: process.env.NODE_ENV,
		isProduction
	});

	/** Basic security headers */
	app.use(helmetConfig);
	app.use(securityHeaders);

	/** Request logging and monitoring */
	app.use(securityLogger);

	/** Trust proxy for accurate IP addresses */
	app.set('trust proxy', 1);

	logger.info('Security middleware setup complete', 'security-middleware');
};
