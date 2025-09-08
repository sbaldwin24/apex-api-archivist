import { StructuredLogger } from '../structured-logger';
import type BaseScraper from './base-scraper';
import ErrorHandler from './error-handler';
import SchemaManager from './schema-manager';

export interface ScraperDefinition {
	name: string;
	description: string;
	dependencies?: string[];
	priority: number;
	enabled: boolean;
	schemas?: string[];
	factory: () => BaseScraper;
}

export interface ScraperRunOptions {
	parallel?: boolean;
	maxConcurrency?: number;
	continueOnError?: boolean;
	dryRun?: boolean;
}

export class ScraperManager {
	private scrapers: Map<string, ScraperDefinition> = new Map();
	private logger: StructuredLogger;
	private errorHandler: ErrorHandler;
	private schemaManager: SchemaManager;

	constructor() {
		this.logger = new StructuredLogger('scraper-manager');
		this.errorHandler = ErrorHandler.forComponent('scraper-manager');
		this.schemaManager = new SchemaManager();
	}

	/**
	 * Register a scraper
	 */
	register(definition: ScraperDefinition): void {
		if (this.scrapers.has(definition.name)) {
			this.logger.warn(
				`Scraper '${definition.name}' is already registered`,
				'registration'
			);
			return;
		}

		this.scrapers.set(definition.name, definition);
		this.logger.info(`Registered scraper: ${definition.name}`, 'registration');
	}

	/**
	 * Register multiple scrapers
	 */
	registerScrapers(definitions: ScraperDefinition[]): void {
		for (const definition of definitions) {
			this.register(definition);
		}
	}

	/**
	 * Get scraper definition
	 */
	getScraper(name: string): ScraperDefinition | undefined {
		return this.scrapers.get(name);
	}

	/**
	 * List all registered scrapers
	 */
	listScrapers(): ScraperDefinition[] {
		return Array.from(this.scrapers.values());
	}

	/**
	 * List enabled scrapers
	 */
	listEnabledScrapers(): ScraperDefinition[] {
		return this.listScrapers().filter((scraper) => scraper.enabled);
	}

	/**
	 * Run a specific scraper
	 */
	async runScraper(
		name: string,
		options: ScraperRunOptions = {}
	): Promise<void> {
		const definition = this.scrapers.get(name);
		if (!definition) {
			throw new Error(`Scraper '${name}' not found`);
		}

		if (!definition.enabled) {
			this.logger.info(`Scraper '${name}' is disabled, skipping`, 'execution');
			return;
		}

		await this.errorHandler.withRetry(
			async () => {
				this.logger.info(`Starting scraper: ${definition.name}`, 'execution');

				// Setup schemas if needed
				if (definition.schemas && definition.schemas.length > 0) {
					await this.schemaManager.setupSchemas(definition.schemas);
				}

				// Run dependencies first
				if (definition.dependencies) {
					for (const dep of definition.dependencies) {
						await this.runScraper(dep, options);
					}
				}

				// Create and run the scraper
				if (!options.dryRun) {
					const scraper = definition.factory();
					await scraper.run();
				} else {
					this.logger.info(
						`Dry run: Would execute scraper '${definition.name}'`,
						'execution'
					);
				}

				this.logger.info(`Completed scraper: ${definition.name}`, 'execution');
			},
			{
				component: 'scraper-manager',
				metadata: { scraperName: name },
				operation: 'run_scraper'
			}
		);
	}

	/**
	 * Run multiple scrapers
	 */
	async runScrapers(
		scraperNames: string[],
		options: ScraperRunOptions = {}
	): Promise<Array<{ scraperName: string; success: boolean; error?: string }>> {
		const orderedScrapers = this.orderScrapersByDependencies(scraperNames);

		if (options.parallel && options.maxConcurrency) {
			return await this.runScrapersWithConcurrency(orderedScrapers, options);
		} else if (options.parallel) {
			return await this.runScrapersInParallel(orderedScrapers, options);
		} else {
			return await this.runScrapersSequentially(orderedScrapers, options);
		}
	}

	/**
	 * Run all enabled scrapers
	 */
	async runAllScrapers(options: ScraperRunOptions = {}): Promise<void> {
		const enabledScrapers = this.listEnabledScrapers().map((s) => s.name);
		await this.runScrapers(enabledScrapers, options);
	}

	/**
	 * Run scrapers sequentially
	 */
	private async runScrapersSequentially(
		scraperNames: string[],
		options: ScraperRunOptions
	): Promise<Array<{ scraperName: string; success: boolean; error?: string }>> {
		const results: Array<{
			scraperName: string;
			success: boolean;
			error?: string;
		}> = [];

		for (const name of scraperNames) {
			try {
				await this.runScraper(name, options);
				results.push({ scraperName: name, success: true });
			} catch (error) {
				const errorMessage = (error as Error).message;
				if (options.continueOnError) {
					this.logger.warn(
						`Scraper '${name}' failed, continuing`,
						'execution',
						{
							error: errorMessage
						}
					);
					results.push({
						error: errorMessage,
						scraperName: name,
						success: false
					});
				} else {
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Run scrapers in parallel
	 */
	private async runScrapersInParallel(
		scraperNames: string[],
		options: ScraperRunOptions
	): Promise<Array<{ scraperName: string; success: boolean; error?: string }>> {
		const promises = scraperNames.map(async (name) => {
			try {
				await this.runScraper(name, options);
				return { scraperName: name, success: true };
			} catch (error) {
				const errorMessage = (error as Error).message;
				if (options.continueOnError) {
					this.logger.warn(
						`Scraper '${name}' failed in parallel execution`,
						'execution',
						{
							error: errorMessage
						}
					);
					return { error: errorMessage, scraperName: name, success: false };
				} else {
					throw error;
				}
			}
		});

		return await Promise.all(promises);
	}

	/**
	 * Run scrapers with limited concurrency
	 */
	private async runScrapersWithConcurrency(
		scraperNames: string[],
		options: ScraperRunOptions
	): Promise<Array<{ scraperName: string; success: boolean; error?: string }>> {
		const maxConcurrency = options.maxConcurrency || 3;
		const semaphore = this.createSemaphore(maxConcurrency);

		const promises = scraperNames.map(async (name) => {
			await semaphore.acquire();
			try {
				await this.runScraper(name, options);
				return { scraperName: name, success: true };
			} catch (error) {
				const errorMessage = (error as Error).message;
				if (options.continueOnError) {
					this.logger.warn(
						`Scraper '${name}' failed with concurrency limit`,
						'execution',
						{
							error: errorMessage
						}
					);
					return { error: errorMessage, scraperName: name, success: false };
				} else {
					throw error;
				}
			} finally {
				semaphore.release();
			}
		});

		return await Promise.all(promises);
	}

	/**
	 * Order scrapers by dependencies and priority
	 */
	private orderScrapersByDependencies(scraperNames: string[]): string[] {
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const ordered: string[] = [];

		const visit = (name: string) => {
			if (visited.has(name)) return;
			if (visiting.has(name)) {
				throw new Error(
					`Circular dependency detected involving scraper '${name}'`
				);
			}

			const definition = this.scrapers.get(name);
			if (!definition) return;

			visiting.add(name);

			// Visit dependencies first
			if (definition.dependencies) {
				for (const dep of definition.dependencies) {
					if (scraperNames.includes(dep)) {
						visit(dep);
					}
				}
			}

			visiting.delete(name);
			visited.add(name);
			ordered.push(name);
		};

		// Sort by priority first
		const sortedByPriority = scraperNames.sort((a, b) => {
			const defA = this.scrapers.get(a);
			const defB = this.scrapers.get(b);
			return (defA?.priority || 999) - (defB?.priority || 999);
		});

		for (const name of sortedByPriority) {
			visit(name);
		}

		return ordered;
	}

	/**
	 * Create a semaphore for concurrency control
	 */
	private createSemaphore(limit: number) {
		const queue: (() => void)[] = [];
		let count = 0;

		return {
			acquire: () =>
				new Promise<void>((resolve) => {
					if (count < limit) {
						count++;
						resolve();
					} else {
						queue.push(resolve);
					}
				}),

			release: () => {
				count--;
				if (queue.length > 0) {
					const next = queue.shift();
					if (next) {
						count++;
						next();
					}
				}
			}
		};
	}

	/**
	 * Validate scraper definitions
	 */
	validateScrapers(): {
		valid: string[];
		invalid: { name: string; errors: string[] }[];
	} {
		const valid: string[] = [];
		const invalid: { name: string; errors: string[] }[] = [];

		for (const [name, definition] of this.scrapers) {
			const errors: string[] = [];

			// Check dependencies exist
			if (definition.dependencies) {
				for (const dep of definition.dependencies) {
					if (!this.scrapers.has(dep)) {
						errors.push(`Dependency '${dep}' not found`);
					}
				}
			}

			// Check schemas exist
			if (definition.schemas) {
				const { invalid: invalidSchemas } =
					this.schemaManager.validateAllSchemaFiles();
				const missingSchemas = definition.schemas.filter((schema) =>
					invalidSchemas.includes(schema)
				);
				if (missingSchemas.length > 0) {
					errors.push(`Schema files not found: ${missingSchemas.join(', ')}`);
				}
			}

			if (errors.length > 0) {
				invalid.push({ errors, name });
			} else {
				valid.push(name);
			}
		}

		return { invalid, valid };
	}

	/**
	 * Get scraper status summary
	 */
	getStatusSummary(): Record<string, any> {
		const total = this.scrapers.size;
		const enabled = this.listEnabledScrapers().length;
		const { valid, invalid } = this.validateScrapers();

		return {
			disabled: total - enabled,
			enabled,
			invalid: invalid.length,
			invalidScrapers: invalid,
			total,
			valid: valid.length
		};
	}
}

export default ScraperManager;
