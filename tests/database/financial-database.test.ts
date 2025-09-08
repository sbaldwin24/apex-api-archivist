import { readFileSync } from 'node:fs';
import { TestHelpers } from '../utils/test-helpers';

describe('Financial Database Operations', () => {
	let testPool: any;

	beforeAll(async () => {
		testPool = TestHelpers.createTestPool();
		await setupFinancialSchema();
	});

	afterAll(async () => {
		await TestHelpers.closeTestPool();
	});

	beforeEach(async () => {
		await cleanupFinancialTables();
	});

	async function setupFinancialSchema(): Promise<void> {
		const client = await testPool.connect();

		try {
			// Load and execute the actual financial schema
			const schemaSQL = readFileSync('./financial-schema.sql', 'utf8');
			await client.query(schemaSQL);
		} finally {
			client.release();
		}
	}

	async function cleanupFinancialTables(): Promise<void> {
		const client = await testPool.connect();

		try {
			await client.query('TRUNCATE TABLE sponsor_roi_calculations CASCADE');
			await client.query('TRUNCATE TABLE activation_costs CASCADE');
			await client.query('TRUNCATE TABLE licensing_revenue CASCADE');
			await client.query('TRUNCATE TABLE merchandise_revenue CASCADE');
			await client.query('TRUNCATE TABLE team_budgets CASCADE');
			await client.query('TRUNCATE TABLE prize_money CASCADE');
			await client.query('TRUNCATE TABLE sponsor_contracts CASCADE');
		} finally {
			client.release();
		}
	}

	describe('Schema Validation', () => {
		it('should create all required tables', async () => {
			const client = await testPool.connect();

			try {
				const tablesResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN (
            'sponsor_contracts',
            'prize_money',
            'team_budgets',
            'merchandise_revenue',
            'licensing_revenue',
            'activation_costs',
            'sponsor_roi_calculations'
          )
          ORDER BY table_name
        `);

				const tableNames = tablesResult.rows.map((row: any) => row.table_name);
				expect(tableNames).toContain('sponsor_contracts');
				expect(tableNames).toContain('prize_money');
				expect(tableNames).toContain('team_budgets');
				expect(tableNames).toContain('merchandise_revenue');
				expect(tableNames).toContain('licensing_revenue');
				expect(tableNames).toContain('activation_costs');
				expect(tableNames).toContain('sponsor_roi_calculations');
			} finally {
				client.release();
			}
		});

		it('should create all required indexes', async () => {
			const client = await testPool.connect();

			try {
				const indexesResult = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename IN (
            'sponsor_contracts',
            'prize_money',
            'team_budgets',
            'merchandise_revenue',
            'activation_costs',
            'sponsor_roi_calculations'
          )
          AND indexname LIKE 'idx_%'
          ORDER BY indexname
        `);

				const indexNames = indexesResult.rows.map((row: any) => row.indexname);
				expect(indexNames).toContain('idx_sponsor_contracts_driver');
				expect(indexNames).toContain('idx_sponsor_contracts_sponsor');
				expect(indexNames).toContain('idx_team_budgets_season');
				expect(indexNames).toContain('idx_roi_sponsor');
				expect(indexNames).toContain('idx_roi_percentage');
			} finally {
				client.release();
			}
		});

		it('should have correct column types', async () => {
			const client = await testPool.connect();

			try {
				const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'sponsor_contracts'
          ORDER BY column_name
        `);

				const columns = columnsResult.rows.reduce((acc: any, row: any) => {
					acc[row.column_name] = row.data_type;
					return acc;
				}, {});

				expect(columns['contract_value']).toBe('bigint');
				expect(columns['media_value']).toBe('bigint');
				expect(columns['digital_rights']).toBe('bigint');
				expect(columns['start_date']).toBe('date');
				expect(columns['end_date']).toBe('date');
			} finally {
				client.release();
			}
		});
	});

	describe('Sponsor Contracts', () => {
		it('should insert sponsor contract data', async () => {
			const client = await testPool.connect();

			try {
				await client.query(
					`
          INSERT INTO sponsor_contracts
          (driver_id, sponsor_name, contract_value, contract_length, contract_type,
           start_date, end_date, performance_bonus, activation_budget, media_value,
           merchandise_revenue, digital_rights)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
					[
						'test_driver',
						'Test Sponsor',
						15000000,
						3,
						'primary',
						'2024-01-01',
						'2026-12-31',
						2000000,
						5000000,
						8000000,
						2500000,
						1000000
					]
				);

				const result = await client.query(
					'SELECT * FROM sponsor_contracts WHERE driver_id = $1',
					['test_driver']
				);
				expect(result.rows).toHaveLength(1);
				expect(result.rows[0].sponsor_name).toBe('Test Sponsor');
				expect(parseInt(result.rows[0].contract_value)).toBe(15000000);
				expect(parseInt(result.rows[0].media_value)).toBe(8000000);
			} finally {
				client.release();
			}
		});

		it('should enforce unique constraint', async () => {
			const client = await testPool.connect();

			try {
				const contractData = [
					'test_driver',
					'Test Sponsor',
					15000000,
					3,
					'primary',
					'2024-01-01',
					'2026-12-31',
					2000000,
					5000000
				];

				await client.query(
					`
          INSERT INTO sponsor_contracts
          (driver_id, sponsor_name, contract_value, contract_length, contract_type,
           start_date, end_date, performance_bonus, activation_budget)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
					contractData
				);

				// Try to insert same contract again
				await expect(
					client.query(
						`
            INSERT INTO sponsor_contracts
            (driver_id, sponsor_name, contract_value, contract_length, contract_type,
             start_date, end_date, performance_bonus, activation_budget)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
						contractData
					)
				).rejects.toThrow();
			} finally {
				client.release();
			}
		});

		it('should handle upsert operations', async () => {
			const client = await testPool.connect();

			try {
				// Initial insert
				await client.query(
					`
          INSERT INTO sponsor_contracts
          (driver_id, sponsor_name, contract_value, contract_length, contract_type,
           start_date, end_date, performance_bonus, activation_budget)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (driver_id, sponsor_name, start_date)
          DO UPDATE SET contract_value = $3
        `,
					[
						'test_driver',
						'Test Sponsor',
						15000000,
						3,
						'primary',
						'2024-01-01',
						'2026-12-31',
						2000000,
						5000000
					]
				);

				// Upsert with different value
				await client.query(
					`
          INSERT INTO sponsor_contracts
          (driver_id, sponsor_name, contract_value, contract_length, contract_type,
           start_date, end_date, performance_bonus, activation_budget)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (driver_id, sponsor_name, start_date)
          DO UPDATE SET contract_value = $3
        `,
					[
						'test_driver',
						'Test Sponsor',
						20000000, // Different value
						3,
						'primary',
						'2024-01-01',
						'2026-12-31',
						2000000,
						5000000
					]
				);

				const result = await client.query(
					'SELECT * FROM sponsor_contracts WHERE driver_id = $1',
					['test_driver']
				);
				expect(result.rows).toHaveLength(1);
				expect(parseInt(result.rows[0].contract_value)).toBe(20000000); // Should be updated
			} finally {
				client.release();
			}
		});
	});

	describe('Prize Money', () => {
		it('should handle JSONB data correctly', async () => {
			const client = await testPool.connect();

			try {
				const positionPayouts = { '1': 1600000, '2': 800000, '3': 600000 };
				const bonuses = { fastest_lap: 25000, pole_position: 50000 };

				await client.query(
					`
          INSERT INTO prize_money
          (event_id, total_purse, winner_payout, position_payouts, bonuses, points_fund)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
					[
						'test_event_2024',
						8000000,
						1600000,
						JSON.stringify(positionPayouts),
						JSON.stringify(bonuses),
						1200000
					]
				);

				const result = await client.query(
					'SELECT * FROM prize_money WHERE event_id = $1',
					['test_event_2024']
				);
				expect(result.rows).toHaveLength(1);

				const retrievedPayouts = result.rows[0].position_payouts;
				expect(retrievedPayouts['1']).toBe(1600000);
				expect(retrievedPayouts['2']).toBe(800000);

				const retrievedBonuses = result.rows[0].bonuses;
				expect(retrievedBonuses['pole_position']).toBe(50000);
				expect(parseInt(result.rows[0].points_fund)).toBe(1200000);
			} finally {
				client.release();
			}
		});

		it('should query JSONB data efficiently', async () => {
			const client = await testPool.connect();

			try {
				await client.query(
					`
          INSERT INTO prize_money
          (event_id, total_purse, winner_payout, position_payouts, bonuses)
          VALUES ($1, $2, $3, $4, $5)
        `,
					[
						'test_event_2024',
						8000000,
						1600000,
						JSON.stringify({ '1': 1600000, '2': 800000, '10': 200000 }),
						JSON.stringify({ fastest_lap: 25000, pole_position: 50000 })
					]
				);

				// Query for specific position payout
				const positionResult = await client.query(
					`
          SELECT position_payouts->'10' as tenth_place_payout
          FROM prize_money
          WHERE event_id = $1
        `,
					['test_event_2024']
				);

				expect(parseInt(positionResult.rows[0].tenth_place_payout)).toBe(
					200000
				);

				// Query for specific bonus
				const bonusResult = await client.query(
					`
          SELECT bonuses->'pole_position' as pole_bonus
          FROM prize_money
          WHERE event_id = $1
        `,
					['test_event_2024']
				);

				expect(parseInt(bonusResult.rows[0].pole_bonus)).toBe(50000);
			} finally {
				client.release();
			}
		});
	});

	describe('Team Budgets', () => {
		it('should enforce budget constraints', async () => {
			const client = await testPool.connect();

			try {
				await client.query(
					`
          INSERT INTO team_budgets
          (team_id, season, total_budget, driver_salaries, car_development,
           operations, marketing, travel_expenses, facility_rent, insurance, contingency)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
					[
						'test_team',
						2024,
						180000000,
						40000000,
						54000000,
						36000000,
						14400000,
						9000000,
						14400000,
						7200000,
						5400000
					]
				);

				const result = await client.query(
					'SELECT * FROM team_budgets WHERE team_id = $1 AND season = $2',
					['test_team', 2024]
				);

				expect(result.rows).toHaveLength(1);
				expect(parseInt(result.rows[0].total_budget)).toBe(180000000);
				expect(parseInt(result.rows[0].facility_rent)).toBe(14400000);
				expect(parseInt(result.rows[0].insurance)).toBe(7200000);
				expect(parseInt(result.rows[0].contingency)).toBe(5400000);
			} finally {
				client.release();
			}
		});

		it('should handle team budget updates', async () => {
			const client = await testPool.connect();

			try {
				// Initial budget
				await client.query(
					`
          INSERT INTO team_budgets
          (team_id, season, total_budget, driver_salaries, car_development, operations, marketing, travel_expenses)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (team_id, season)
          DO UPDATE SET total_budget = $3
        `,
					[
						'test_team',
						2024,
						150000000,
						30000000,
						45000000,
						30000000,
						12000000,
						7500000
					]
				);

				// Update budget
				await client.query(
					`
          INSERT INTO team_budgets
          (team_id, season, total_budget, driver_salaries, car_development, operations, marketing, travel_expenses)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (team_id, season)
          DO UPDATE SET total_budget = $3, driver_salaries = $4
        `,
					[
						'test_team',
						2024,
						180000000,
						40000000,
						45000000,
						30000000,
						12000000,
						7500000
					]
				);

				const result = await client.query(
					'SELECT * FROM team_budgets WHERE team_id = $1',
					['test_team']
				);
				expect(result.rows).toHaveLength(1);
				expect(parseInt(result.rows[0].total_budget)).toBe(180000000);
				expect(parseInt(result.rows[0].driver_salaries)).toBe(40000000);
			} finally {
				client.release();
			}
		});
	});

	describe('ROI Calculations', () => {
		beforeEach(async () => {
			const client = await testPool.connect();
			try {
				// Insert test sponsor contract first
				await client.query(
					`
          INSERT INTO sponsor_contracts
          (driver_id, sponsor_name, contract_value, contract_length, contract_type,
           start_date, end_date, performance_bonus, activation_budget)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
					[
						'test_driver',
						'Test Sponsor',
						15000000,
						3,
						'primary',
						'2024-01-01',
						'2026-12-31',
						2000000,
						5000000
					]
				);
			} finally {
				client.release();
			}
		});

		it('should calculate and store ROI correctly', async () => {
			const client = await testPool.connect();

			try {
				await client.query(
					`
          INSERT INTO sponsor_roi_calculations
          (sponsor_name, driver_id, calculation_period, total_investment,
           media_value, digital_value, merchandise_revenue, brand_lift_value,
           total_roi_value, roi_percentage)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
					[
						'Test Sponsor',
						'test_driver',
						'season',
						20000000, // total investment
						22500000, // media value
						6000000, // digital value
						500000, // merchandise revenue
						16000000, // brand lift value
						45000000, // total ROI value
						125.0 // 125% ROI
					]
				);

				const result = await client.query(
					'SELECT * FROM sponsor_roi_calculations WHERE sponsor_name = $1 AND driver_id = $2',
					['Test Sponsor', 'test_driver']
				);

				expect(result.rows).toHaveLength(1);
				expect(parseInt(result.rows[0].total_investment)).toBe(20000000);
				expect(parseInt(result.rows[0].total_roi_value)).toBe(45000000);
				expect(parseFloat(result.rows[0].roi_percentage)).toBe(125.0);
			} finally {
				client.release();
			}
		});

		it('should support complex ROI queries', async () => {
			const client = await testPool.connect();

			try {
				// Insert multiple ROI records
				const roiRecords = [
					['Sponsor A', 'driver_1', 'season', 10000000, 15000000, 50.0],
					['Sponsor B', 'driver_2', 'season', 15000000, 18000000, 20.0],
					['Sponsor C', 'driver_3', 'season', 8000000, 12000000, 50.0]
				];

				for (const record of roiRecords) {
					await client.query(
						`
            INSERT INTO sponsor_roi_calculations
            (sponsor_name, driver_id, calculation_period, total_investment,
             total_roi_value, roi_percentage)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
						record
					);
				}

				// Query for best ROI
				const bestROI = await client.query(`
          SELECT sponsor_name, roi_percentage
          FROM sponsor_roi_calculations
          WHERE calculation_period = 'season'
          ORDER BY roi_percentage DESC
          LIMIT 1
        `);

				expect(bestROI.rows[0].sponsor_name).toMatch(/(Sponsor A|Sponsor C)/);
				expect(parseFloat(bestROI.rows[0].roi_percentage)).toBe(50.0);

				// Query for average ROI
				const avgROI = await client.query(`
          SELECT AVG(roi_percentage) as avg_roi
          FROM sponsor_roi_calculations
          WHERE calculation_period = 'season'
        `);

				expect(parseFloat(avgROI.rows[0].avg_roi)).toBeCloseTo(40.0, 1);
			} finally {
				client.release();
			}
		});
	});

	describe('Performance Tests', () => {
		it('should perform bulk inserts efficiently', async () => {
			const client = await testPool.connect();

			try {
				const startTime = Date.now();

				// Insert 100 sponsor contracts
				for (let i = 0; i < 100; i++) {
					await client.query(
						`
            INSERT INTO sponsor_contracts
            (driver_id, sponsor_name, contract_value, contract_length, contract_type,
             start_date, end_date, performance_bonus, activation_budget)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
						[
							`driver_${i}`,
							`Sponsor ${i}`,
							10000000 + i * 100000,
							3,
							'primary',
							'2024-01-01',
							'2026-12-31',
							1000000,
							3000000
						]
					);
				}

				const endTime = Date.now();
				const executionTime = endTime - startTime;

				// Should complete within reasonable time (adjust as needed)
				expect(executionTime).toBeLessThan(10000); // 10 seconds

				const result = await client.query(
					'SELECT COUNT(*) as count FROM sponsor_contracts'
				);
				expect(parseInt(result.rows[0].count)).toBe(100);
			} finally {
				client.release();
			}
		});

		it('should query with indexes efficiently', async () => {
			const client = await testPool.connect();

			try {
				// Insert test data
				for (let i = 0; i < 50; i++) {
					await client.query(
						`
            INSERT INTO sponsor_roi_calculations
            (sponsor_name, driver_id, calculation_period, total_investment,
             total_roi_value, roi_percentage)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
						[
							`Sponsor ${i % 10}`, // 10 different sponsors
							`driver_${i}`,
							'season',
							10000000,
							15000000,
							50.0 + (i % 20) // Varying ROI
						]
					);
				}

				const startTime = Date.now();

				// Query using indexed column
				const result = await client.query(`
          SELECT sponsor_name, AVG(roi_percentage) as avg_roi
          FROM sponsor_roi_calculations
          WHERE roi_percentage > 55
          GROUP BY sponsor_name
          ORDER BY avg_roi DESC
        `);

				const endTime = Date.now();
				const queryTime = endTime - startTime;

				// Query should be fast
				expect(queryTime).toBeLessThan(1000); // 1 second
				expect(result.rows.length).toBeGreaterThan(0);
			} finally {
				client.release();
			}
		});
	});
});
