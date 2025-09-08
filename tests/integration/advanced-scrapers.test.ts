import type { Pool } from 'pg';
import { DatabaseManager } from '../../src/base/database-manager';
import { ScraperManager } from '../../src/base/scraper-manager';
import { CompleteROIScraper } from '../../src/complete-roi-scraper';
import { PerformanceDataScraper } from '../../src/performance-scraper';

/** Integration tests that require actual database connections and schema setup */
describe('Advanced Scrapers Integration Tests', () => {
	let db: Pool;

	beforeAll(async () => {
		/** Setup test database - this would normally be handled by test helpers */
		db = DatabaseManager.getPool();

		/** Create test schemas if they don't exist */
		await createTestSchemas();
	});

	afterAll(async () => {
		/** Cleanup test data */
		await cleanupTestData();

		/** Close database connections */
		if (db) {
			await db.end();
		}
	});

	describe('PerformanceDataScraper Integration', () => {
		let scraper: PerformanceDataScraper;

		beforeEach(() => {
			scraper = new PerformanceDataScraper();
		});

		it('should successfully scrape and store performance data to database', async () => {
			/** Execute the full scraping process */
			const result = await scraper.scrape();

			/** Verify successful execution */
			expect(result.success).toBe(true);
			expect(result.message).toContain(
				'Performance data scraping completed successfully'
			);
			expect(result.data).toBeDefined();
			expect(result.summary).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);

			/** Verify data was actually stored in database */
			const telemetryCount = await db.query(
				"SELECT COUNT(*) FROM telemetry_data WHERE created_at > NOW() - INTERVAL '1 minute'"
			);
			const tireStrategyCount = await db.query(
				"SELECT COUNT(*) FROM tire_strategy WHERE created_at > NOW() - INTERVAL '1 minute'"
			);
			const fuelDataCount = await db.query(
				"SELECT COUNT(*) FROM fuel_data WHERE created_at > NOW() - INTERVAL '1 minute'"
			);
			const carSetupCount = await db.query(
				"SELECT COUNT(*) FROM car_setup WHERE created_at > NOW() - INTERVAL '1 minute'"
			);

			expect(Number(telemetryCount.rows[0].count)).toBeGreaterThan(0);
			expect(Number(tireStrategyCount.rows[0].count)).toBeGreaterThan(0);
			expect(Number(fuelDataCount.rows[0].count)).toBeGreaterThan(0);
			expect(Number(carSetupCount.rows[0].count)).toBeGreaterThan(0);
		}, 60000); // 60 second timeout for integration test

		it('should generate accurate performance correlations', async () => {
			/** Execute scraping to generate data */
			await scraper.scrape();

			/** Query the generated correlations */
			const correlationsQuery = `
        SELECT * FROM performance_correlations 
        WHERE created_at > NOW() - INTERVAL '1 minute'
        ORDER BY correlation_strength DESC
      `;
			const correlations = await db.query(correlationsQuery);

			expect(correlations.rows.length).toBeGreaterThan(0);

			/** Verify correlation data structure */
			const correlation = correlations.rows[0];
			expect(correlation).toHaveProperty('correlation_id');
			expect(correlation).toHaveProperty('factor_one');
			expect(correlation).toHaveProperty('factor_two');
			expect(correlation).toHaveProperty('correlation_strength');
			expect(correlation.correlation_strength).toBeGreaterThanOrEqual(-1);
			expect(correlation.correlation_strength).toBeLessThanOrEqual(1);
		});

		it('should handle schema dependencies correctly', async () => {
			/** Verify required tables exist */
			const requiredTables = [
				'telemetry_data',
				'tire_strategy',
				'fuel_data',
				'car_setup',
				'radio_communications',
				'performance_correlations'
			];

			for (const table of requiredTables) {
				const tableExists = await db.query(
					`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `,
					[table]
				);

				expect(tableExists.rows[0].exists).toBe(true);
			}
		});
	});

	describe('CompleteROIScraper Integration', () => {
		let scraper: CompleteROIScraper;

		beforeEach(() => {
			scraper = new CompleteROIScraper();
		});

		it('should successfully execute complete ROI analysis and store results', async () => {
			/** Execute the full ROI analysis */
			const result = await scraper.scrape();

			/** Verify successful execution */
			expect(result.success).toBe(true);
			expect(result.message).toContain(
				'Complete ROI analysis completed successfully'
			);
			expect(result.data).toBeDefined();
			expect(result.summary).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);

			/** Verify comprehensive data counts */
			expect(result.data).toMatchObject({
				abTestResults: expect.any(Number),
				attributionModels: expect.any(Number),
				clvAnalysis: expect.any(Number),
				competitiveIntel: expect.any(Number),
				geoTargetingData: expect.any(Number),
				optimizationRecs: expect.any(Number),
				predictiveModels: expect.any(Number),
				roiBenchmarks: expect.any(Number),
				roiCalculations: expect.any(Number),
				sentimentData: expect.any(Number)
			});

			/** Verify summary structure */
			expect(result.summary).toHaveProperty('overall_roi');
			expect(result.summary).toHaveProperty('total_investment');
			expect(result.summary).toHaveProperty('total_revenue');
			expect(result.summary).toHaveProperty('channel_performance');
			expect(result.summary).toHaveProperty('predictive_insights');
			expect(result.summary).toHaveProperty('optimization_opportunities');
		}, 120000); // 2 minute timeout for complex integration test

		it('should store predictive models with correct ML metadata', async () => {
			await scraper.scrape();

			/** Query the predictive models */
			const modelsQuery = `
        SELECT * FROM predictive_models 
        WHERE created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY accuracy DESC
      `;
			const models = await db.query(modelsQuery);

			expect(models.rows.length).toBeGreaterThan(0);

			/** Verify model structure */
			const model = models.rows[0];
			expect(model).toHaveProperty('model_id');
			expect(model).toHaveProperty('model_type');
			expect(model).toHaveProperty('target_metric');
			expect(model).toHaveProperty('accuracy');
			expect(model).toHaveProperty('confidence');
			expect(model.accuracy).toBeGreaterThan(0);
			expect(model.accuracy).toBeLessThanOrEqual(1);
			expect(model.confidence).toBeGreaterThan(0);
			expect(model.confidence).toBeLessThanOrEqual(1);
		});

		it('should generate actionable optimization recommendations', async () => {
			await scraper.scrape();

			/** Query optimization recommendations */
			const recommendationsQuery = `
        SELECT * FROM roi_optimization_recommendations 
        WHERE created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END,
          roi_improvement DESC
      `;
			const recommendations = await db.query(recommendationsQuery);

			expect(recommendations.rows.length).toBeGreaterThan(0);

			/** Verify recommendation structure */
			const rec = recommendations.rows[0];
			expect(rec).toHaveProperty('recommendation_id');
			expect(rec).toHaveProperty('category');
			expect(rec).toHaveProperty('priority');
			expect(rec).toHaveProperty('description');
			expect(rec).toHaveProperty('roi_improvement');
			expect(rec).toHaveProperty('revenue_increase');
			expect(rec).toHaveProperty('implementation_effort');
			expect(rec.roi_improvement).toBeGreaterThan(0);
			expect(['high', 'medium', 'low']).toContain(rec.priority);
		});

		it('should calculate multi-touch attribution correctly', async () => {
			await scraper.scrape();

			/** Query advanced ROI calculations */
			const calculationsQuery = `
        SELECT * FROM advanced_roi_calculations 
        WHERE created_at > NOW() - INTERVAL '2 minutes'
        AND model_type = 'multi_touch_attribution'
      `;
			const calculations = await db.query(calculationsQuery);

			expect(calculations.rows.length).toBeGreaterThan(0);

			/** Verify calculation structure */
			const calc = calculations.rows[0];
			expect(calc).toHaveProperty('calculation_id');
			expect(calc).toHaveProperty('attribution_model');
			expect(calc).toHaveProperty('channels');
			expect(calc).toHaveProperty('cross_channel_effects');
			expect(calc).toHaveProperty('incremental_lift');

			/** Parse and verify channels JSON */
			const channels = JSON.parse(calc.channels);
			expect(Array.isArray(channels)).toBe(true);
			expect(channels.length).toBeGreaterThan(0);
			expect(channels[0]).toHaveProperty('channel_name');
			expect(channels[0]).toHaveProperty('investment');
			expect(channels[0]).toHaveProperty('revenue');
			expect(channels[0]).toHaveProperty('roi');
		});

		it('should handle schema dependencies and constraints', async () => {
			/** Verify required tables exist for complete ROI analysis */
			const requiredTables = [
				'predictive_models',
				'real_time_sentiment',
				'ab_test_results',
				'geo_targeting_analysis',
				'advanced_roi_calculations',
				'attribution_models',
				'clv_analysis',
				'competitive_intelligence',
				'roi_optimization_recommendations',
				'roi_benchmarks'
			];

			for (const table of requiredTables) {
				const tableExists = await db.query(
					`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `,
					[table]
				);

				expect(tableExists.rows[0].exists).toBe(true);
			}
		});
	});

	describe('ScraperManager Integration', () => {
		let scraperManager: ScraperManager;

		beforeEach(() => {
			scraperManager = new ScraperManager();

			/** Register our test scrapers */
			scraperManager.registerScrapers([
				{
					description: 'Performance data scraper for integration testing',
					enabled: true,
					factory: () => new PerformanceDataScraper(),
					name: 'performance-data',
					priority: 3,
					schemas: ['core', 'performance']
				},
				{
					dependencies: ['financial-data', 'broadcast-metrics'],
					description: 'Complete ROI analysis scraper for integration testing',
					enabled: true,
					factory: () => new CompleteROIScraper(),
					name: 'complete-roi',
					priority: 4,
					schemas: ['core', 'financial', 'broadcast-metrics', 'complete-roi']
				}
			]);
		});

		it('should run both scrapers in sequence with proper dependency management', async () => {
			const results = await scraperManager.runScrapers(
				['performance-data', 'complete-roi'],
				{
					continueOnError: false,
					dryRun: false,
					maxConcurrency: 1,
					parallel: false
				}
			);

			/** Verify both scrapers completed successfully */
			expect(results.length).toBe(2);
			expect(results[0]?.success).toBe(true);
			expect(results[1]?.success).toBe(true);
			expect(results[0]?.scraperName).toBe('performance-data');
			expect(results[1]?.scraperName).toBe('complete-roi');
		}, 180000); // 3 minute timeout for sequential execution

		it('should handle scraper failures gracefully', async () => {
			/** Register a scraper that will fail */
			scraperManager.registerScrapers([
				{
					description: 'A scraper designed to fail for testing',
					enabled: true,
					factory: () =>
						({
							scrape: async () => {
								throw new Error('Intentional test failure');
							}
						}) as any,
					name: 'failing-scraper',
					priority: 1,
					schemas: []
				}
			]);

			const results = await scraperManager.runScrapers(['failing-scraper'], {
				continueOnError: true,
				dryRun: false,
				maxConcurrency: 1,
				parallel: false
			});

			expect(results.length).toBe(1);
			expect(results[0]?.success).toBe(false);
			expect(results[0]?.error).toContain('Intentional test failure');
		});
	});

	describe('Cross-Scraper Data Consistency', () => {
		it('should maintain data consistency between performance and ROI analysis', async () => {
			/** Run performance scraper first */
			const performanceScraper = new PerformanceDataScraper();

			const performanceResult = await performanceScraper.scrape();
			expect(performanceResult.success).toBe(true);

			/** Run complete ROI scraper */
			const roiScraper = new CompleteROIScraper();

			const roiResult = await roiScraper.scrape();
			expect(roiResult.success).toBe(true);

			/** Verify data consistency - both should have overlapping time periods */
			const performanceDataQuery = `
        SELECT MIN(created_at) as earliest, MAX(created_at) as latest
        FROM telemetry_data 
        WHERE created_at > NOW() - INTERVAL '10 minutes'
      `;

			const roiDataQuery = `
        SELECT MIN(created_at) as earliest, MAX(created_at) as latest
        FROM predictive_models 
        WHERE created_at > NOW() - INTERVAL '10 minutes'
      `;

			const [perfTimes, roiTimes] = await Promise.all([
				db.query(performanceDataQuery),
				db.query(roiDataQuery)
			]);

			expect(perfTimes.rows[0].earliest).toBeDefined();
			expect(roiTimes.rows[0].earliest).toBeDefined();

			/** Both scrapers should have created data within the same general timeframe */
			const timeDiff = Math.abs(
				new Date(perfTimes.rows[0].latest).getTime() -
					new Date(roiTimes.rows[0].latest).getTime()
			);

			expect(timeDiff).toBeLessThan(300000); // Within 5 minutes
		}, 300000); // 5 minute timeout
	});

	/** Helper functions */
	async function createTestSchemas(): Promise<void> {
		/** In a real test environment, this would create the necessary schemas
		/** For now, we assume they exist from the main schema files */
		try {
			await db.query('SELECT 1 FROM telemetry_data LIMIT 1');
			await db.query('SELECT 1 FROM predictive_models LIMIT 1');
		} catch (error) {
			console.warn('Test schemas may not be fully set up:', error);
		}
	}

	async function cleanupTestData(): Promise<void> {
		/** Clean up test data created during integration tests */
		const tables = [
			'telemetry_data',
			'tire_strategy',
			'fuel_data',
			'car_setup',
			'radio_communications',
			'performance_correlations',
			'predictive_models',
			'real_time_sentiment',
			'ab_test_results',
			'geo_targeting_analysis',
			'advanced_roi_calculations',
			'attribution_models',
			'clv_analysis',
			'competitive_intelligence',
			'roi_optimization_recommendations',
			'roi_benchmarks'
		];

		for (const table of tables) {
			try {
				await db.query(
					`DELETE FROM ${table} WHERE created_at > NOW() - INTERVAL '10 minutes'`
				);
			} catch (error) {
				console.warn(`Could not clean up table ${table}:`, error);
			}
		}
	}
});
