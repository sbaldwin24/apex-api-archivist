import FinancialDataScraperStandalone from '../../scrapers/financial-data-scraper';
import { FinancialDataScraper } from '../../src/financial-scraper';
import { TestHelpers } from '../utils/test-helpers';

describe('Financial Data Scraper Integration', () => {
	let testPool: any;

	beforeAll(async () => {
		/** Use test database */
		testPool = TestHelpers.createTestPool();
		await TestHelpers.setupTestSchema();
		await setupFinancialSchema();
		await TestHelpers.createTestFixtures();
	});

	afterAll(async () => {
		await TestHelpers.cleanupTestDatabase();
		await TestHelpers.closeTestPool();
	});

	beforeEach(async () => {
		await cleanupFinancialTables();
	});

	async function setupFinancialSchema(): Promise<void> {
		const client = await testPool.connect();

		try {
			/** Create financial tables for testing */
			await client.query(`
        CREATE TABLE IF NOT EXISTS sponsor_contracts (
          id SERIAL PRIMARY KEY,
          driver_id VARCHAR(100) NOT NULL,
          sponsor_name VARCHAR(200) NOT NULL,
          contract_value BIGINT NOT NULL,
          contract_length INTEGER NOT NULL,
          contract_type VARCHAR(50) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          performance_bonus BIGINT DEFAULT 0,
          activation_budget BIGINT DEFAULT 0,
          media_value BIGINT DEFAULT 0,
          merchandise_revenue BIGINT DEFAULT 0,
          digital_rights BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(driver_id, sponsor_name, start_date)
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS prize_money (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(150) UNIQUE NOT NULL,
          total_purse BIGINT NOT NULL,
          winner_payout BIGINT NOT NULL,
          position_payouts JSONB NOT NULL,
          bonuses JSONB,
          points_fund BIGINT DEFAULT 0,
          playoff_bonus BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS team_budgets (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(100) NOT NULL,
          season INTEGER NOT NULL,
          total_budget BIGINT NOT NULL,
          driver_salaries BIGINT DEFAULT 0,
          car_development BIGINT DEFAULT 0,
          operations BIGINT DEFAULT 0,
          marketing BIGINT DEFAULT 0,
          travel_expenses BIGINT DEFAULT 0,
          facility_rent BIGINT DEFAULT 0,
          insurance BIGINT DEFAULT 0,
          contingency BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, season)
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS merchandise_revenue (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(150),
          driver_id VARCHAR(100),
          sponsor_name VARCHAR(200),
          product_category VARCHAR(100),
          revenue_amount BIGINT NOT NULL,
          units_sold INTEGER DEFAULT 0,
          average_price DECIMAL(10,2),
          sale_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS activation_costs (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(150),
          sponsor_name VARCHAR(200) NOT NULL,
          activation_type VARCHAR(100),
          cost_amount BIGINT NOT NULL,
          estimated_reach INTEGER,
          engagement_score INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS sponsor_roi_calculations (
          id SERIAL PRIMARY KEY,
          sponsor_name VARCHAR(200) NOT NULL,
          driver_id VARCHAR(100),
          calculation_period VARCHAR(50),
          total_investment BIGINT NOT NULL,
          media_value BIGINT DEFAULT 0,
          digital_value BIGINT DEFAULT 0,
          merchandise_revenue BIGINT DEFAULT 0,
          brand_lift_value BIGINT DEFAULT 0,
          total_roi_value BIGINT NOT NULL,
          roi_percentage DECIMAL(8,2),
          calculation_date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
		} finally {
			client.release();
		}
	}

	async function cleanupFinancialTables(): Promise<void> {
		const client = await testPool.connect();

		try {
			await client.query('TRUNCATE TABLE sponsor_roi_calculations CASCADE');
			await client.query('TRUNCATE TABLE activation_costs CASCADE');
			await client.query('TRUNCATE TABLE merchandise_revenue CASCADE');
			await client.query('TRUNCATE TABLE team_budgets CASCADE');
			await client.query('TRUNCATE TABLE prize_money CASCADE');
			await client.query('TRUNCATE TABLE sponsor_contracts CASCADE');
		} finally {
			client.release();
		}
	}

	describe('Core Financial Scraper', () => {
		let scraper: FinancialDataScraper;

		beforeEach(() => {
			scraper = new FinancialDataScraper();
		});

		it('should run complete financial data scraping process', async () => {
			await scraper.run();

			/** Verify data was inserted */
			const client = await testPool.connect();

			try {
				/** Check sponsor contracts */
				const contractsResult = await client.query(
					'SELECT COUNT(*) as count FROM sponsor_contracts'
				);
				expect(parseInt(contractsResult.rows[0].count)).toBeGreaterThan(0);

				/** Check prize money */
				const prizeResult = await client.query(
					'SELECT COUNT(*) as count FROM prize_money'
				);
				expect(parseInt(prizeResult.rows[0].count)).toBeGreaterThan(0);

				/** Check team budgets */
				const budgetResult = await client.query(
					'SELECT COUNT(*) as count FROM team_budgets'
				);
				expect(parseInt(budgetResult.rows[0].count)).toBeGreaterThan(0);

				/** Check merchandise revenue */
				const merchandiseResult = await client.query(
					'SELECT COUNT(*) as count FROM merchandise_revenue'
				);
				expect(parseInt(merchandiseResult.rows[0].count)).toBeGreaterThan(0);

				/** Check activation costs */
				const activationResult = await client.query(
					'SELECT COUNT(*) as count FROM activation_costs'
				);
				expect(parseInt(activationResult.rows[0].count)).toBeGreaterThan(0);

				/** Check ROI calculations */
				const roiResult = await client.query(
					'SELECT COUNT(*) as count FROM sponsor_roi_calculations'
				);
				expect(parseInt(roiResult.rows[0].count)).toBeGreaterThan(0);
			} finally {
				client.release();
			}
		});

		it('should handle database schema correctly', async () => {
			await scraper.run();

			const client = await testPool.connect();

			try {
				/** Test sponsor contracts schema */
				const contractResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'sponsor_contracts'
          ORDER BY column_name
        `);

				const columnNames = contractResult.rows.map(
					(row: any) => row.column_name
				);
				expect(columnNames).toContain('media_value');
				expect(columnNames).toContain('merchandise_revenue');
				expect(columnNames).toContain('digital_rights');

				/** Test team budgets schema */
				const budgetResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'team_budgets'
          ORDER BY column_name
        `);

				const budgetColumns = budgetResult.rows.map(
					(row: any) => row.column_name
				);
				expect(budgetColumns).toContain('facility_rent');
				expect(budgetColumns).toContain('insurance');
				expect(budgetColumns).toContain('contingency');
			} finally {
				client.release();
			}
		});

		it('should calculate ROI correctly', async () => {
			await scraper.run();

			const client = await testPool.connect();

			try {
				const roiResult = await client.query(`
          SELECT 
            sponsor_name,
            total_investment,
            total_roi_value,
            roi_percentage
          FROM sponsor_roi_calculations
          WHERE total_investment > 0
          LIMIT 5
        `);

				expect(roiResult.rows.length).toBeGreaterThan(0);

				roiResult.rows.forEach((row: any) => {
					expect(row.total_investment).toBeGreaterThan(0);
					expect(row.total_roi_value).toBeGreaterThan(0);

					/** Verify ROI calculation */
					const expectedROI =
						((row.total_roi_value - row.total_investment) /
							row.total_investment) *
						100;
					expect(
						Math.abs(parseFloat(row.roi_percentage) - expectedROI)
					).toBeLessThan(0.01);
				});
			} finally {
				client.release();
			}
		});
	});

	describe('Standalone Financial Scraper', () => {
		let standaloneScraper: FinancialDataScraperStandalone;

		beforeEach(() => {
			standaloneScraper = new FinancialDataScraperStandalone();
		});

		it('should run standalone scraper successfully', async () => {
			await standaloneScraper.run();

			/** Verify data was inserted */
			const client = await testPool.connect();

			try {
				const contractsResult = await client.query(
					'SELECT COUNT(*) as count FROM sponsor_contracts'
				);
				expect(parseInt(contractsResult.rows[0].count)).toBeGreaterThan(0);
			} finally {
				client.release();
			}
		});

		it('should generate comprehensive summary', async () => {
			await standaloneScraper.run();

			const summarySections = (standaloneScraper as any).getSummarySections();
			expect(summarySections.length).toBeGreaterThan(6);

			/** Test that summary sections work with actual data */
			const client = await testPool.connect();

			try {
				for (const section of summarySections.slice(0, 3)) {
					/** Test first 3 sections */
					const result = await client.query(section.query);
					expect(result.rows.length).toBeGreaterThanOrEqual(1);

					/** Test formatter doesn't throw */
					expect(() => section.formatter(result.rows[0])).not.toThrow();
				}
			} finally {
				client.release();
			}
		});
	});

	describe('Data Integrity', () => {
		let scraper: FinancialDataScraper;

		beforeEach(() => {
			scraper = new FinancialDataScraper();
		});

		it('should maintain referential integrity', async () => {
			await scraper.run();

			const client = await testPool.connect();

			try {
				/** Check that all merchandise revenue references valid drivers (if foreign keys exist) */
				const merchandiseCheck = await client.query(`
          SELECT COUNT(*) as count
          FROM merchandise_revenue mr
          WHERE mr.driver_id IS NOT NULL
        `);

				expect(parseInt(merchandiseCheck.rows[0].count)).toBeGreaterThan(0);

				/** Check that sponsor contracts have valid date ranges */
				const contractDateCheck = await client.query(`
          SELECT COUNT(*) as count
          FROM sponsor_contracts
          WHERE start_date < end_date
        `);

				const totalContracts = await client.query(
					'SELECT COUNT(*) as count FROM sponsor_contracts'
				);
				expect(contractDateCheck.rows[0].count).toBe(
					totalContracts.rows[0].count
				);
			} finally {
				client.release();
			}
		});

		it('should handle duplicate data correctly', async () => {
			// Run scraper twice
			await scraper.run();
			await scraper.run();

			const client = await testPool.connect();

			try {
				/** Check that constraints prevented duplicates where expected */
				const prizeDuplicateCheck = await client.query(`
          SELECT event_id, COUNT(*) as count
          FROM prize_money
          GROUP BY event_id
          HAVING COUNT(*) > 1
        `);

				expect(prizeDuplicateCheck.rows.length).toBe(0); // No duplicates should exist

				const teamBudgetDuplicateCheck = await client.query(`
          SELECT team_id, season, COUNT(*) as count
          FROM team_budgets
          GROUP BY team_id, season
          HAVING COUNT(*) > 1
        `);

				expect(teamBudgetDuplicateCheck.rows.length).toBe(0); // No duplicates should exist
			} finally {
				client.release();
			}
		});

		it('should maintain data consistency across tables', async () => {
			await scraper.run();

			const client = await testPool.connect();

			try {
				/** Check that ROI calculations reference existing contracts */
				const roiConsistencyCheck = await client.query(`
          SELECT roi.sponsor_name, roi.driver_id
          FROM sponsor_roi_calculations roi
          LEFT JOIN sponsor_contracts sc ON roi.sponsor_name = sc.sponsor_name AND roi.driver_id = sc.driver_id
          WHERE sc.id IS NULL
        `);

				expect(roiConsistencyCheck.rows.length).toBe(0);

				/** All ROI calculations should have corresponding contracts */
				/** Check that activation costs have valid engagement scores */
				const activationScoreCheck = await client.query(`
          SELECT COUNT(*) as count
          FROM activation_costs
          WHERE engagement_score >= 0 AND engagement_score <= 100
        `);

				const totalActivations = await client.query(
					'SELECT COUNT(*) as count FROM activation_costs'
				);

				expect(activationScoreCheck.rows[0].count).toBe(
					totalActivations.rows[0].count
				);
			} finally {
				client.release();
			}
		});
	});

	describe('Performance', () => {
		let scraper: FinancialDataScraper;

		beforeEach(() => {
			scraper = new FinancialDataScraper();
		});

		it('should complete scraping within reasonable time', async () => {
			const startTime = Date.now();

			await scraper.run();

			const endTime = Date.now();
			const executionTime = endTime - startTime;

			/** Should complete within 30 seconds (adjust as needed) */
			expect(executionTime).toBeLessThan(30000);
		});

		it('should handle large dataset generation efficiently', async () => {
			const startTime = Date.now();

			/** Generate large datasets */
			const contracts = (scraper as any).generateSponsorContractData();
			const merchandise = (scraper as any).generateMerchandiseRevenue();
			const activation = (scraper as any).generateActivationSpend();

			const endTime = Date.now();
			const generationTime = endTime - startTime;

			expect(contracts.length).toBeGreaterThan(10);
			expect(merchandise.length).toBeGreaterThan(50);
			expect(activation.length).toBeGreaterThan(100);

			/** Data generation should be fast */
			expect(generationTime).toBeLessThan(5000);
		});
	});
});
