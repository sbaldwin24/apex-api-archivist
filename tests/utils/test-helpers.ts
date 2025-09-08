import { Pool } from 'pg';

/**
 * Test utilities for database operations and mocking
 */
export class TestHelpers {
	static testPool: Pool | null = null;

	/**
	 * Create a test database pool with test configuration
	 */
	static createTestPool(): Pool {
		if (!TestHelpers.testPool) {
			TestHelpers.testPool = new Pool({
				connectionTimeoutMillis: Number(
					process.env.DB_CONNECTION_TIMEOUT || '5000'
				),
				database: process.env.DB_NAME || 'apex_data_test',
				host: process.env.DB_HOST || 'localhost',
				idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || '10000'),
				max: Number(process.env.DB_MAX_CONNECTIONS || '5'),
				password: process.env.DB_PASSWORD || 'test_password',
				port: Number(process.env.DB_PORT || '5432'),
				ssl: process.env.DB_SSL === 'true',
				user: process.env.DB_USER || 'test_user'
			});
		}
		return TestHelpers.testPool;
	}

	/**
	 * Close test database pool
	 */
	static async closeTestPool(): Promise<void> {
		if (TestHelpers.testPool) {
			await TestHelpers.testPool.end();
			TestHelpers.testPool = null;
		}
	}

	/**
	 * Clean up test database tables
	 */
	static async cleanupTestDatabase(): Promise<void> {
		const pool = TestHelpers.createTestPool();
		const client = await pool.connect();

		try {
			// Delete in reverse dependency order
			await client.query('TRUNCATE TABLE race_results CASCADE');
			await client.query('TRUNCATE TABLE qualifying_results CASCADE');
			await client.query('TRUNCATE TABLE practice_results CASCADE');
			await client.query('TRUNCATE TABLE stage_results CASCADE');
			await client.query('TRUNCATE TABLE pit_stops CASCADE');
			await client.query('TRUNCATE TABLE lap_data CASCADE');
			await client.query('TRUNCATE TABLE cautions CASCADE');
			await client.query('TRUNCATE TABLE events CASCADE');
			await client.query('TRUNCATE TABLE seasons CASCADE');
			await client.query('TRUNCATE TABLE drivers CASCADE');
			await client.query('TRUNCATE TABLE teams CASCADE');
			await client.query('TRUNCATE TABLE tracks CASCADE');
			await client.query('TRUNCATE TABLE series CASCADE');
		} finally {
			client.release();
		}
	}

	/**
	 * Set up test database schema
	 */
	static async setupTestSchema(): Promise<void> {
		const pool = TestHelpers.createTestPool();
		const client = await pool.connect();

		try {
			// Create basic test schema (minimal version for testing)
			await client.query(`
        CREATE TABLE IF NOT EXISTS series (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS seasons (
          id SERIAL PRIMARY KEY,
          series_id VARCHAR(50) NOT NULL REFERENCES series(id),
          year INTEGER NOT NULL,
          UNIQUE(series_id, year)
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS tracks (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          city VARCHAR(100),
          state VARCHAR(50)
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS drivers (
          id VARCHAR(100) PRIMARY KEY,
          first_name VARCHAR(100),
          last_name VARCHAR(100) NOT NULL
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(150) NOT NULL
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id VARCHAR(150) PRIMARY KEY,
          season_id INTEGER NOT NULL REFERENCES seasons(id),
          track_id VARCHAR(100) NOT NULL REFERENCES tracks(id),
          name VARCHAR(200) NOT NULL,
          event_date DATE NOT NULL
        );
      `);

			await client.query(`
        CREATE TABLE IF NOT EXISTS race_results (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(150) NOT NULL REFERENCES events(id),
          driver_id VARCHAR(100) NOT NULL REFERENCES drivers(id),
          team_id VARCHAR(100) NOT NULL REFERENCES teams(id),
          car_number VARCHAR(10) NOT NULL,
          finish_position INTEGER NOT NULL,
          start_position INTEGER,
          laps_led INTEGER DEFAULT 0,
          laps_completed INTEGER,
          status VARCHAR(50),
          UNIQUE(event_id, driver_id)
        );
      `);
		} finally {
			client.release();
		}
	}

	/**
	 * Create test fixtures with sample data
	 */
	static async createTestFixtures(): Promise<void> {
		const pool = TestHelpers.createTestPool();
		const client = await pool.connect();

		try {
			// Insert test series
			await client.query(`
        INSERT INTO series (id, name) 
        VALUES ('test_series', 'Test NASCAR Series')
        ON CONFLICT (id) DO NOTHING
      `);

			// Insert test season
			const seasonResult = await client.query(`
        INSERT INTO seasons (series_id, year) 
        VALUES ('test_series', 2024)
        ON CONFLICT (series_id, year) DO UPDATE SET year = 2024
        RETURNING id
      `);
			const seasonId = seasonResult.rows[0].id;

			// Insert test track
			await client.query(`
        INSERT INTO tracks (id, name, city, state)
        VALUES ('test_speedway', 'Test Speedway', 'Test City', 'Test State')
        ON CONFLICT (id) DO NOTHING
      `);

			// Insert test drivers
			await client.query(`
        INSERT INTO drivers (id, first_name, last_name)
        VALUES 
          ('test_driver_1', 'Test', 'Driver One'),
          ('test_driver_2', 'Test', 'Driver Two')
        ON CONFLICT (id) DO NOTHING
      `);

			// Insert test teams
			await client.query(`
        INSERT INTO teams (id, name)
        VALUES 
          ('test_team_1', 'Test Team One'),
          ('test_team_2', 'Test Team Two')
        ON CONFLICT (id) DO NOTHING
      `);

			// Insert test event
			await client.query(
				`
        INSERT INTO events (id, season_id, track_id, name, event_date)
        VALUES ('test_race_2024', $1, 'test_speedway', 'Test Race 2024', '2024-01-01')
        ON CONFLICT (id) DO NOTHING
      `,
				[seasonId]
			);
		} finally {
			client.release();
		}
	}

	/**
	 * Create a mock logger for testing
	 */
	static createMockLogger(): jest.Mocked<any> {
		return {
			debug: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			log: jest.fn(),
			warn: jest.fn()
		};
	}

	/**
	 * Create NASCAR-specific test matchers
	 */
	static setupNASCARMatchers(): void {
		expect.extend({
			toBeValidDate(received: any) {
				const pass =
					received instanceof Date && !Number.isNaN(received.getTime());
				if (pass) {
					return {
						message: () => `expected ${received} not to be a valid date`,
						pass: true
					};
				} else {
					return {
						message: () => `expected ${received} to be a valid date`,
						pass: false
					};
				}
			},
			toBeWithinRange(received: number, floor: number, ceiling: number) {
				const pass = received >= floor && received <= ceiling;
				if (pass) {
					return {
						message: () =>
							`expected ${received} not to be within range ${floor} - ${ceiling}`,
						pass: true
					};
				} else {
					return {
						message: () =>
							`expected ${received} to be within range ${floor} - ${ceiling}`,
						pass: false
					};
				}
			},
			toHaveValidApiResponse(received: any) {
				const hasData = received && received.data !== undefined;
				const hasNoErrors = !received.errors || received.errors.length === 0;
				const pass = hasData && hasNoErrors;

				if (pass) {
					return {
						message: () => `expected response not to be valid API response`,
						pass: true
					};
				} else {
					return {
						message: () => `expected response to have data and no errors`,
						pass: false
					};
				}
			}
		});
	}

	/**
	 * Create a mock database client
	 */
	static createMockDatabaseClient() {
		return {
			connect: jest.fn(),
			end: jest.fn(),
			query: jest.fn(),
			release: jest.fn()
		};
	}

	/**
	 * Wait for a specified amount of time (useful for async tests)
	 */
	static async wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Generate a random test ID
	 */
	static generateTestId(): string {
		return `test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
	}

	/**
	 * Validate that an error was thrown
	 */
	static async expectToThrow(
		fn: () => Promise<any>,
		errorMessage?: string
	): Promise<Error> {
		try {
			await fn();
			throw new Error('Expected function to throw, but it did not');
		} catch (error) {
			const errorInstance = error as Error;
			if (errorMessage && !errorInstance.message.includes(errorMessage)) {
				throw new Error(
					`Expected error message to include "${errorMessage}", got "${errorInstance.message}"`
				);
			}
			return errorInstance;
		}
	}

	/**
	 * Create a partial mock of any object
	 */
	static createPartialMock<T>(overrides: Partial<T>): jest.Mocked<T> {
		return overrides as jest.Mocked<T>;
	}
}

/**
 * Test data factories for creating consistent test fixtures
 */
export class TestDataFactory {
	static createMockRaceData() {
		return {
			eventDate: '2024-01-01',
			raceName: 'Test Race',
			results: [
				{
					carNumber: '1',
					driverName: 'Test Driver One',
					finishPosition: 1,
					lapsCompleted: 400,
					lapsLed: 200,
					startPosition: 1,
					status: 'Running',
					teamName: 'Test Team One'
				},
				{
					carNumber: '2',
					driverName: 'Test Driver Two',
					finishPosition: 2,
					lapsCompleted: 400,
					lapsLed: 100,
					startPosition: 2,
					status: 'Running',
					teamName: 'Test Team Two'
				}
			],
			trackName: 'Test Speedway'
		};
	}

	static createMockDriver() {
		return {
			date_of_birth: null,
			first_name: 'Test',
			hometown: 'Test City',
			id: 'test_driver',
			last_name: 'Driver'
		};
	}

	static createMockTeam() {
		return {
			id: 'test_team',
			manufacturer: 'Test Manufacturer',
			name: 'Test Team'
		};
	}

	static createMockTrack() {
		return {
			city: 'Test City',
			id: 'test_track',
			length_miles: 1.5,
			name: 'Test Speedway',
			state: 'Test State',
			type: 'Superspeedway'
		};
	}
}
