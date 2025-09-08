/**
 * Comprehensive Health Check Service
 * Provides detailed health monitoring for containerized environments
 */

import os from 'os';
import { cache } from './cache-manager';
import { pool } from './database';
import { messageQueue } from './message-queue';
import { StructuredLogger } from './structured-logger';
import type { HealthCheckResult, SystemMetrics } from './validation/schemas';

const logger = new StructuredLogger('health-service');

/**
 * Health check statuses
 */
export enum HealthStatus {
	HEALTHY = 'healthy',
	DEGRADED = 'degraded',
	UNHEALTHY = 'unhealthy'
}

/**
 * Individual health check interface
 */
interface HealthCheck {
	name: string;
	status: HealthStatus;
	message?: string;
	details?: Record<string, unknown>;
	responseTime?: number;
	lastCheck?: Date;
}

/**
 * Health Service Class
 */
export class HealthService {
	private healthChecks: Map<string, HealthCheck> = new Map();
	private systemStartTime: Date = new Date();

	/**
	 * Perform all health checks
	 */
	async performHealthCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();
		const checks: HealthCheck[] = [];

		try {
			// Perform all health checks concurrently
			const [database, cache, messageQueue, system] = await Promise.allSettled([
				this.checkDatabase(),
				this.checkCache(),
				this.checkMessageQueue(),
				this.checkSystem()
			]);

			// Collect results
			if (database.status === 'fulfilled') checks.push(database.value);
			else checks.push(this.createFailedCheck('database', database.reason));

			if (cache.status === 'fulfilled') checks.push(cache.value);
			else checks.push(this.createFailedCheck('cache', cache.reason));

			if (messageQueue.status === 'fulfilled') checks.push(messageQueue.value);
			else
				checks.push(
					this.createFailedCheck('message_queue', messageQueue.reason)
				);

			if (system.status === 'fulfilled') checks.push(system.value);
			else checks.push(this.createFailedCheck('system', system.reason));

			// Determine overall status
			const overallStatus = this.determineOverallStatus(checks);
			const responseTime = Date.now() - startTime;

			// Update internal state
			checks.forEach((check) => {
				this.healthChecks.set(check.name, check);
			});

			const result: HealthCheckResult = {
				checks: checks.reduce(
					(acc, check) => {
						acc[check.name] = check;
						return acc;
					},
					{} as Record<string, HealthCheck>
				),
				environment: process.env.NODE_ENV || 'development',
				responseTime,
				status: overallStatus,
				timestamp: new Date().toISOString(),
				uptime: Date.now() - this.systemStartTime.getTime(),
				version: process.env.npm_package_version || '1.0.0'
			};

			logger.debug('Health check completed', 'health-service', {
				checkCount: checks.length,
				overallStatus,
				responseTime
			});

			return result;
		} catch (error) {
			logger.error('Health check failed', 'health-service', {
				error: (error as Error).message
			});

			return {
				checks: {},
				environment: process.env.NODE_ENV || 'development',
				error: (error as Error).message,
				responseTime: Date.now() - startTime,
				status: HealthStatus.UNHEALTHY,
				timestamp: new Date().toISOString(),
				uptime: Date.now() - this.systemStartTime.getTime(),
				version: process.env.npm_package_version || '1.0.0'
			};
		}
	}

	/**
	 * Check database connectivity and health
	 */
	private async checkDatabase(): Promise<HealthCheck> {
		const startTime = Date.now();

		try {
			// Test basic connectivity
			const result = await pool.query('SELECT 1 as test, NOW() as timestamp');
			const responseTime = Date.now() - startTime;

			// Get additional database stats
			const statsQuery = await pool.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      `);

			const stats = statsQuery.rows[0];
			const connectionUtilization =
				(stats.active_connections / stats.max_connections) * 100;

			let status = HealthStatus.HEALTHY;
			let message = 'Database is healthy';

			// Check connection utilization
			if (connectionUtilization > 80) {
				status = HealthStatus.DEGRADED;
				message = 'High database connection utilization';
			}

			if (responseTime > 1000) {
				status = HealthStatus.DEGRADED;
				message = 'Database response time is slow';
			}

			return {
				details: {
					activeConnections: stats.active_connections,
					maxConnections: stats.max_connections,
					serverTime: result.rows[0].timestamp,
					size: stats.db_size,
					utilization: `${connectionUtilization.toFixed(1)}%`
				},
				lastCheck: new Date(),
				message,
				name: 'database',
				responseTime,
				status
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			logger.error('Database health check failed', 'health-service', {
				error: (error as Error).message,
				responseTime
			});

			return {
				lastCheck: new Date(),
				message: `Database error: ${(error as Error).message}`,
				name: 'database',
				responseTime,
				status: HealthStatus.UNHEALTHY
			};
		}
	}

	/**
	 * Check cache health
	 */
	private async checkCache(): Promise<HealthCheck> {
		const startTime = Date.now();

		try {
			// Test cache operations
			const testKey = 'health-check-test';
			const testValue = Date.now().toString();

			cache.set(testKey, testValue, 1000); // 1 second TTL
			const retrieved = cache.get(testKey);
			cache.delete(testKey);

			const responseTime = Date.now() - startTime;
			const stats = cache.getStats();

			let status = HealthStatus.HEALTHY;
			let message = 'Cache is healthy';

			if (retrieved !== testValue) {
				status = HealthStatus.UNHEALTHY;
				message = 'Cache read/write test failed';
			} else if (stats.hitRate < 0.5) {
				status = HealthStatus.DEGRADED;
				message = 'Low cache hit rate';
			}

			return {
				details: {
					entries: stats.entries.length,
					hitRate: `${stats.hitRate.toFixed(1)}%`,
					size: stats.size,
					totalHits: stats.entries.reduce((sum, entry) => sum + entry.hits, 0)
				},
				lastCheck: new Date(),
				message,
				name: 'cache',
				responseTime,
				status
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			logger.error('Cache health check failed', 'health-service', {
				error: (error as Error).message,
				responseTime
			});

			return {
				lastCheck: new Date(),
				message: `Cache error: ${(error as Error).message}`,
				name: 'cache',
				responseTime,
				status: HealthStatus.UNHEALTHY
			};
		}
	}

	/**
	 * Check message queue health
	 */
	private async checkMessageQueue(): Promise<HealthCheck> {
		const startTime = Date.now();

		try {
			const stats = messageQueue.getStats();
			const responseTime = Date.now() - startTime;

			let status = HealthStatus.HEALTHY;
			let message = 'Message queue is healthy';

			// Check queue depth
			if (stats.pendingJobs > 1000) {
				status = HealthStatus.DEGRADED;
				message = 'High pending job count';
			}

			// Check worker health
			if (stats.failedJobs > stats.completedJobs * 0.1) {
				status = HealthStatus.DEGRADED;
				message = 'High failure rate in message queue';
			}

			return {
				details: {
					activeWorkers: stats.activeWorkers,
					avgProcessingTime: stats.avgProcessingTime,
					completedJobs: stats.completedJobs,
					failedJobs: stats.failedJobs,
					pendingJobs: stats.pendingJobs
				},
				lastCheck: new Date(),
				message,
				name: 'message_queue',
				responseTime,
				status
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			logger.error('Message queue health check failed', 'health-service', {
				error: (error as Error).message,
				responseTime
			});

			return {
				lastCheck: new Date(),
				message: `Message queue error: ${(error as Error).message}`,
				name: 'message_queue',
				responseTime,
				status: HealthStatus.UNHEALTHY
			};
		}
	}

	/**
	 * Check system health (memory, CPU, disk)
	 */
	private async checkSystem(): Promise<HealthCheck> {
		const startTime = Date.now();

		try {
			const memoryUsage = process.memoryUsage();
			const systemMemory = {
				free: os.freemem(),
				total: os.totalmem()
			};

			const cpuUsage = process.cpuUsage();
			const loadAverage = os.loadavg();

			const responseTime = Date.now() - startTime;

			// Calculate metrics
			const memoryUtilization =
				(memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
			const systemMemoryUtilization =
				((systemMemory.total - systemMemory.free) / systemMemory.total) * 100;

			let status = HealthStatus.HEALTHY;
			let message = 'System is healthy';

			// Check memory usage
			if (memoryUtilization > 90) {
				status = HealthStatus.UNHEALTHY;
				message = 'Critical memory usage';
			} else if (memoryUtilization > 75) {
				status = HealthStatus.DEGRADED;
				message = 'High memory usage';
			}

			// Check system memory
			if (systemMemoryUtilization > 95) {
				status = HealthStatus.UNHEALTHY;
				message = 'Critical system memory usage';
			} else if (systemMemoryUtilization > 85) {
				status = HealthStatus.DEGRADED;
				message = 'High system memory usage';
			}

			// Check load average
			const cpuCount = os.cpus().length;
			if (loadAverage && loadAverage[0] && loadAverage[0] > cpuCount * 2) {
				status = HealthStatus.DEGRADED;
				message = 'High system load';
			}

			return {
				details: {
					arch: os.arch(),
					cpuCount,
					loadAverage: loadAverage.map((load) => load.toFixed(2)),
					memory: {
						external: Math.round(memoryUsage.external / 1024 / 1024),
						heap: {
							total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
							used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
							utilization: `${memoryUtilization.toFixed(1)}%`
						},
						rss: Math.round(memoryUsage.rss / 1024 / 1024),
						system: {
							total: Math.round(systemMemory.total / 1024 / 1024),
							used: Math.round(
								(systemMemory.total - systemMemory.free) / 1024 / 1024
							),
							utilization: `${systemMemoryUtilization.toFixed(1)}%`
						}
					},
					nodeVersion: process.version,
					platform: os.platform(),
					uptime: process.uptime()
				},
				lastCheck: new Date(),
				message,
				name: 'system',
				responseTime,
				status
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			logger.error('System health check failed', 'health-service', {
				error: (error as Error).message,
				responseTime
			});

			return {
				lastCheck: new Date(),
				message: `System error: ${(error as Error).message}`,
				name: 'system',
				responseTime,
				status: HealthStatus.UNHEALTHY
			};
		}
	}

	/**
	 * Create a failed health check result
	 */
	private createFailedCheck(name: string, error: unknown): HealthCheck {
		return {
			lastCheck: new Date(),
			message: `Health check failed: ${error}`,
			name,
			status: HealthStatus.UNHEALTHY
		};
	}

	/**
	 * Determine overall system status based on individual checks
	 */
	private determineOverallStatus(checks: HealthCheck[]): HealthStatus {
		const unhealthyChecks = checks.filter(
			(c) => c.status === HealthStatus.UNHEALTHY
		);
		const degradedChecks = checks.filter(
			(c) => c.status === HealthStatus.DEGRADED
		);

		if (unhealthyChecks.length > 0) {
			return HealthStatus.UNHEALTHY;
		}

		if (degradedChecks.length > 0) {
			return HealthStatus.DEGRADED;
		}

		return HealthStatus.HEALTHY;
	}

	/**
	 * Get quick liveness check (for container orchestration)
	 */
	async getLivenessCheck(): Promise<{ status: string; timestamp: string }> {
		try {
			// Basic database ping
			await pool.query('SELECT 1');

			return {
				status: 'alive',
				timestamp: new Date().toISOString()
			};
		} catch {
			throw new Error('Service is not alive');
		}
	}

	/**
	 * Get readiness check (for container orchestration)
	 */
	async getReadinessCheck(): Promise<{ status: string; timestamp: string }> {
		try {
			// Check critical dependencies
			const [dbCheck, cacheCheck] = await Promise.allSettled([
				pool.query('SELECT 1'),
				this.checkCache()
			]);

			if (dbCheck.status === 'rejected') {
				throw new Error('Database not ready');
			}

			if (
				cacheCheck.status === 'rejected' ||
				(cacheCheck.status === 'fulfilled' &&
					cacheCheck.value.status === HealthStatus.UNHEALTHY)
			) {
				throw new Error('Cache not ready');
			}

			return {
				status: 'ready',
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			throw new Error(`Service not ready: ${(error as Error).message}`);
		}
	}

	/**
	 * Get system metrics for monitoring
	 */
	getSystemMetrics(): SystemMetrics {
		const memoryUsage = process.memoryUsage();
		const systemMemory = {
			free: os.freemem(),
			total: os.totalmem()
		};

		return {
			cache: {
				hitRate: cache.getStats().hitRate / 100,
				memoryUsed: 0, // Not available in current cache manager
				operations: cache.getStats().entries.length,
				size: cache.getStats().size
			},
			cpu: {
				count: os.cpus().length,
				loadAverage: os.loadavg(),
				usage: process.cpuUsage()
			},
			memory: {
				external: memoryUsage.external,
				heapTotal: memoryUsage.heapTotal,
				heapUsed: memoryUsage.heapUsed,
				rss: memoryUsage.rss,
				systemFree: systemMemory.free,
				systemTotal: systemMemory.total
			},
			messageQueue: messageQueue.getStats(),
			timestamp: new Date().toISOString(),
			uptime: process.uptime()
		};
	}
}

// Export singleton instance
export const healthService = new HealthService();
