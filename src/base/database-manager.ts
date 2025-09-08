import { Pool, type PoolClient } from 'pg';
import { StructuredLogger } from '../structured-logger';
import ConfigManager from './config-manager';

/**
 * Database connection manager for handling PostgreSQL connections
 */
export class DatabaseManager {
	private static instance: DatabaseManager;
	private pool: Pool | null = null;
	private logger: StructuredLogger;

	private constructor() {
		this.logger = new StructuredLogger('database-manager');
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): DatabaseManager {
		if (!DatabaseManager.instance) {
			DatabaseManager.instance = new DatabaseManager();
		}
		return DatabaseManager.instance;
	}

	/**
	 * Get database pool (for backward compatibility)
	 */
	public static getPool(): Pool {
		return DatabaseManager.getInstance().getPool();
	}

	/**
	 * Initialize database connection pool
	 */
	public async initialize(): Promise<void> {
		if (this.pool) {
			this.logger.warn('Database pool already initialized', 'initialization');
			return;
		}

		try {
			const config = {
				connectionTimeoutMillis: ConfigManager.getDatabaseConnectionTimeout(),
				database: ConfigManager.getDatabaseName(),
				host: ConfigManager.getDatabaseHost(),
				idleTimeoutMillis: ConfigManager.getDatabaseIdleTimeout(),
				max: ConfigManager.getDatabaseMaxConnections(),
				password: ConfigManager.getDatabasePassword(),
				port: ConfigManager.getDatabasePort(),
				ssl: ConfigManager.getDatabaseSSL(),
				user: ConfigManager.getDatabaseUser()
			};

			this.pool = new Pool(config);

			// Test connection
			const client = await this.pool.connect();
			await client.query('SELECT 1');
			client.release();

			this.logger.info(
				'Database pool initialized successfully',
				'initialization'
			);
		} catch (error: any) {
			this.logger.error(
				'Failed to initialize database pool',
				'initialization',
				{
					error: error.message
				}
			);
			throw error;
		}
	}

	/**
	 * Get database pool
	 */
	public getPool(): Pool {
		if (!this.pool) {
			throw new Error(
				'Database pool not initialized. Call initialize() first.'
			);
		}
		return this.pool;
	}

	/**
	 * Get a client from the pool
	 */
	public async getClient(): Promise<PoolClient> {
		return await this.getPool().connect();
	}

	/**
	 * Execute a query with automatic connection management
	 */
	public async query(text: string, params?: any[]): Promise<any> {
		const client = await this.getClient();
		try {
			const result = await client.query(text, params);
			return result;
		} finally {
			client.release();
		}
	}

	/**
	 * Execute a transaction
	 */
	public async transaction<T>(
		callback: (client: PoolClient) => Promise<T>
	): Promise<T> {
		const client = await this.getClient();
		try {
			await client.query('BEGIN');
			const result = await callback(client);
			await client.query('COMMIT');
			return result;
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Close database pool
	 */
	public async close(): Promise<void> {
		if (this.pool) {
			await this.pool.end();
			this.pool = null;
			this.logger.info('Database pool closed', 'cleanup');
		}
	}

	/**
	 * Get pool statistics
	 */
	public getStats(): any {
		if (!this.pool) {
			return null;
		}

		return {
			idleCount: this.pool.idleCount,
			totalCount: this.pool.totalCount,
			waitingCount: this.pool.waitingCount
		};
	}

	/**
	 * Health check for database connection
	 */
	public async healthCheck(): Promise<{ status: string; details: any }> {
		try {
			const start = Date.now();
			await this.query('SELECT 1');
			const duration = Date.now() - start;

			return {
				details: {
					responseTime: duration,
					stats: this.getStats()
				},
				status: 'healthy'
			};
		} catch (error: any) {
			return {
				details: {
					error: error.message,
					stats: this.getStats()
				},
				status: 'unhealthy'
			};
		}
	}
}

export default DatabaseManager;
