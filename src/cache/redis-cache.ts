import Redis from 'ioredis';
import { StructuredLogger } from '../structured-logger';

export interface CacheOptions {
	ttl?: number;
	namespace?: string;
	serialize?: boolean;
	compress?: boolean;
}

export interface CacheStats {
	hits: number;
	misses: number;
	keys: number;
	memory: number;
}

/**
 * Redis-based distributed cache for Apex Data API
 * Provides high-performance caching with automatic serialization,
 * compression, and intelligent cache strategies
 */
export class RedisCache {
	private redis: Redis;
	private logger: StructuredLogger;
	private defaultTTL: number = 300; // 5 minutes
	private namespace: string;
	private stats = { hits: 0, misses: 0 };

	constructor(
		redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
		namespace: string = 'apex'
	) {
		this.redis = new Redis(redisUrl, {
			commandTimeout: 5000,
			connectTimeout: 10000,
			/** Error handling */
			enableOfflineQueue: false,
			/** Connection pooling */
			family: 4,
			keepAlive: 30000,
			keyPrefix: `${namespace}:`,
			lazyConnect: true,
			maxRetriesPerRequest: null // Remove retry limit
		});

		this.logger = new StructuredLogger('redis-cache');
		this.namespace = namespace;

		this.setupRedisEvents();
	}

	private setupRedisEvents(): void {
		this.redis.on('connect', () => {
			this.logger.info('Redis connection established', 'connection');
		});

		this.redis.on('error', (error: Error) => {
			this.logger.error('Redis connection error', 'connection', {
				error: error.message
			});
		});

		this.redis.on('close', () => {
			this.logger.warn('Redis connection closed', 'connection');
		});
	}

	/**
	 * Get value from cache with automatic deserialization
	 */
	async get<T = any>(
		key: string,
		options: CacheOptions = {}
	): Promise<T | null> {
		try {
			const fullKey = this.buildKey(key, options.namespace);
			const value = await this.redis.get(fullKey);

			if (value === null) {
				this.stats.misses++;
				this.logger.debug('Cache miss', 'cache', { key: fullKey });

				return null;
			}

			this.stats.hits++;
			this.logger.debug('Cache hit', 'cache', { key: fullKey });

			/** Deserialize if needed */
			if (options.serialize !== false) {
				try {
					return JSON.parse(value) as T;
				} catch {
					return value as T;
				}
			}

			return value as T;
		} catch (error) {
			this.logger.error('Cache get failed', 'cache', {
				error: (error as Error).message,
				key
			});

			this.stats.misses++;

			return null;
		}
	}

	/**
	 * Set value in cache with automatic serialization and TTL
	 */
	async set(
		key: string,
		value: any,
		options: CacheOptions = {}
	): Promise<void> {
		try {
			const fullKey = this.buildKey(key, options.namespace);
			const ttl = options.ttl || this.defaultTTL;

			let serializedValue: string;

			/** Serialize if needed */
			if (options.serialize !== false && typeof value !== 'string') {
				serializedValue = JSON.stringify(value);
			} else {
				serializedValue = String(value);
			}

			await this.redis.setex(fullKey, ttl, serializedValue);

			this.logger.debug('Cache set', 'cache', {
				key: fullKey,
				size: serializedValue.length,
				ttl
			});
		} catch (error) {
			this.logger.error('Cache set failed', 'cache', {
				error: (error as Error).message,
				key
			});
			throw error;
		}
	}

	/**
	 * Delete specific key(s) from cache
	 */
	async del(
		key: string | string[],
		options: CacheOptions = {}
	): Promise<number> {
		try {
			const keys = Array.isArray(key) ? key : [key];
			const fullKeys = keys.map((k) => this.buildKey(k, options.namespace));

			const deleted = await this.redis.del(...fullKeys);

			this.logger.debug('Cache delete', 'cache', { deleted, keys: fullKeys });

			return deleted;
		} catch (error) {
			this.logger.error('Cache delete failed', 'cache', {
				error: (error as Error).message,
				key
			});

			return 0;
		}
	}

	/**
	 * Invalidate cache keys by pattern
	 */
	async invalidatePattern(
		pattern: string,
		options: CacheOptions = {}
	): Promise<number> {
		try {
			const fullPattern = this.buildKey(pattern, options.namespace);
			const keys = await this.redis.keys(fullPattern);

			if (keys.length === 0) {
				return 0;
			}

			const deleted = await this.redis.del(...keys);

			this.logger.info('Cache pattern invalidated', 'cache', {
				deleted,
				keysFound: keys.length,
				pattern: fullPattern
			});

			return deleted;
		} catch (error) {
			this.logger.error('Cache pattern invalidation failed', 'cache', {
				error: (error as Error).message,
				pattern
			});

			return 0;
		}
	}

	/**
	 * Motorsports-specific cache strategies
	 */
	async cacheRaceResults(raceId: string, results: any): Promise<void> {
		await this.set(`race:results:${raceId}`, results, {
			namespace: 'races',
			ttl: 3600 // 1 hour - race results rarely change
		});
	}

	async getCachedRaceResults(raceId: string): Promise<any> {
		return this.get(`race:results:${raceId}`, { namespace: 'races' });
	}

	async cacheDriverStats(
		driverId: string,
		year: number,
		stats: any
	): Promise<void> {
		await this.set(`driver:stats:${driverId}:${year}`, stats, {
			namespace: 'drivers',
			ttl: 1800 // 30 minutes - stats update during season
		});
	}

	async getCachedDriverStats(driverId: string, year: number): Promise<any> {
		return this.get(`driver:stats:${driverId}:${year}`, {
			namespace: 'drivers'
		});
	}

	async cacheStandings(year: number, standings: any): Promise<void> {
		await this.set(`standings:${year}`, standings, {
			namespace: 'standings',
			ttl: 900 // 15 minutes - standings change frequently during season
		});
	}

	async getCachedStandings(year: number): Promise<any> {
		return this.get(`standings:${year}`, { namespace: 'standings' });
	}

	/**
	 * Cache with automatic refresh (cache-aside pattern)
	 */
	async getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		options: CacheOptions = {}
	): Promise<T> {
		const cached = await this.get<T>(key, options);

		if (cached !== null) {
			return cached;
		}

		/** Cache miss - fetch data */
		const data = await factory();
		await this.set(key, data, options);

		return data;
	}

	/**
	 * Batch operations for better performance
	 */
	async mget<T = any>(
		keys: string[],
		options: CacheOptions = {}
	): Promise<(T | null)[]> {
		try {
			const fullKeys = keys.map((key) => this.buildKey(key, options.namespace));
			const values = await this.redis.mget(...fullKeys);

			return values.map((value, index) => {
				if (value === null) {
					this.stats.misses++;
					return null;
				}

				this.stats.hits++;

				if (options.serialize !== false) {
					try {
						return JSON.parse(value) as T;
					} catch {
						return value as T;
					}
				}

				return value as T;
			});
		} catch (error) {
			this.logger.error('Cache mget failed', 'cache', {
				error: (error as Error).message,
				keys
			});
			return keys.map(() => null);
		}
	}

	async mset(
		keyValuePairs: [string, any][],
		options: CacheOptions = {}
	): Promise<void> {
		try {
			const ttl = options.ttl || this.defaultTTL;
			const pipeline = this.redis.pipeline();

			for (const [key, value] of keyValuePairs) {
				const fullKey = this.buildKey(key, options.namespace);
				const serializedValue =
					options.serialize !== false && typeof value !== 'string'
						? JSON.stringify(value)
						: String(value);

				pipeline.setex(fullKey, ttl, serializedValue);
			}

			await pipeline.exec();

			this.logger.debug('Cache mset', 'cache', {
				count: keyValuePairs.length,
				ttl
			});
		} catch (error) {
			this.logger.error('Cache mset failed', 'cache', {
				count: keyValuePairs.length,
				error: (error as Error).message
			});
			throw error;
		}
	}

	/**
	 * Health check for cache system
	 */
	async healthCheck(): Promise<{
		status: 'healthy' | 'unhealthy';
		latency?: number;
		error?: string;
	}> {
		const start = Date.now();

		try {
			await this.redis.ping();
			const latency = Date.now() - start;

			return { latency, status: 'healthy' };
		} catch (error) {
			return {
				error: (error as Error).message,
				status: 'unhealthy'
			};
		}
	}

	/**
	 * Get cache statistics
	 */
	async getStats(): Promise<CacheStats> {
		try {
			const info = await this.redis.info('memory');
			const keyCount = await this.redis.dbsize();

			/** Parse memory usage from info */
			const memoryMatch = info.match(/used_memory:(\d+)/);
			const memory = memoryMatch && memoryMatch[1] ? Number(memoryMatch[1]) : 0;

			return {
				hits: this.stats.hits,
				keys: keyCount,
				memory,
				misses: this.stats.misses
			};
		} catch (error) {
			this.logger.error('Failed to get cache stats', 'cache', {
				error: (error as Error).message
			});

			return {
				hits: this.stats.hits,
				keys: 0,
				memory: 0,
				misses: this.stats.misses
			};
		}
	}

	/**
	 * Close Redis connection
	 */
	async close(): Promise<void> {
		await this.redis.quit();
		this.logger.info('Redis connection closed', 'connection');
	}

	private buildKey(key: string, namespace?: string): string {
		return namespace ? `${namespace}:${key}` : key;
	}
}

/** Singleton instance for easy access */
export const redisCache = new RedisCache();

/** Export for testing */
export default RedisCache;
