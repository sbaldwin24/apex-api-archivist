#!/usr/bin/env node
/**
 * Redis Management Utility for Apex Data API
 *
 * Provides commands for managing Redis server, monitoring job queues,
 * and debugging cache issues.
 */

import Bull from 'bull';
import { execSync, spawn } from 'child_process';
import 'dotenv/config';
import Redis from 'ioredis';

class RedisManager {
	private redis: Redis;
	private scraperQueue: Bull.Queue;
	private analyticsQueue: Bull.Queue;
	private notificationQueue: Bull.Queue;

	constructor() {
		const redisOptions = {
			host: process.env.REDIS_HOST || 'localhost',
			lazyConnect: true,
			maxRetriesPerRequest: null,
			password: process.env.REDIS_PASSWORD,
			port: Number(process.env.REDIS_PORT || '6379')
		};

		this.redis = new Redis(redisOptions);
		this.scraperQueue = new Bull('scraper-queue', { redis: redisOptions });
		this.analyticsQueue = new Bull('analytics-queue', { redis: redisOptions });
		this.notificationQueue = new Bull('notification-queue', {
			redis: redisOptions
		});
	}

	/**
	 * Check Redis server status
	 */
	async status(): Promise<void> {
		console.log('🔍 Checking Redis Status...\n');

		try {
			/** Test connection */
			const pong = await this.redis.ping();
			console.log(`✅ Redis Connection: ${pong}`);

			/** Get server info */
			const info = await this.redis.info();
			const lines = info.split('\r\n');

			const redisVersion = lines
				.find((line) => line.startsWith('redis_version:'))
				?.split(':')[1];
			const uptime = lines
				.find((line) => line.startsWith('uptime_in_seconds:'))
				?.split(':')[1];
			const connectedClients = lines
				.find((line) => line.startsWith('connected_clients:'))
				?.split(':')[1];
			const usedMemory = lines
				.find((line) => line.startsWith('used_memory_human:'))
				?.split(':')[1];

			console.log(`📊 Server Info:`);
			console.log(`   Version: ${redisVersion}`);
			console.log(`   Uptime: ${Math.floor(Number(uptime || 0) / 3600)} hours`);
			console.log(`   Connected Clients: ${connectedClients}`);
			console.log(`   Memory Usage: ${usedMemory}`);
		} catch (error) {
			console.error(`❌ Redis Connection Failed: ${error}`);
		}
	}

	/**
	 * Monitor job queues.
	 */
	async queues(): Promise<void> {
		console.log('📋 Job Queue Status...\n');

		const queues = [
			{ name: 'Scraper Queue', queue: this.scraperQueue },
			{ name: 'Analytics Queue', queue: this.analyticsQueue },
			{ name: 'Notification Queue', queue: this.notificationQueue }
		];

		for (const { name, queue } of queues) {
			try {
				const waiting = await queue.getWaiting();
				const active = await queue.getActive();
				const completed = await queue.getCompleted();
				const failed = await queue.getFailed();

				console.log(`🚀 ${name}:`);
				console.log(`   Waiting: ${waiting.length}`);
				console.log(`   Active: ${active.length}`);
				console.log(`   Completed: ${completed.length}`);
				console.log(`   Failed: ${failed.length}`);

				if (active.length > 0) {
					console.log(`   📝 Active Jobs:`);

					active.forEach((job) => {
						console.log(
							`     - ${job.id}: ${job.name} (${job.progress()}% complete)`
						);
					});
				}

				if (failed.length > 0) {
					console.log(`   ❌ Recent Failures:`);

					failed.slice(0, 3).forEach((job) => {
						console.log(`     - ${job.id}: ${job.failedReason}`);
					});
				}

				console.log('');
			} catch (error) {
				console.error(`❌ Error checking ${name}: ${error}`);
			}
		}
	}

	/**
	 * Clear all job queues.
	 */
	async clearQueues(): Promise<void> {
		console.log('🧹 Clearing Job Queues...\n');

		const queues = [
			{ name: 'Scraper Queue', queue: this.scraperQueue },
			{ name: 'Analytics Queue', queue: this.analyticsQueue },
			{ name: 'Notification Queue', queue: this.notificationQueue }
		];

		for (const { name, queue } of queues) {
			try {
				await queue.empty();
				await queue.clean(0, 'active');
				await queue.clean(0, 'delayed');
				await queue.clean(0, 'completed');
				await queue.clean(0, 'failed');

				console.log(`✅ Cleared ${name}`);
			} catch (error) {
				console.error(`❌ Error clearing ${name}: ${error}`);
			}
		}
	}

	/**
	 * Show cache keys and stats.
	 */
	async cache(): Promise<void> {
		console.log('🗄️ Redis Cache Status...\n');

		try {
			/** Get all keys */
			const keys = await this.redis.keys('*');
			console.log(`📊 Total Keys: ${keys.length}\n`);

			/** Group by namespace */
			const namespaces: { [key: string]: string[] } = {};

			keys.forEach((key) => {
				const namespace = key.split(':')[0] || 'root';

				if (!namespaces[namespace]) {
					namespaces[namespace] = [];
				}

				namespaces[namespace].push(key);
			});

			/** Show namespace breakdown */
			console.log('📁 Namespaces:');

			Object.entries(namespaces).forEach(([namespace, namespaceKeys]) => {
				console.log(`   ${namespace}: ${namespaceKeys.length} keys`);

				/** Show sample keys */
				if (namespaceKeys.length > 0) {
					const samples = namespaceKeys.slice(0, 3);

					samples.forEach((key) => {
						console.log(`     - ${key} `);
					});

					if (namespaceKeys.length > 3) {
						console.log(`     ... and ${namespaceKeys.length - 3} more`);
					}
				}
			});

			/** Memory usage */
			const memory = await this.redis.memory('USAGE', keys[0] || 'nonexistent');
			if (memory && keys.length > 0) {
				console.log(`\n💾 Sample Key Memory: ${memory} bytes`);
			}
		} catch (error) {
			console.error(`❌ Error checking cache: ${error}`);
		}
	}

	/**
	 * Flush all cache data.
	 */
	async flushCache(): Promise<void> {
		console.log('🧹 Flushing Redis Cache...\n');

		try {
			await this.redis.flushall();

			console.log('✅ All cache data cleared');
		} catch (error) {
			console.error(`❌ Error flushing cache: ${error}`);
		}
	}

	/**
	 * Start Redis server.
	 */
	start(): void {
		console.log('🚀 Starting Redis Server...\n');

		try {
			execSync('brew services start redis', { stdio: 'inherit' });

			console.log('✅ Redis server started');
		} catch (error) {
			console.error(`❌ Failed to start Redis server: ${error}`);

			console.log('💡 Make sure Redis is installed: brew install redis');
		}
	}

	/**
	 * Stop Redis server
	 */
	stop(): void {
		console.log('🛑 Stopping Redis Server...\n');

		try {
			execSync('brew services stop redis', { stdio: 'inherit' });

			console.log('✅ Redis server stopped');
		} catch (error) {
			console.error(`❌ Failed to stop Redis server: ${error}`);
		}
	}

	/**
	 * Restart Redis server
	 */
	restart(): void {
		console.log('🔄 Restarting Redis Server...\n');

		this.stop();

		setTimeout(() => this.start(), 2000);
	}

	/**
	 * Monitor Redis in real-time
	 */
	async monitor(): Promise<void> {
		console.log('👁️ Starting Redis Monitor (Press Ctrl+C to stop)...\n');

		const monitor = spawn('redis-cli', ['monitor'], { stdio: 'inherit' });

		process.on('SIGINT', () => {
			monitor.kill();
			console.log('\n✅ Monitor stopped');
			process.exit(0);
		});
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		await this.redis.quit();
		await this.scraperQueue.close();
		await this.analyticsQueue.close();
		await this.notificationQueue.close();
	}
}

/** The CLI interface */
async function main() {
	const command = process.argv[2] || 'help';
	const manager = new RedisManager();

	try {
		switch (command) {
			case 'status':
				await manager.status();
				break;

			case 'queues':
				await manager.queues();
				break;

			case 'cache':
				await manager.cache();
				break;

			case 'clear-queues':
				await manager.clearQueues();
				break;

			case 'flush-cache':
				await manager.flushCache();
				break;

			case 'start':
				manager.start();
				return; // Don't cleanup for service commands

			case 'stop':
				manager.stop();
				return;

			case 'restart':
				manager.restart();
				return;

			case 'monitor':
				await manager.monitor();
				return;

			case 'help':
			default:
				console.log('🏁 Apex Redis Manager\n');
				console.log('Available commands:');
				console.log('  status        - Check Redis server status');
				console.log('  queues        - Monitor job queues');
				console.log('  cache         - Show cache keys and stats');
				console.log('  clear-queues  - Clear all job queues');
				console.log('  flush-cache   - Clear all cache data');
				console.log('  start         - Start Redis server');
				console.log('  stop          - Stop Redis server');
				console.log('  restart       - Restart Redis server');
				console.log('  monitor       - Real-time Redis monitoring');
				console.log('  help          - Show this help');
				break;
		}
	} catch (error) {
		console.error(`❌ Command failed: ${error}`);
	} finally {
		await manager.cleanup();
	}
}

/** Run CLI if called directly */
if (require.main === module) {
	main().catch((error) => {
		console.error('❌ Fatal error:', error);

		process.exit(1);
	});
}

export default RedisManager;

/*
Usage Examples:

# Check Redis status
pnpm dlx ts-node redis-manager.ts status

# Monitor job queues
pnpm dlx ts-node redis-manager.ts queues

# Check cache
pnpm dlx ts-node redis-manager.ts cache

# Clear all queues
pnpm dlx ts-node redis-manager.ts clear-queues

# Server management
pnpm dlx ts-node redis-manager.ts start
pnpm dlx ts-node redis-manager.ts stop
pnpm dlx ts-node redis-manager.ts restart

# Real-time monitoring
pnpm dlx ts-node redis-manager.ts monitor
*/
