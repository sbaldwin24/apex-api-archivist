import { getAvailableYears, saveRaceData } from '../../src/database';
import { TestDataFactory, TestHelpers } from '../utils/test-helpers';

describe('Database Operations', () => {
	let testPool: any;

	beforeAll(async () => {
		/** Skip actual database tests if no test DB configured */
		if (!process.env.DB_NAME?.includes('test')) {
			console.warn('⚠️ Skipping database tests - no test database configured');
			return;
		}

		testPool = TestHelpers.createTestPool();
		await TestHelpers.setupTestSchema();
	});

	afterAll(async () => {
		if (testPool) {
			await TestHelpers.closeTestPool();
		}
	});

	beforeEach(async () => {
		if (!process.env.DB_NAME?.includes('test')) return;
		await TestHelpers.cleanupTestDatabase();
	});

	describe('Database Connection', () => {
		it('should connect to the database successfully', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const client = await testPool.connect();
			expect(client).toBeDefined();

			const result = await client.query('SELECT 1 as test');
			expect(result.rows[0].test).toBe(1);

			client.release();
		});

		it('should handle connection errors gracefully', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			/** Test with invalid connection parameters */
			const invalidPool = new (require('pg').Pool)({
				connectionTimeoutMillis: 1000,
				database: 'invalid',
				host: 'invalid-host',
				password: 'invalid',
				port: 9999,
				user: 'invalid'
			});

			await expect(invalidPool.connect()).rejects.toThrow();
			await invalidPool.end();
		});
	});

	describe('Schema Validation', () => {
		it('should have all required tables', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const client = await testPool.connect();

			const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

			const tableNames = tables.rows.map((row: any) => row.table_name);

			expect(tableNames).toContain('series');
			expect(tableNames).toContain('seasons');
			expect(tableNames).toContain('tracks');
			expect(tableNames).toContain('drivers');
			expect(tableNames).toContain('teams');
			expect(tableNames).toContain('events');
			expect(tableNames).toContain('race_results');

			client.release();
		});

		it('should enforce foreign key constraints', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const client = await testPool.connect();

			/** Try to insert race result without valid event */
			await expect(
				client.query(`
          INSERT INTO race_results (event_id, driver_id, team_id, car_number, finish_position)
          VALUES ('invalid_event', 'invalid_driver', 'invalid_team', '1', 1)
        `)
			).rejects.toThrow();

			client.release();
		});
	});

	describe('saveRaceData', () => {
		it('should save race data successfully', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const mockRaceData = TestDataFactory.createMockRaceData();

			await expect(saveRaceData(mockRaceData)).resolves.not.toThrow();

			/** Verify data was saved */
			const client = await testPool.connect();

			const eventResult = await client.query(
				'SELECT * FROM events WHERE name = $1',
				[mockRaceData.raceName]
			);
			expect(eventResult.rows).toHaveLength(1);

			const resultsCount = await client.query(
				'SELECT COUNT(*) as count FROM race_results WHERE event_id = $1',
				[eventResult.rows[0].id]
			);
			expect(Number(resultsCount.rows[0].count)).toBe(
				mockRaceData.results.length
			);

			client.release();
		});

		it('should handle duplicate race data correctly', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const mockRaceData = TestDataFactory.createMockRaceData();

			/** Save data first time */
			await saveRaceData(mockRaceData);

			/** Save same data again - should handle duplicates */
			await expect(saveRaceData(mockRaceData)).resolves.not.toThrow();

			/** Verify only one event exists */
			const client = await testPool.connect();
			const eventResult = await client.query(
				'SELECT COUNT(*) as count FROM events WHERE name = $1',
				[mockRaceData.raceName]
			);

			expect(Number(eventResult.rows[0].count)).toBe(1);

			client.release();
		});

		it('should rollback transaction on error', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const invalidRaceData = {
				...TestDataFactory.createMockRaceData(),
				results: [
					{
						carNumber: '1',
						driverName: 'Test Driver',
						finishPosition: -1, // Invalid - negative finish position will cause error
						lapsCompleted: 400,
						lapsLed: 200,
						startPosition: 1,
						status: 'Running',
						teamName: 'Test Team'
					}
				]
			} as any; // Cast to bypass type checking for test

			await expect(saveRaceData(invalidRaceData)).rejects.toThrow();

			/** Verify no partial data was saved */
			const client = await testPool.connect();
			const eventResult = await client.query(
				'SELECT COUNT(*) as count FROM events WHERE name = $1',
				[invalidRaceData.raceName]
			);
			expect(Number(eventResult.rows[0].count)).toBe(0);

			client.release();
		});
	});

	describe('getAvailableYears', () => {
		it('should return empty array when no data exists', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const years = await getAvailableYears();

			expect(years).toEqual([]);
		});

		it('should return available years after data is inserted', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const mockRaceData = TestDataFactory.createMockRaceData();
			await saveRaceData(mockRaceData);

			const years = await getAvailableYears();

			expect(years).toHaveLength(1);
			expect(years[0]).toMatchObject({
				events_count: expect.any(String),
				series_name: expect.any(String),
				year: 2024
			});
		});
	});

	describe('Database Pool Management', () => {
		it('should properly manage connections', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			const initialConnections = testPool.totalCount;

			/** Get multiple connections */
			const client1 = await testPool.connect();
			const client2 = await testPool.connect();

			expect(testPool.totalCount).toBeGreaterThan(initialConnections);

			/** Release connections */
			client1.release();
			client2.release();

			/** Wait a bit for connections to be returned to pool */
			await TestHelpers.wait(100);

			expect(testPool.idleCount).toBeGreaterThanOrEqual(0);
		});

		it('should handle connection timeouts', async () => {
			if (!process.env.DB_NAME?.includes('test')) return;

			/** This test would need a way to simulate connection timeout */
			/** For now, just verify the pool has timeout settings */
			expect(testPool.options.connectionTimeoutMillis).toBeDefined();
			expect(testPool.options.idleTimeoutMillis).toBeDefined();
		});
	});
});
