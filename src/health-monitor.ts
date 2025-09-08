import { pool } from './database';

export interface HealthStatus {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	checks: {
		database: boolean;
		crawlServer: boolean;
		diskSpace: boolean;
		memory: boolean;
	};
	metrics: {
		successRate: number;
		avgResponseTime: number;
		activeConnections: number;
		memoryUsage: number;
	};
}

export class HealthMonitor {
	private metrics = {
		lastHealthCheck: 0,
		successfulRequests: 0,
		totalRequests: 0,
		totalResponseTime: 0
	};

	async getHealthStatus(): Promise<HealthStatus> {
		const checks = {
			crawlServer: await this.checkCrawlServer(),
			database: await this.checkDatabase(),
			diskSpace: await this.checkDiskSpace(),
			memory: await this.checkMemory()
		};

		const successRate =
			this.metrics.totalRequests > 0
				? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
				: 100;

		const avgResponseTime =
			this.metrics.totalRequests > 0
				? this.metrics.totalResponseTime / this.metrics.totalRequests
				: 0;

		const memoryUsage = process.memoryUsage();
		const memoryUsagePercent =
			(memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

		const allHealthy = Object.values(checks).every((check) => check);
		const status = allHealthy
			? 'healthy'
			: checks.database && checks.crawlServer
				? 'degraded'
				: 'unhealthy';

		return {
			checks,
			metrics: {
				activeConnections: pool.totalCount,
				avgResponseTime: Math.round(avgResponseTime),
				memoryUsage: Math.round(memoryUsagePercent * 100) / 100,
				successRate: Math.round(successRate * 100) / 100
			},
			status,
			timestamp: new Date().toISOString()
		};
	}

	recordRequest(success: boolean, responseTime: number): void {
		this.metrics.totalRequests++;
		this.metrics.totalResponseTime += responseTime;

		if (success) {
			this.metrics.successfulRequests++;
		}
	}

	private async checkDatabase(): Promise<boolean> {
		try {
			const result = await pool.query('SELECT 1');
			return result.rows.length > 0;
		} catch (error) {
			console.error('Database health check failed:', error);
			return false;
		}
	}

	private async checkCrawlServer(): Promise<boolean> {
		try {
			const response = await fetch('http://localhost:11235/health', {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});

			return response.ok;
		} catch (error) {
			console.error('Crawl server health check failed:', error);

			return false;
		}
	}

	private async checkDiskSpace(): Promise<boolean> {
		try {
			const stats = await import('fs').then((fs) => fs.promises.stat('.'));
			/** Simple check - assume healthy if we can stat current directory */
			return true;
		} catch (error) {
			return false;
		}
	}

	private async checkMemory(): Promise<boolean> {
		const memoryUsage = process.memoryUsage();
		const memoryUsagePercent =
			(memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

		/** Consider unhealthy if using more than 90% of heap */
		return memoryUsagePercent < 90;
	}

	startPeriodicHealthChecks(intervalMs: number = 60000): void {
		setInterval(async () => {
			const health = await this.getHealthStatus();

			if (health.status !== 'healthy') {
				console.warn(`🚨 System health: ${health.status.toUpperCase()}`);
				console.warn(`   Database: ${health.checks.database ? '✅' : '❌'}`);
				console.warn(
					`   Crawl Server: ${health.checks.crawlServer ? '✅' : '❌'}`
				);
				console.warn(`   Memory: ${health.metrics.memoryUsage}%`);
			}
		}, intervalMs);
	}
}
