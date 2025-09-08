import {
	ErrorHandler,
	type ErrorContext,
	type RetryOptions
} from '../../src/base/error-handler';
import { TestHelpers } from '../utils/test-helpers';
import '../setup'; // Import custom matchers

describe('ErrorHandler', () => {
	let errorHandler: ErrorHandler;
	let mockLogger: jest.Mocked<any>;

	beforeEach(() => {
		errorHandler = new ErrorHandler('test-component');
		mockLogger = TestHelpers.createMockLogger();

		// Mock the logger
		(errorHandler as any).logger = mockLogger;
	});

	describe('Error Handling', () => {
		it('should handle and log errors with context', () => {
			const originalError = new Error('Test error');
			const context: ErrorContext = {
				component: 'test-component',
				metadata: { testData: 'value' },
				operation: 'test_operation'
			};

			const handledError = errorHandler.handleError(originalError, context);

			expect(handledError.message).toBe('test_operation failed: Test error');
			expect((handledError as any).context).toEqual(context);
			expect((handledError as any).originalError).toBe(originalError);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'test_operation failed in test-component',
				'test-component',
				expect.objectContaining({
					error: 'Test error',
					testData: 'value'
				})
			);
		});

		it('should normalize string errors to Error objects', () => {
			const context: ErrorContext = {
				component: 'test-component',
				operation: 'test_operation'
			};

			const handledError = errorHandler.handleError('String error', context);

			expect(handledError.message).toBe('test_operation failed: String error');
			expect(handledError).toBeInstanceOf(Error);
		});

		it('should normalize object errors to Error objects', () => {
			const context: ErrorContext = {
				component: 'test-component',
				operation: 'test_operation'
			};

			const objectError = { code: 500, message: 'Object error' };
			const handledError = errorHandler.handleError(objectError, context);

			expect(handledError.message).toBe('test_operation failed: Object error');
			expect(handledError).toBeInstanceOf(Error);
		});

		it('should handle unknown error types', () => {
			const context: ErrorContext = {
				component: 'test-component',
				operation: 'test_operation'
			};

			const handledError = errorHandler.handleError(null, context);

			expect(handledError.message).toBe(
				'test_operation failed: Unknown error occurred'
			);
			expect(handledError).toBeInstanceOf(Error);
		});

		it('should determine error severity correctly', () => {
			const context: ErrorContext = {
				component: 'database',
				operation: 'database_operation'
			};

			// Test database error
			const dbError = new Error('ECONNREFUSED connection failed');
			const handledDbError = errorHandler.handleError(dbError, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					severity: 'high'
				})
			);
		});

		it('should determine timeout error severity', () => {
			const context: ErrorContext = {
				component: 'network',
				operation: 'network_operation'
			};

			const timeoutError = new Error('Request timeout occurred');
			const handledError = errorHandler.handleError(timeoutError, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					severity: 'medium'
				})
			);
		});

		it('should determine HTTP error severities', () => {
			const context: ErrorContext = {
				component: 'api',
				operation: 'http_request'
			};

			// Test 5xx error (high severity)
			const serverError = new Error('HTTP 500 Internal Server Error');
			errorHandler.handleError(serverError, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					severity: 'high'
				})
			);

			// Reset mock
			mockLogger.error.mockClear();

			// Test 4xx error (medium severity)
			const clientError = new Error('HTTP 404 Not Found');
			errorHandler.handleError(clientError, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					severity: 'medium'
				})
			);
		});

		it('should determine validation error severity as critical', () => {
			const context: ErrorContext = {
				component: 'validator',
				operation: 'schema_validation'
			};

			const validationError = new Error('Schema validation failed');
			errorHandler.handleError(validationError, context);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.objectContaining({
					severity: 'critical'
				})
			);
		});
	});

	describe('Retry Logic', () => {
		it('should retry operations on retryable errors', async () => {
			let attempts = 0;
			const operation = jest.fn().mockImplementation(async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error('timeout');
				}
				return 'success';
			});

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_retry'
			};

			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 10, // Small delay for testing
				maxAttempts: 3,
				maxDelay: 100
			};

			const result = await errorHandler.withRetry(operation, context, options);

			expect(result).toBe('success');
			expect(operation).toHaveBeenCalledTimes(3);
			expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Two retry warnings
		});

		it('should not retry non-retryable errors', async () => {
			const operation = jest
				.fn()
				.mockRejectedValue(new Error('Non-retryable error'));

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_no_retry'
			};

			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 10,
				maxAttempts: 3,
				maxDelay: 100,
				retryableErrors: ['timeout', 'ECONNREFUSED'] // Non-retryable error not in list
			};

			await expect(
				errorHandler.withRetry(operation, context, options)
			).rejects.toThrow('Non-retryable error');

			expect(operation).toHaveBeenCalledTimes(1); // No retries
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it('should give up after max attempts', async () => {
			const operation = jest.fn().mockRejectedValue(new Error('timeout'));

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_max_attempts'
			};

			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 10,
				maxAttempts: 2,
				maxDelay: 100
			};

			await expect(
				errorHandler.withRetry(operation, context, options)
			).rejects.toThrow('timeout');

			expect(operation).toHaveBeenCalledTimes(2);
			expect(mockLogger.warn).toHaveBeenCalledTimes(1); // One retry warning
		});

		it('should calculate exponential backoff delays correctly', async () => {
			const delays: number[] = [];
			const originalSetTimeout = global.setTimeout;

			// Mock setTimeout to capture delays
			const mockSetTimeout = jest
				.fn()
				.mockImplementation((fn: Function, delay: number) => {
					delays.push(delay);
					return originalSetTimeout(fn, 0); // Execute immediately for testing
				}) as any;
			mockSetTimeout.__promisify__ = jest.fn();
			global.setTimeout = mockSetTimeout;

			let attempts = 0;
			const operation = jest.fn().mockImplementation(async () => {
				attempts++;
				if (attempts < 4) {
					throw new Error('timeout');
				}
				return 'success';
			});

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_backoff'
			};

			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 100,
				maxAttempts: 4,
				maxDelay: 1000
			};

			try {
				await errorHandler.withRetry(operation, context, options);
			} catch (error) {
				// Expected to succeed after retries
			}

			// Restore setTimeout
			global.setTimeout = originalSetTimeout;

			// Check that delays follow exponential backoff pattern (with jitter)
			expect(delays).toHaveLength(3); // 3 retries
			expect(delays[0]).toBeGreaterThanOrEqual(90); // ~100ms with jitter
			expect(delays[0]).toBeLessThanOrEqual(110);
			expect(delays[1]).toBeGreaterThanOrEqual(180); // ~200ms with jitter
			expect(delays[1]).toBeLessThanOrEqual(220);
		});

		it('should respect max delay limit', async () => {
			const delays: number[] = [];
			const originalSetTimeout = global.setTimeout;

			const mockSetTimeout2 = jest
				.fn()
				.mockImplementation((fn: Function, delay: number) => {
					delays.push(delay);
					return originalSetTimeout(fn, 0);
				}) as any;
			mockSetTimeout2.__promisify__ = jest.fn();
			global.setTimeout = mockSetTimeout2;

			let attempts = 0;
			const operation = jest.fn().mockImplementation(async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error('timeout');
				}
				return 'success';
			});

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_max_delay'
			};

			const options: RetryOptions = {
				backoffFactor: 4,
				baseDelay: 1000,
				maxAttempts: 3,
				maxDelay: 500 // Max delay less than base delay * backoff
			};

			await errorHandler.withRetry(operation, context, options);

			global.setTimeout = originalSetTimeout;

			// All delays should be capped at maxDelay
			expect(delays.every((delay) => delay <= 550)).toBe(true); // 500 + 10% jitter
		});

		it('should handle custom retryable errors', async () => {
			const operation = jest.fn().mockRejectedValue(new Error('CUSTOM_ERROR'));

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_custom_retry'
			};

			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 10,
				maxAttempts: 2,
				maxDelay: 100,
				retryableErrors: ['CUSTOM_ERROR']
			};

			await expect(
				errorHandler.withRetry(operation, context, options)
			).rejects.toThrow('CUSTOM_ERROR');

			expect(operation).toHaveBeenCalledTimes(2); // Should retry custom error
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
		});
	});

	describe('Circuit Breaker', () => {
		it('should execute operation successfully without circuit breaker triggering', async () => {
			const operation = jest.fn().mockResolvedValue('success');

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_circuit_breaker'
			};

			const result = await errorHandler.withCircuitBreaker(operation, context);

			expect(result).toBe('success');
			expect(operation).toHaveBeenCalledTimes(1);
		});

		it('should handle errors in circuit breaker', async () => {
			const operation = jest
				.fn()
				.mockRejectedValue(new Error('Circuit breaker test error'));

			const context: ErrorContext = {
				component: 'test',
				operation: 'test_circuit_breaker_error'
			};

			await expect(
				errorHandler.withCircuitBreaker(operation, context)
			).rejects.toThrow('Circuit breaker test error');

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('test_circuit_breaker_error failed in test'),
				'test',
				expect.objectContaining({
					circuitKey: 'test:test_circuit_breaker_error',
					timestamp: expect.any(Number)
				})
			);
		});
	});

	describe('Static Methods', () => {
		it('should create error handler for specific component', () => {
			const componentHandler = ErrorHandler.forComponent('database');
			expect(componentHandler).toBeInstanceOf(ErrorHandler);
		});

		it('should setup global error handlers', () => {
			const originalProcessOn = process.on;
			const mockOn = jest.fn();
			process.on = mockOn;

			ErrorHandler.setupGlobalHandlers();

			expect(mockOn).toHaveBeenCalledWith(
				'unhandledRejection',
				expect.any(Function)
			);
			expect(mockOn).toHaveBeenCalledWith(
				'uncaughtException',
				expect.any(Function)
			);

			process.on = originalProcessOn;
		});
	});

	describe('Error Classification', () => {
		it('should identify retryable errors correctly', () => {
			const retryableErrors = [
				new Error('timeout occurred'),
				new Error('ECONNREFUSED'),
				new Error('ENOTFOUND'),
				new Error('HTTP 503 Service Unavailable'),
				new Error('ETIMEDOUT'),
				new Error('socket hang up')
			];

			// Use private method for testing
			retryableErrors.forEach((error) => {
				const isRetryable = (errorHandler as any).isRetryable(error);
				expect(isRetryable).toBe(true);
			});
		});

		it('should identify non-retryable errors correctly', () => {
			const nonRetryableErrors = [
				new Error('Invalid input'),
				new Error('Authentication failed'),
				new Error('HTTP 400 Bad Request'),
				new Error('Permission denied')
			];

			nonRetryableErrors.forEach((error) => {
				const isRetryable = (errorHandler as any).isRetryable(error);
				expect(isRetryable).toBe(false);
			});
		});
	});

	describe('Utility Methods', () => {
		it('should calculate delay with exponential backoff', () => {
			const options: RetryOptions = {
				backoffFactor: 2,
				baseDelay: 100,
				maxAttempts: 5,
				maxDelay: 10000
			};

			// Test different attempts
			const delay1 = (errorHandler as any).calculateDelay(1, options);
			const delay2 = (errorHandler as any).calculateDelay(2, options);
			const delay3 = (errorHandler as any).calculateDelay(3, options);

			expect(delay1).toBeWithinRange(90, 110); // ~100ms with jitter
			expect(delay2).toBeWithinRange(180, 220); // ~200ms with jitter
			expect(delay3).toBeWithinRange(360, 440); // ~400ms with jitter
		});

		it('should respect max delay in calculation', () => {
			const options: RetryOptions = {
				backoffFactor: 3,
				baseDelay: 1000,
				maxAttempts: 10,
				maxDelay: 2000
			};

			const delay = (errorHandler as any).calculateDelay(5, options); // Would be 81000 without max
			expect(delay).toBeLessThanOrEqual(2200); // Max delay + 10% jitter
		});
	});
});
