import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('cache');

interface CacheEntry {
	data: any;
	expiry: number;
	hits: number;
}

export class CacheManager {
	private cache = new Map<string, CacheEntry>();
	private defaultTTL = 300000; // 5 minutes

	set(key: string, data: any, ttlMs?: number): void {
		const expiry = Date.now() + (ttlMs || this.defaultTTL);

		this.cache.set(key, { data, expiry, hits: 0 });

		logger.debug('Cache set', 'cache', { key, ttl: ttlMs || this.defaultTTL });
	}

	get(key: string): any | null {
		const entry = this.cache.get(key);

		if (!entry) {
			logger.debug('Cache miss', 'cache', { key });

			return null;
		}

		if (Date.now() > entry.expiry) {
			this.cache.delete(key);

			logger.debug('Cache expired', 'cache', { key });

			return null;
		}

		entry.hits++;

		logger.debug('Cache hit', 'cache', { hits: entry.hits, key });

		return entry.data;
	}

	invalidate(pattern: string): number {
		let deleted = 0;

		for (const [key] of this.cache) {
			if (key.includes(pattern)) {
				this.cache.delete(key);

				deleted++;
			}
		}

		logger.info('Cache invalidated', 'cache', { deleted, pattern });

		return deleted;
	}

	delete(key: string): boolean {
		const existed = this.cache.has(key);
		this.cache.delete(key);

		if (existed) {
			logger.debug('Cache entry deleted', 'cache', { key });
		}

		return existed;
	}

	clear(): void {
		const size = this.cache.size;
		this.cache.clear();

		logger.info('Cache cleared', 'cache', { entriesRemoved: size });
	}

	getStats(): {
		size: number;
		hitRate: number;
		entries: Array<{ key: string; hits: number; expiry: number }>;
	} {
		const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
			expiry: entry.expiry,
			hits: entry.hits,
			key
		}));

		const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
		const totalRequests = totalHits + entries.length; // Approximate
		const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

		return {
			entries,
			hitRate: Math.round(hitRate * 100) / 100,
			size: this.cache.size
		};
	}

	/** Cleanup expired entries */
	cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache) {
			if (now > entry.expiry) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			logger.debug('Cache cleanup', 'cache', { entriesRemoved: cleaned });
		}
	}

	/** Start cleanup interval */
	startCleanupInterval(intervalMs: number = 60000): void {
		setInterval(() => this.cleanup(), intervalMs);

		logger.info('Cache cleanup started', 'cache', { intervalMs });
	}
}

/** Singleton instance */
export const cache = new CacheManager();
