import { StructuredLogger } from '../structured-logger';

export interface RetryOptions {
	maxAttempts?: number;
	baseDelay?: number;
	maxDelay?: number;
	backoffFactor?: number;
	jitter?: boolean;
}

export interface RetryContext {
	attempt: number;
	maxAttempts: number;
	delay: number;
	error?: Error;
}

/**
 * Retry manager for handling retry logic with exponential backoff
 */
export class RetryManager {
	private logger: StructuredLogger;

	constructor(component: string = 'retry-manager') {
		this.logger = new StructuredLogger(component);
	}

	/**
	 * Execute a function with retry logic
	 */
	public async withRetry<T>(
		fn: (context: RetryContext) => Promise<T>,
		options: RetryOptions = {}
	): Promise<T> {
		const {
			maxAttempts = 3,
			baseDelay = 1000,
			maxDelay = 30000,
			backoffFactor = 2,
			jitter = true
		} = options;

		let lastError: Error;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const context: RetryContext = {
					attempt,
					delay: this.calculateDelay(
						attempt,
						baseDelay,
						maxDelay,
						backoffFactor,
						jitter
					),
					maxAttempts
				};

				const result = await fn(context);

				if (attempt > 1) {
					this.logger.info(
						`Operation succeeded on attempt ${attempt}`,
						'retry',
						{
							attempt,
							maxAttempts
						}
					);
				}

				return result;
			} catch (error: any) {
				lastError = error;

				this.logger.warn(`Attempt ${attempt} failed`, 'retry', {
					attempt,
					error: error.message,
					maxAttempts
				});

				if (attempt === maxAttempts) {
					this.logger.error(`All ${maxAttempts} attempts failed`, 'retry', {
						finalError: error.message,
						maxAttempts
					});
					throw error;
				}

				// Wait before next attempt
				const delay = this.calculateDelay(
					attempt,
					baseDelay,
					maxDelay,
					backoffFactor,
					jitter
				);
				await this.sleep(delay);
			}
		}

		throw lastError!;
	}

	/**
	 * Calculate delay for next attempt
	 */
	private calculateDelay(
		attempt: number,
		baseDelay: number,
		maxDelay: number,
		backoffFactor: number,
		jitter: boolean
	): number {
		let delay = baseDelay * backoffFactor ** (attempt - 1);

		// Apply jitter to prevent thundering herd
		if (jitter) {
			delay = delay * (0.5 + Math.random() * 0.5);
		}

		return Math.min(delay, maxDelay);
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Create a retry manager for a specific component
	 */
	public static forComponent(component: string): RetryManager {
		return new RetryManager(component);
	}
}

export default RetryManager;
