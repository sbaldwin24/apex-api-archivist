import { DatabaseManager } from '../../src/base/database-manager';
import { RetryManager } from '../../src/base/retry-manager';
import { PerformanceDataScraper } from '../../src/performance-scraper';
import { StructuredLogger } from '../../src/structured-logger';

// Mocks
jest.mock('../../src/base/structured-logger');
jest.mock('../../src/base/database-manager');
jest.mock('../../src/base/retry-manager');

describe('PerformanceDataScraper', () => {
	let scraper: PerformanceDataScraper;
	let mockDb: any;
	let mockRetryManager: any;
	let mockLogger: any;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Setup mock database
		mockDb = {
			connect: jest.fn().mockResolvedValue({}),
			query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
			release: jest.fn()
		};

		// Mock the getPool method to return our mock db
		(DatabaseManager.getPool as jest.Mock).mockReturnValue(mockDb);

		// Mock RetryManager
		mockRetryManager = {
			execute: jest.fn().mockImplementation((fn) => fn())
		};
		(RetryManager as unknown as jest.Mock).mockImplementation(
			() => mockRetryManager
		);

		// Mock Logger
		mockLogger = {
			debug: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			warn: jest.fn()
		};
		(StructuredLogger as jest.Mock).mockImplementation(() => mockLogger);

		// Create scraper instance
		scraper = new PerformanceDataScraper();
	});

	describe('scrape', () => {
		it('should execute the full scraping process and return successful result', async () => {
			// Mock all private methods used by scrape
			const spyTelemetry = jest
				.spyOn(scraper as any, 'generateTelemetryData')
				.mockResolvedValue([{ sessionId: '123' }]);
			const spyTireStrategy = jest
				.spyOn(scraper as any, 'generateTireStrategyData')
				.mockResolvedValue([{ raceId: '123' }]);
			const spyFuelData = jest
				.spyOn(scraper as any, 'generateFuelData')
				.mockResolvedValue([{ sessionId: '123' }]);
			const spyCarSetup = jest
				.spyOn(scraper as any, 'generateCarSetupData')
				.mockResolvedValue([{ carId: '123' }]);
			const spyRadio = jest
				.spyOn(scraper as any, 'generateRadioCommunications')
				.mockResolvedValue([{ communicationId: '123' }]);
			const spyCorrelations = jest
				.spyOn(scraper as any, 'calculatePerformanceCorrelations')
				.mockResolvedValue([{ correlationId: '123' }]);

			const spySaveTelemetry = jest
				.spyOn(scraper as any, 'saveTelemetryData')
				.mockResolvedValue(undefined);
			const spySaveTireStrategy = jest
				.spyOn(scraper as any, 'saveTireStrategyData')
				.mockResolvedValue(undefined);
			const spySaveFuelData = jest
				.spyOn(scraper as any, 'saveFuelData')
				.mockResolvedValue(undefined);
			const spySaveCarSetup = jest
				.spyOn(scraper as any, 'saveCarSetupData')
				.mockResolvedValue(undefined);
			const spySaveRadio = jest
				.spyOn(scraper as any, 'saveRadioCommunications')
				.mockResolvedValue(undefined);
			const spySaveCorrelations = jest
				.spyOn(scraper as any, 'savePerformanceCorrelations')
				.mockResolvedValue(undefined);

			// Mock summary generation
			const spyGenerateSummary = jest
				.spyOn(scraper as any, 'generatePerformanceAnalyticsSummary')
				.mockResolvedValue({
					avg_fuel_efficiency: 2.8,
					key_performance_factors: ['tire temperature', 'downforce level'],
					top_performing_setup: 'Medium downforce',
					total_telemetry_points: 1000,
					total_tire_changes: 50
				});

			// Execute scrape method
			const result = await scraper.scrape();

			// Verify all methods were called
			expect(spyTelemetry).toHaveBeenCalled();
			expect(spyTireStrategy).toHaveBeenCalled();
			expect(spyFuelData).toHaveBeenCalled();
			expect(spyCarSetup).toHaveBeenCalled();
			expect(spyRadio).toHaveBeenCalled();
			expect(spyCorrelations).toHaveBeenCalled();

			expect(spySaveTelemetry).toHaveBeenCalled();
			expect(spySaveTireStrategy).toHaveBeenCalled();
			expect(spySaveFuelData).toHaveBeenCalled();
			expect(spySaveCarSetup).toHaveBeenCalled();
			expect(spySaveRadio).toHaveBeenCalled();
			expect(spySaveCorrelations).toHaveBeenCalled();

			expect(spyGenerateSummary).toHaveBeenCalled();

			// Verify result structure
			expect(result).toMatchObject({
				data: expect.any(Object),
				duration: expect.any(Number),
				message: expect.any(String),
				success: true,
				summary: expect.any(Object),
				timestamp: expect.any(Date)
			});

			// Verify data counts
			expect(result.data).toEqual({
				carSetupData: 1,
				fuelData: 1,
				performanceCorrelations: 1,
				radioCommunications: 1,
				telemetryData: 1,
				tireStrategyData: 1
			});

			// Verify logger was called
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Performance data scraping completed successfully',
				expect.any(Object)
			);
		});

		it('should handle errors properly and return error result', async () => {
			// Mock a method to throw an error
			jest
				.spyOn(scraper as any, 'generateTelemetryData')
				.mockRejectedValue(new Error('Test error'));

			// Execute scrape method
			const result = await scraper.scrape();

			// Verify result structure for error case
			expect(result).toMatchObject({
				data: {},
				duration: expect.any(Number),
				message: expect.stringContaining('Test error'),
				success: false,
				timestamp: expect.any(Date)
			});

			// Verify logger captured the error
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Performance data scraping failed',
				expect.objectContaining({
					error: 'Test error'
				})
			);
		});
	});

	describe('data generation methods', () => {
		it('should generate telemetry data', async () => {
			const telemetryData = await (scraper as any).generateTelemetryData();
			expect(Array.isArray(telemetryData)).toBe(true);
			expect(telemetryData.length).toBeGreaterThan(0);
			expect(telemetryData[0]).toHaveProperty('sessionId');
			expect(telemetryData[0]).toHaveProperty('timestamp');
			expect(telemetryData[0]).toHaveProperty('speed');
		});

		it('should generate tire strategy data', async () => {
			const tireData = await (scraper as any).generateTireStrategyData();
			expect(Array.isArray(tireData)).toBe(true);
			expect(tireData.length).toBeGreaterThan(0);
			expect(tireData[0]).toHaveProperty('raceId');
			expect(tireData[0]).toHaveProperty('driverId');
			expect(tireData[0]).toHaveProperty('tireCompound');
		});

		it('should calculate performance correlations', async () => {
			const correlations = await (
				scraper as any
			).calculatePerformanceCorrelations();
			expect(Array.isArray(correlations)).toBe(true);
			expect(correlations.length).toBeGreaterThan(0);
			expect(correlations[0]).toHaveProperty('correlationId');
			expect(correlations[0]).toHaveProperty('factorOne');
			expect(correlations[0]).toHaveProperty('factorTwo');
			expect(correlations[0]).toHaveProperty('correlationStrength');
		});
	});

	describe('data saving methods', () => {
		it('should save telemetry data to database', async () => {
			const mockData = [
				{
					brake: 0.1,
					gear: 6,
					rpm: 12000,
					sessionId: 'session-123',
					speed: 180.5,
					throttle: 0.9,
					timestamp: new Date()
				}
			];

			await (scraper as any).saveTelemetryData(mockData);

			// Verify DB query was called with correct parameters
			expect(mockDb.query).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO telemetry_data'),
				expect.arrayContaining([
					'session-123',
					expect.any(Date),
					180.5,
					12000,
					6,
					0.9,
					0.1
				])
			);
		});

		it('should handle empty data arrays gracefully', async () => {
			// Test with empty array
			await (scraper as any).saveTelemetryData([]);

			// Verify no DB query was made
			expect(mockDb.query).not.toHaveBeenCalled();

			// Verify logger was called with proper message
			expect(mockLogger.debug).toHaveBeenCalledWith(
				'No telemetry data to save',
				expect.any(Object)
			);
		});
	});

	describe('analytics summary generation', () => {
		it('should generate a comprehensive performance analytics summary', async () => {
			// Mock DB responses for summary queries
			mockDb.query
				// First query - telemetry stats
				.mockResolvedValueOnce({ rows: [{ avg_speed: 180.5, count: 1000 }] })
				// Second query - tire changes
				.mockResolvedValueOnce({ rows: [{ total_changes: 50 }] })
				// Third query - fuel efficiency
				.mockResolvedValueOnce({ rows: [{ avg_efficiency: 2.8 }] })
				// Fourth query - car setup
				.mockResolvedValueOnce({
					rows: [{ count: 5, setup_name: 'Medium downforce' }]
				})
				// Fifth query - performance factors
				.mockResolvedValueOnce({
					rows: [
						{ factor: 'tire temperature', importance: 0.85 },
						{ factor: 'downforce level', importance: 0.78 }
					]
				});

			const summary = await (
				scraper as any
			).generatePerformanceAnalyticsSummary();

			// Verify summary structure
			expect(summary).toMatchObject({
				avg_fuel_efficiency: 2.8,
				avg_speed: 180.5,
				key_performance_factors: ['tire temperature', 'downforce level'],
				top_performing_setup: 'Medium downforce',
				total_telemetry_points: 1000,
				total_tire_changes: 50
			});

			// Verify DB queries were made
			expect(mockDb.query).toHaveBeenCalledTimes(5);
		});
	});
});
