import { pool } from './database';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('billing');

export interface UsageRecord {
	apiKey: string;
	endpoint: string;
	timestamp: string;
	responseTime: number;
	dataSize: number;
	tier: string;
}

export interface BillingPlan {
	id: string;
	name: string;
	monthlyFee: number;
	requestsIncluded: number | undefined;
	overageRate: number; // per request
	features: string[];
}

export const BILLING_PLANS: Record<string, BillingPlan> = {
	enterprise: {
		features: ['unlimited_api', 'custom_endpoints', 'dedicated_support', 'sla'],
		id: 'enterprise',
		monthlyFee: 499,
		name: 'Enterprise',
		overageRate: 0.001,
		requestsIncluded: 1000000
	},
	free: {
		features: ['basic_api', 'rate_limited'],
		id: 'free',
		monthlyFee: 0,
		name: 'Free Tier',
		overageRate: 0, // No overage allowed
		requestsIncluded: 1000
	},
	professional: {
		features: ['full_api', 'webhooks', 'priority_support', 'analytics'],
		id: 'professional',
		monthlyFee: 99,
		name: 'Professional',
		overageRate: 0.002,
		requestsIncluded: 100000
	},
	starter: {
		features: ['basic_api', 'premium_endpoints', 'email_support'],
		id: 'starter',
		monthlyFee: 29,
		name: 'Starter',
		overageRate: 0.003, // $0.003 per request
		requestsIncluded: 10000
	}
};

export class BillingEngine {
	async recordUsage(usage: UsageRecord): Promise<void> {
		try {
			await pool.query(
				`
				INSERT INTO api_usage (api_key, endpoint, timestamp, response_time, data_size, tier)
				VALUES ($1, $2, $3, $4, $5, $6)
			`,
				[
					usage.apiKey,
					usage.endpoint,
					usage.timestamp,
					usage.responseTime,
					usage.dataSize,
					usage.tier
				]
			);
		} catch (error) {
			logger.error('Failed to record usage', 'billing', {
				error: (error as Error).message
			});
		}
	}

	async calculateMonthlyBill(
		apiKey: string,
		year: number,
		month: number
	): Promise<{
		plan: BillingPlan | undefined;
		requestCount: number;
		overageRequests: number;
		baseFee: number | undefined;
		overageFee: number | undefined;
		totalFee: number | undefined;
	}> {
		/** Get user's plan */
		const userResult = await pool.query(
			`
			SELECT billing_plan FROM api_keys WHERE key_value = $1
		`,
			[apiKey]
		);

		const planId = userResult.rows[0]?.billing_plan || 'free';
		const plan = BILLING_PLANS[planId];

		/** Get usage for the month */
		const usageResult = await pool.query(
			`
			SELECT COUNT(*) as request_count
			FROM api_usage 
			WHERE api_key = $1 
			AND EXTRACT(YEAR FROM timestamp::timestamp) = $2
			AND EXTRACT(MONTH FROM timestamp::timestamp) = $3
		`,
			[apiKey, year, month]
		);

		const requestCount = Number(
			usageResult.rows[0]?.request_count || '0'
		);
		const overageRequests = Math.max(
			0,
			requestCount - (plan?.requestsIncluded || 0)
		);
		const overageFee = overageRequests * (plan?.overageRate || 0);
		const totalFee = (plan?.monthlyFee || 0) + overageFee;

		return {
			baseFee: plan?.monthlyFee,
			overageFee,
			overageRequests,
			plan,
			requestCount,
			totalFee
		};
	}

	async getRevenueMetrics(
		startDate: string,
		endDate: string
	): Promise<{
		totalRevenue: number;
		newCustomers: number;
		churnRate: number;
		avgRevenuePerUser: number;
		planDistribution: Record<string, number>;
	}> {
		/** Calculate total revenue */
		const revenueResult = await pool.query(
			`
			SELECT 
				SUM(total_amount) as total_revenue,
				COUNT(DISTINCT api_key) as active_customers
			FROM billing_invoices 
			WHERE created_at BETWEEN $1 AND $2
		`,
			[startDate, endDate]
		);

		/** Get plan distribution */
		const planResult = await pool.query(
			`
			SELECT billing_plan, COUNT(*) as count
			FROM api_keys 
			WHERE created_at <= $1
			GROUP BY billing_plan
		`,
			[endDate]
		);

		const totalRevenue = parseFloat(
			revenueResult.rows[0]?.total_revenue || '0'
		);
		const activeCustomers = Number(
			revenueResult.rows[0]?.active_customers || '0'
		);

		const planDistribution: Record<string, number> = {};
		planResult.rows.forEach((row) => {
			planDistribution[row.billing_plan] = Number(row.count);
		});

		return {
			avgRevenuePerUser:
				activeCustomers > 0 ? totalRevenue / activeCustomers : 0,
			churnRate: 0, // Calculate based on cancellations
			newCustomers: 0, // Calculate based on creation dates
			planDistribution,
			totalRevenue
		};
	}

	async suggestPlanUpgrade(apiKey: string): Promise<{
		currentPlan: string;
		suggestedPlan: string;
		potentialSavings: number;
		reason: string;
	} | null> {
		/** Get current usage pattern */
		const usageResult = await pool.query(
			`
			SELECT 
				COUNT(*) as monthly_requests,
				billing_plan
			FROM api_usage au
			JOIN api_keys ak ON au.api_key = ak.key_value
			WHERE au.api_key = $1 
			AND au.timestamp >= NOW() - INTERVAL '30 days'
			GROUP BY billing_plan
		`,
			[apiKey]
		);

		if (usageResult.rows.length === 0) return null;

		const monthlyRequests = parseInt(usageResult.rows[0].monthly_requests, 10);
		const currentPlan = usageResult.rows[0].billing_plan;

		/** Calculate costs for each plan */
		const costs = Object.entries(BILLING_PLANS).map(([planId, plan]) => {
			const overageRequests = Math.max(
				0,
				monthlyRequests - (plan?.requestsIncluded || 0)
			);
			const totalCost =
				(plan?.monthlyFee || 0) + overageRequests * (plan?.overageRate || 0);
			return { planId, totalCost };
		});

		/** Find optimal plan */
		const currentCost =
			costs.find((c) => c.planId === currentPlan)?.totalCost || 0;
		const optimalPlan = costs.reduce((min, current) =>
			current.totalCost < min.totalCost ? current : min
		);

		if (
			optimalPlan.planId !== currentPlan &&
			optimalPlan.totalCost < currentCost
		) {
			return {
				currentPlan,
				potentialSavings: currentCost - optimalPlan.totalCost,
				reason: `Based on ${monthlyRequests} monthly requests`,
				suggestedPlan: optimalPlan.planId
			};
		}

		return null;
	}
}
