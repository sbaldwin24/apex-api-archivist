import type { NextFunction, Request, Response } from 'express';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('auth');

interface AuthRequest extends Request {
	apiKey?: string;
	rateLimitKey?: string;
}

/** Simple in-memory store (use Redis in production) */
const apiKeys = new Map([
	['demo-key-123', { name: 'Demo User', requestsPerHour: 100, tier: 'free' }],
	[
		'premium-key-456',
		{ name: 'Premium User', requestsPerHour: 1000, tier: 'premium' }
	],
	[
		'admin-key-789',
		{ name: 'Admin User', requestsPerHour: 10000, tier: 'admin' }
	]
]);

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function authenticateApiKey(
	req: AuthRequest,
	res: Response,
	next: NextFunction
): void {
	const apiKey =
		(req.headers['x-api-key'] as string) || (req.query.apiKey as string);

	if (!apiKey) {
		logger.warn('Missing API key', 'auth', { ip: req.ip, path: req.path });
		res.status(401).json({ error: 'API key required' });

		return;
	}

	const keyData = apiKeys.get(apiKey);
	if (!keyData) {
		logger.warn('Invalid API key', 'auth', {
			apiKey: `${apiKey.substring(0, 8)}...`,
			ip: req.ip
		});
		res.status(401).json({ error: 'Invalid API key' });

		return;
	}

	req.apiKey = apiKey;
	req.rateLimitKey = `${apiKey}:${Math.floor(Date.now() / 3600000)}`; // Hour-based

	logger.debug('API key authenticated', 'auth', {
		path: req.path,
		tier: keyData.tier,
		user: keyData.name
	});

	next();
}

export function rateLimitMiddleware(
	req: AuthRequest,
	res: Response,
	next: NextFunction
): void {
	if (!req.apiKey || !req.rateLimitKey) {
		next();

		return;
	}

	const keyData = apiKeys.get(req.apiKey);
	if (!keyData) {
		next();

		return;
	}

	const now = Date.now();
	const hourStart = Math.floor(now / 3600000) * 3600000;

	let usage = rateLimitStore.get(req.rateLimitKey);
	if (!usage || usage.resetTime < hourStart) {
		usage = { count: 0, resetTime: hourStart + 3600000 };
		rateLimitStore.set(req.rateLimitKey, usage);
	}

	usage.count++;

	/** Set rate limit headers */
	res.set({
		'X-RateLimit-Limit': keyData.requestsPerHour.toString(),
		'X-RateLimit-Remaining': Math.max(
			0,
			keyData.requestsPerHour - usage.count
		).toString(),
		'X-RateLimit-Reset': usage.resetTime.toString()
	});

	if (usage.count > keyData.requestsPerHour) {
		logger.warn('Rate limit exceeded', 'auth', {
			count: usage.count,
			limit: keyData.requestsPerHour,
			user: keyData.name
		});

		res.status(429).json({
			error: 'Rate limit exceeded',
			resetTime: usage.resetTime
		});

		return;
	}

	next();
}

export function requireTier(minTier: 'free' | 'premium' | 'admin') {
	const tierLevels = { admin: 2, free: 0, premium: 1 };

	return (req: AuthRequest, res: Response, next: NextFunction): void => {
		if (!req.apiKey) {
			res.status(401).json({ error: 'Authentication required' });

			return;
		}

		const keyData = apiKeys.get(req.apiKey);
		if (
			!keyData ||
			tierLevels[keyData.tier as keyof typeof tierLevels] < tierLevels[minTier]
		) {
			logger.warn('Insufficient permissions', 'auth', {
				actual: keyData?.tier || 'none',
				required: minTier
			});
			res.status(403).json({ error: `${minTier} tier required` });

			return;
		}

		next();
	};
}
