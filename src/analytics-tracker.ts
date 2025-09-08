import { pool } from './database';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('analytics');

export interface UserEvent {
	userId: string;
	apiKey: string;
	event: string;
	properties: Record<string, any>;
	timestamp: string;
}

export interface CustomerMetrics {
	totalCustomers: number;
	activeCustomers: number;
	newSignups: number;
	churnedCustomers: number;
	churnRate: number;
	retentionRate: number;
	lifetimeValue: number;
}

export class AnalyticsTracker {
	async trackEvent(event: UserEvent): Promise<void> {
		try {
			await pool.query(
				`
				INSERT INTO user_events (user_id, api_key, event_name, properties, timestamp)
				VALUES ($1, $2, $3, $4, $5)
			`,
				[
					event.userId,
					event.apiKey,
					event.event,
					JSON.stringify(event.properties),
					event.timestamp
				]
			);

			logger.debug('Event tracked', 'analytics', {
				event: event.event,
				userId: event.userId
			});
		} catch (error) {
			logger.error('Failed to track event', 'analytics', {
				error: (error as Error).message
			});
		}
	}

	async getCustomerMetrics(
		startDate: string,
		endDate: string
	): Promise<CustomerMetrics> {
		/** Total and active customers */
		const customerResult = await pool.query(
			`
			SELECT 
				COUNT(DISTINCT ak.key_value) as total_customers,
				COUNT(DISTINCT CASE WHEN au.timestamp >= $1 THEN ak.key_value END) as active_customers
			FROM api_keys ak
			LEFT JOIN api_usage au ON ak.key_value = au.api_key
			WHERE ak.created_at <= $2
		`,
			[startDate, endDate]
		);

		/** New signups in period */
		const signupResult = await pool.query(
			`
			SELECT COUNT(*) as new_signups
			FROM api_keys 
			WHERE created_at BETWEEN $1 AND $2
		`,
			[startDate, endDate]
		);

		/** Calculate retention (simplified) */
		const retentionResult = await pool.query(
			`
			SELECT 
				COUNT(DISTINCT ak.key_value) as retained_customers
			FROM api_keys ak
			JOIN api_usage au ON ak.key_value = au.api_key
			WHERE ak.created_at < $1
			AND au.timestamp BETWEEN $1 AND $2
		`,
			[startDate, endDate]
		);

		const totalCustomers = Number(
			customerResult.rows[0]?.total_customers || '0'
		);
		const activeCustomers = Number(
			customerResult.rows[0]?.active_customers || '0'
		);
		const newSignups = Number(signupResult.rows[0]?.new_signups || '0');
		const retainedCustomers = Number(
			retentionResult.rows[0]?.retained_customers || '0'
		);

		return {
			activeCustomers,
			churnedCustomers: 0, // Calculate based on inactive users
			churnRate: totalCustomers > 0 ? (0 / totalCustomers) * 100 : 0, // Calculate actual churn rate
			lifetimeValue: 0, // Calculate based on revenue data
			newSignups,
			retentionRate:
				totalCustomers > 0 ? (retainedCustomers / totalCustomers) * 100 : 0,
			totalCustomers
		};
	}

	async getPopularEndpoints(limit: number = 10): Promise<
		Array<{
			endpoint: string;
			requestCount: number;
			uniqueUsers: number;
			avgResponseTime: number;
		}>
	> {
		const result = await pool.query(
			`
			SELECT 
				endpoint,
				COUNT(*) as request_count,
				COUNT(DISTINCT api_key) as unique_users,
				AVG(response_time) as avg_response_time
			FROM api_usage 
			WHERE timestamp >= NOW() - INTERVAL '30 days'
			GROUP BY endpoint
			ORDER BY request_count DESC
			LIMIT $1
		`,
			[limit]
		);

		return result.rows.map((row) => ({
			avgResponseTime: parseFloat(row.avg_response_time),
			endpoint: row.endpoint,
			requestCount: Number(row.request_count),
			uniqueUsers: Number(row.unique_users)
		}));
	}

	async getUserJourney(apiKey: string): Promise<
		Array<{
			event: string;
			timestamp: string;
			properties: any;
		}>
	> {
		const result = await pool.query(
			`
			SELECT event_name, timestamp, properties
			FROM user_events 
			WHERE api_key = $1
			ORDER BY timestamp DESC
			LIMIT 50
		`,
			[apiKey]
		);

		return result.rows.map((row) => ({
			event: row.event_name,
			properties: JSON.parse(row.properties || '{}'),
			timestamp: row.timestamp
		}));
	}

	async getConversionFunnel(): Promise<{
		signups: number;
		firstApiCall: number;
		paidUpgrade: number;
		conversionRate: number;
	}> {
		/** Signups */
		const signupResult = await pool.query(`
			SELECT COUNT(*) as signups
			FROM api_keys 
			WHERE created_at >= NOW() - INTERVAL '30 days'
		`);

		/** First API call */
		const firstCallResult = await pool.query(`
			SELECT COUNT(DISTINCT ak.key_value) as first_calls
			FROM api_keys ak
			JOIN api_usage au ON ak.key_value = au.api_key
			WHERE ak.created_at >= NOW() - INTERVAL '30 days'
		`);

		/** Paid upgrades */
		const upgradeResult = await pool.query(`
			SELECT COUNT(*) as upgrades
			FROM api_keys 
			WHERE billing_plan != 'free'
			AND created_at >= NOW() - INTERVAL '30 days'
		`);

		const signups = parseInt(signupResult.rows[0]?.signups || '0', 10);
		const firstApiCall = parseInt(
			firstCallResult.rows[0]?.first_calls || '0',
			10
		);
		const paidUpgrade = parseInt(upgradeResult.rows[0]?.upgrades || '0', 10);

		return {
			conversionRate: signups > 0 ? (paidUpgrade / signups) * 100 : 0,
			firstApiCall,
			paidUpgrade,
			signups
		};
	}
}
