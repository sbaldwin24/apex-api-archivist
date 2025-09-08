import dotenv from 'dotenv';
import 'dotenv/config';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.DATABASE_URL =
	process.env.TEST_DATABASE_URL ||
	'postgresql://test_user:test_pass@localhost:5432/nascar_test';
process.env.REDIS_URL =
	process.env.TEST_REDIS_URL || 'redis://localhost:6379/15';
process.env.SESSION_SECRET =
	process.env.SESSION_SECRET || 'test-session-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

// Mock external services by default
jest.mock('playwright', () => ({
	chromium: {
		launch: jest.fn().mockResolvedValue({
			close: jest.fn(),
			newContext: jest.fn().mockResolvedValue({
				close: jest.fn(),
				newPage: jest.fn().mockResolvedValue({
					close: jest.fn(),
					evaluate: jest.fn(),
					goto: jest.fn(),
					waitForSelector: jest.fn()
				})
			})
		})
	}
}));

// Mock crawl4ai
jest.mock('crawl4ai', () => ({
	WebCrawler: jest.fn().mockImplementation(() => ({
		run: jest.fn().mockResolvedValue({
			data: { html: '<html></html>' },
			success: true
		}),
		warmup: jest.fn()
	}))
}));

// Extend Jest matchers
expect.extend({
	toBeArray(received: any) {
		const pass = Array.isArray(received);
		if (pass) {
			return {
				message: () => `expected ${received} not to be an array`,
				pass: true
			};
		} else {
			return {
				message: () => `expected ${received} to be an array`,
				pass: false
			};
		}
	},

	toBeNumber(received: any) {
		const pass = typeof received === 'number' && !Number.isNaN(received);
		if (pass) {
			return {
				message: () => `expected ${received} not to be a number`,
				pass: true
			};
		} else {
			return {
				message: () => `expected ${received} to be a number`,
				pass: false
			};
		}
	},

	toBeObject(received: any) {
		const pass =
			typeof received === 'object' &&
			received !== null &&
			!Array.isArray(received);
		if (pass) {
			return {
				message: () => `expected ${received} not to be an object`,
				pass: true
			};
		} else {
			return {
				message: () => `expected ${received} to be an object`,
				pass: false
			};
		}
	},

	toBeValidDate(received: any) {
		const pass = received instanceof Date && !Number.isNaN(received.getTime());
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
		const hasStatus = typeof received.status === 'number';
		const hasBody = received.body !== undefined;
		const pass = hasStatus && hasBody;

		if (pass) {
			return {
				message: () => `expected response not to have valid API structure`,
				pass: true
			};
		} else {
			return {
				message: () =>
					`expected response to have valid API structure with status and body`,
				pass: false
			};
		}
	}
});

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in test environment to reduce noise
if (process.env.NODE_ENV === 'test') {
	// Only mock if LOG_LEVEL is set to 'error' or we want quiet tests
	if (process.env.LOG_LEVEL === 'error' || process.env.QUIET_TESTS === 'true') {
		console.log = jest.fn();
		console.info = jest.fn();
		console.warn = jest.fn();
		// Keep console.error for debugging test failures
	}
}

// Global test helpers
declare global {
	namespace jest {
		interface Matchers<R> {
			toBeWithinRange(floor: number, ceiling: number): R;
			toBeValidDate(): R;
			toHaveValidApiResponse(): R;
			toBeArray(): R;
			toBeNumber(): R;
			toBeObject(): R;
		}
	}

	var testHelpers: {
		createTestDb: () => Promise<any>;
		cleanTestDb: (pool: any) => Promise<void>;
		createTestData: {
			season: () => any;
			driver: () => any;
			team: () => any;
			track: () => any;
		};
	};
}

// Test helper functions
global.testHelpers = {
	// Helper to clean database
	cleanTestDb: async (pool: any) => {
		try {
			await pool.query(
				'TRUNCATE TABLE race_results, events, drivers, teams, tracks, seasons CASCADE'
			);
		} catch {
			// Tables might not exist yet, ignore error
		}
	},

	// Helper to create test data
	createTestData: {
		driver: () => ({
			first_name: 'Test',
			id: 'test-driver-1',
			last_name: 'Driver'
		}),
		season: () => ({
			id: 2024,
			series_id: 'nascar-cup',
			year: 2024
		}),
		team: () => ({
			id: 'test-team-1',
			manufacturer: 'Chevrolet',
			name: 'Test Team'
		}),
		track: () => ({
			city: 'Test City',
			id: 'test-track-1',
			length_miles: 1.5,
			name: 'Test Speedway',
			state: 'TC'
		})
	},
	// Helper to create test database connection
	createTestDb: async () => {
		const { Pool } = require('pg');
		return new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 5
		});
	}
};
