/** @type {import('jest').Config} */
module.exports = {
	/** Clear mocks between tests */
	clearMocks: true,

	/** Coverage configuration */
	collectCoverage: true,
	collectCoverageFrom: [
		'src/**/*.{ts,js}',
		'!src/**/*.d.ts',
		'!src/**/*.test.{ts,js}',
		'!src/**/__tests__/**',
		'!src/index.ts',
		'!src/**/index.ts'
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html', 'json'],

	/** Coverage thresholds */
	coverageThreshold: {
		global: {
			branches: 40,
			functions: 40,
			lines: 40,
			statements: 40
		}
	},

	/** Global setup and teardown */
	globalSetup: '<rootDir>/tests/global-setup.ts',
	globalTeardown: '<rootDir>/tests/global-teardown.ts',

	/** Module paths */
	moduleDirectories: ['node_modules', 'src'],

	/** Module name mapping for cleaner imports */
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@tests/(.*)$': '<rootDir>/tests/$1'
	},

	/** Mock patterns */
	modulePathIgnorePatterns: ['<rootDir>/dist/'],
	/** Use ts-jest preset for TypeScript support */
	preset: 'ts-jest',

	/** Restore mocks after each test */
	restoreMocks: true,

	/** Root directory for tests */
	rootDir: '.',

	/** Setup files to run before tests */
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

	/** Test environment */
	testEnvironment: 'node',

	/** Environment variables for tests */
	testEnvironmentOptions: {
		NODE_ENV: 'test'
	},

	/** Test match patterns */
	testMatch: [
		'<rootDir>/tests/**/*.test.ts',
		'<rootDir>/tests/**/*.spec.ts',
		'<rootDir>/src/**/__tests__/**/*.test.ts'
	],

	/** Ignore patterns */
	testPathIgnorePatterns: [
		'<rootDir>/node_modules/',
		'<rootDir>/dist/',
		'<rootDir>/coverage/',
		'<rootDir>/crawl4ai-env/'
	],

	/** Test timeout */
	testTimeout: 30000,

	/** Transform configuration */
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json'
			}
		]
	},

	/** Verbose output */
	verbose: true
};
