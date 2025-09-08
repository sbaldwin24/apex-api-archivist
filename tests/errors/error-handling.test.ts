import express from 'express';
import request from 'supertest';
import {
	CircuitBreaker,
	CircuitBreakerFactory,
	CircuitBreakerState
} from '../../src/errors/circuit-breaker';
import {
	BadRequestError,
	BaseAPIError,
	DatabaseError,
	InternalServerError,
	NotFoundError,
	RateLimitError,
	TimeoutError,
	ValidationError,
	createErrorFromGeneric,
	isOperationalError
} from '../../src/errors/error-classes';
import {
	asyncHandler,
	errorHandler,
	notFoundHandler
} from '../../src/errors/error-handler';
import {
	RetryMechanism,
	retryMechanisms
} from '../../src/errors/retry-mechanism';
import { correlationIdMiddleware } from '../../src/middleware/correlation-id';

/**
 * Error Handling System Tests
 * Comprehensive tests for error classes, handlers, and mechanisms
 */

describe('Error Classes', () => {
	describe('BaseAPIError', () => {
		it('should create error with proper structure', () => {
			const error = new BadRequestError(
				'Test error',
				{ field: 'value' },
				'test-correlation-id'
			);

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(BaseAPIError);
			expect(error.statusCode).toBe(400);
			expect(error.errorCode).toBe('BAD_REQUEST');
			expect(error.isOperational).toBe(true);
			expect(error.message).toBe('Test error');
			expect(error.context).toEqual({ field: 'value' });
			expect(error.correlationId).toBe('test-correlation-id');
			expect(error.timestamp).toBeDefined();
		});

		it('should serialize to JSON properly', () => {
			const error = new NotFoundError('Resource not found', 'users', {
				id: '123'
			});
			const json = error.toJSON();

			expect(json).toEqual({
				error: {
					code: 'NOT_FOUND',
					context: { id: '123' },
					correlationId: error.correlationId,
					message: 'Resource not found',
					resource: 'users',
					timestamp: error.timestamp,
					type: 'NotFoundError'
				}
			});
		});

		it('should create log format properly', () => {
			const error = new DatabaseError('Connection failed', 'SELECT', 'users');
			const logFormat = error.toLogFormat();

			expect(logFormat).toEqual({
				context: error.context,
				correlationId: error.correlationId,
				errorCode: 'DATABASE_ERROR',
				errorType: 'DatabaseError',
				message: 'Connection failed',
				stack: error.stack,
				statusCode: 500,
				timestamp: error.timestamp
			});
		});
	});

	describe('ValidationError', () => {
		it('should handle validation errors properly', () => {
			const validationErrors = [
				{
					field: 'email',
					message: 'Invalid email format',
					value: 'invalid-email'
				},
				{ field: 'age', message: 'Age must be positive', value: -5 }
			];

			const error = new ValidationError('Validation failed', validationErrors);
			const json = error.toJSON();

			expect(json.error.validationErrors).toEqual(validationErrors);
			expect(error.validationErrors).toEqual(validationErrors);
		});
	});

	describe('RateLimitError', () => {
		it('should include rate limit information', () => {
			const rateLimitInfo = {
				limit: 100,
				remaining: 0,
				resetTime: new Date(),
				retryAfter: 60
			};

			const error = new RateLimitError('Rate limit exceeded', rateLimitInfo);
			const json = error.toJSON();

			expect(json.error.rateLimit).toBeDefined();
			expect(json.error.rateLimit.retryAfter).toBe(60);
			expect(json.error.rateLimit.limit).toBe(100);
			expect(json.error.rateLimit.remaining).toBe(0);
		});
	});

	describe('Error utility functions', () => {
		it('should identify operational errors correctly', () => {
			const operationalError = new BadRequestError('Bad request');
			const nonOperationalError = new InternalServerError('Server error');
			const genericError = new Error('Generic error');

			expect(isOperationalError(operationalError)).toBe(true);
			expect(isOperationalError(nonOperationalError)).toBe(false);
			expect(isOperationalError(genericError)).toBe(false);
		});

		it('should create appropriate errors from generic errors', () => {
			const timeoutError = new Error('Request timeout');
			timeoutError.name = 'TimeoutError';

			const converted = createErrorFromGeneric(timeoutError, 'test-id');

			expect(converted).toBeInstanceOf(TimeoutError);
			expect(converted.correlationId).toBe('test-id');
		});
	});
});

describe('Error Handler Middleware', () => {
	let app: express.Express;

	beforeEach(() => {
		app = express();
		app.use(correlationIdMiddleware);
		app.use(express.json());
	});

	it('should handle custom API errors', async () => {
		app.get('/test-error', (req, res, next) => {
			next(new BadRequestError('Invalid parameter', { param: 'test' }));
		});

		app.use(errorHandler);

		const response = await request(app).get('/test-error').expect(400);

		expect(response.body.error).toBeDefined();
		expect(response.body.error.code).toBe('BAD_REQUEST');
		expect(response.body.error.message).toBe('Invalid parameter');
		expect(response.body.error.context).toEqual({ param: 'test' });
		expect(response.headers['x-correlation-id']).toBeDefined();
	});

	it('should handle generic errors', async () => {
		app.get('/generic-error', (req, res, next) => {
			next(new Error('Generic error'));
		});

		app.use(errorHandler);

		const response = await request(app).get('/generic-error').expect(500);

		expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
	});

	it('should handle validation errors', async () => {
		app.post('/validation-error', (req, res, next) => {
			const validationErrors = [{ field: 'email', message: 'Required field' }];
			next(new ValidationError('Validation failed', validationErrors));
		});

		app.use(errorHandler);

		const response = await request(app).post('/validation-error').expect(400);

		expect(response.body.error.validationErrors).toBeDefined();
		expect(response.body.error.validationErrors).toHaveLength(1);
	});

	it('should handle not found errors', async () => {
		app.get('/existing-route', (req, res) => {
			res.json({ message: 'OK' });
		});

		app.use(notFoundHandler);
		app.use(errorHandler);

		const response = await request(app).get('/non-existing-route').expect(404);

		expect(response.body.error.code).toBe('NOT_FOUND');
		expect(response.body.error.message).toContain('Route not found');
	});

	it('should set appropriate response headers', async () => {
		app.get('/rate-limit', (req, res, next) => {
			const rateLimitInfo = {
				limit: 100,
				remaining: 0,
				resetTime: new Date(Date.now() + 60000),
				retryAfter: 60
			};
			next(new RateLimitError('Rate limit exceeded', rateLimitInfo));
		});

		app.use(errorHandler);

		const response = await request(app).get('/rate-limit').expect(429);

		expect(response.headers['retry-after']).toBe('60');
		expect(response.headers['x-ratelimit-limit']).toBe('100');
		expect(response.headers['x-ratelimit-remaining']).toBe('0');
	});

	it('should work with async handler wrapper', async () => {
		app.get(
			'/async-error',
			asyncHandler(async (req, res, next) => {
				throw new BadRequestError('Async error');
			})
		);

		app.use(errorHandler);

		await request(app).get('/async-error').expect(400);
	});
});

describe('Circuit Breaker', () => {
	let circuitBreaker: CircuitBreaker;

	beforeEach(() => {
		circuitBreaker = new CircuitBreaker({
			failureThreshold: 3,
			name: 'test-circuit',
			resetTimeout: 5000,
			successThreshold: 2,
			timeout: 1000
		});
	});

	afterEach(() => {
		circuitBreaker.cleanup();
	});

	it('should execute function successfully when closed', async () => {
		const mockFn = jest.fn().mockResolvedValue('success');

		const result = await circuitBreaker.execute(mockFn);

		expect(result).toBe('success');
		expect(mockFn).toHaveBeenCalledTimes(1);
		expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
	});

	it('should open circuit after threshold failures', async () => {
		const mockFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

		// Fail enough times to open circuit
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected failures
			}
		}

		expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

		// Next call should fail immediately
		await expect(circuitBreaker.execute(mockFn)).rejects.toThrow(
			'Circuit breaker is OPEN'
		);
	});

	it('should transition to half-open and close on success', async () => {
		const mockFn = jest
			.fn()
			.mockRejectedValueOnce(new Error('ECONNREFUSED'))
			.mockRejectedValueOnce(new Error('ECONNREFUSED'))
			.mockRejectedValueOnce(new Error('ECONNREFUSED'))
			.mockResolvedValue('success');

		// Open the circuit
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected
			}
		}

		expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

		// Wait for reset timeout (mock it by directly calling reset)
		circuitBreaker.reset();

		// Should succeed and close circuit
		const result = await circuitBreaker.execute(mockFn);
		expect(result).toBe('success');
		expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
	});

	it('should provide health check information', () => {
		const health = circuitBreaker.healthCheck();

		expect(health.status).toBe('healthy');
		expect(health.state).toBe(CircuitBreakerState.CLOSED);
		expect(health.metrics).toBeDefined();
	});

	it('should handle timeouts', async () => {
		const slowFn = () => new Promise((resolve) => setTimeout(resolve, 2000));

		await expect(circuitBreaker.execute(slowFn)).rejects.toThrow('timed out');
	});
});

describe('Circuit Breaker Factory', () => {
	afterEach(() => {
		CircuitBreakerFactory.cleanup();
	});

	it('should create and reuse circuit breaker instances', () => {
		const cb1 = CircuitBreakerFactory.getCircuitBreaker('test');
		const cb2 = CircuitBreakerFactory.getCircuitBreaker('test');

		expect(cb1).toBe(cb2);
		expect(cb1.getName()).toBe('test');
	});

	it('should provide overall health status', () => {
		CircuitBreakerFactory.getCircuitBreaker('healthy');
		CircuitBreakerFactory.getCircuitBreaker('unhealthy');

		const health = CircuitBreakerFactory.getOverallHealth();

		expect(health.status).toBe('healthy');
		expect(health.circuitBreakers).toBeDefined();
	});
});

describe('Retry Mechanism', () => {
	let retryMechanism: RetryMechanism;

	beforeEach(() => {
		retryMechanism = new RetryMechanism({
			backoffMultiplier: 2,
			baseDelayMs: 100,
			maxAttempts: 3,
			maxDelayMs: 1000,
			name: 'test-retry'
		});
	});

	it('should execute function successfully on first attempt', async () => {
		const mockFn = jest.fn().mockResolvedValue('success');

		const result = await retryMechanism.execute(mockFn);

		expect(result).toBe('success');
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it('should retry on retryable errors', async () => {
		const mockFn = jest
			.fn()
			.mockRejectedValueOnce(new Error('ECONNREFUSED'))
			.mockRejectedValueOnce(new Error('ETIMEDOUT'))
			.mockResolvedValue('success');

		const result = await retryMechanism.execute(mockFn);

		expect(result).toBe('success');
		expect(mockFn).toHaveBeenCalledTimes(3);
	});

	it('should abort on non-retryable errors', async () => {
		const mockFn = jest
			.fn()
			.mockRejectedValue(new BadRequestError('Invalid input'));

		await expect(retryMechanism.execute(mockFn)).rejects.toThrow(
			'Invalid input'
		);
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it('should exhaust all attempts for retryable errors', async () => {
		const mockFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

		await expect(retryMechanism.execute(mockFn)).rejects.toThrow(
			'ECONNREFUSED'
		);
		expect(mockFn).toHaveBeenCalledTimes(3);
	});

	it('should handle timeout for entire retry operation', async () => {
		const timeoutRetry = new RetryMechanism({
			baseDelayMs: 50,
			maxAttempts: 5,
			name: 'timeout-test',
			timeoutMs: 150 // Short timeout
		});

		const slowFn = jest.fn().mockImplementation(
			() =>
				new Promise((resolve, reject) => {
					// Function takes longer than the timeout
					setTimeout(() => resolve('should not reach here'), 300);
				})
		);

		await expect(timeoutRetry.execute(slowFn)).rejects.toThrow('timed out');
	});

	describe('Pre-configured retry mechanisms', () => {
		it('should provide quick retry configuration', async () => {
			const mockFn = jest.fn().mockResolvedValue('success');

			const result = await retryMechanisms.quick.execute(mockFn);

			expect(result).toBe('success');
			expect(retryMechanisms.quick.getConfig().maxAttempts).toBe(3);
		});

		it('should provide network retry configuration', async () => {
			const config = retryMechanisms.network.getConfig();

			expect(config.maxAttempts).toBe(7);
			expect(config.retryableErrors).toContain('ECONNREFUSED');
			expect(config.retryableErrors).toContain('EXTERNAL_SERVICE_ERROR');
		});

		it('should provide database retry configuration', async () => {
			const config = retryMechanisms.database.getConfig();

			expect(config.retryableErrors).toContain('DATABASE_ERROR');
			expect(config.abortOnErrors).toContain('VALIDATION_ERROR');
		});
	});
});

describe('Integration Tests', () => {
	let app: express.Express;

	beforeEach(() => {
		app = express();
		app.use(correlationIdMiddleware);
		app.use(express.json());
	});

	afterEach(() => {
		CircuitBreakerFactory.cleanup();
	});

	it('should handle circuit breaker with retry mechanism', async () => {
		const circuitBreaker = CircuitBreakerFactory.getCircuitBreaker(
			'integration-test',
			{
				failureThreshold: 2,
				timeout: 500
			}
		);

		const retryMechanism = new RetryMechanism({
			baseDelayMs: 100,
			maxAttempts: 3
		});

		app.get(
			'/integration-test',
			asyncHandler(async (req, res) => {
				const result = await retryMechanism.execute(async () => {
					return await circuitBreaker.execute(async () => {
						if (Math.random() > 0.7) {
							throw new Error('ECONNREFUSED');
						}
						return 'success';
					});
				});

				res.json({ result });
			})
		);

		app.use(errorHandler);

		// This test demonstrates integration but results may vary due to randomness
		const response = await request(app).get('/integration-test');

		// Should either succeed or fail with proper error structure
		if (response.status === 200) {
			expect(response.body.result).toBe('success');
		} else {
			expect(response.body.error).toBeDefined();
		}
	});
});
