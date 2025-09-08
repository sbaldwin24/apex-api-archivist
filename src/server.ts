import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { startStandaloneServer } from '@apollo/server/standalone';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { redisCache } from './cache/redis-cache';
import type { AdvancedPool } from './database/advanced-pool';
import { createAdvancedPool } from './database/advanced-pool';
import { createDataLoaders, type DataLoaders } from './dataloaders';
import { databaseMonitor } from './middleware/database-monitoring';
import { performanceMonitor } from './middleware/performance-monitoring';
import { jobProcessor } from './queue/job-processor';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { StructuredLogger } from './structured-logger';

/** Define the enhanced context type for our server */
export interface MyContext {
	db: AdvancedPool;
	dataloaders: DataLoaders;
	cache: typeof redisCache;
	jobProcessor: typeof jobProcessor;
}

/** Enhanced server startup with new systems */
async function startServer() {
	const logger = new StructuredLogger('server');

	try {
		logger.info('Starting NASCAR Data API server...', 'startup');

		/** Initialize enhanced database pool */
		const advancedPool = createAdvancedPool({
			database: process.env.DB_NAME || 'apex_data',
			enableHealthCheck: process.env.DB_ENABLE_HEALTH_CHECK === 'true',
			enableQueryLogging: process.env.DB_ENABLE_QUERY_LOGGING === 'true',
			host: process.env.DB_HOST || 'localhost',
			max: Number(process.env.DB_MAX_CONNECTIONS || '50'),
			min: Number(process.env.DB_MIN_CONNECTIONS || '5'),
			password: process.env.DB_PASSWORD || '',
			port: Number(process.env.DB_PORT || '5432'),
			slowQueryThreshold: Number(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'),
			user: process.env.DB_USER || 'nascar_user'
		});

		/** Test connections */
		logger.info('Testing database connection...', 'startup');

		await advancedPool.query('SELECT 1');

		logger.info('Testing Redis connection...', 'startup');

		const cacheHealth = await redisCache.healthCheck();

		if (cacheHealth.status !== 'healthy') {
			logger.warn(
				'Redis connection unhealthy, caching disabled',
				'startup',
				cacheHealth
			);
		}

		/** Start job processor if enabled */
		if (process.env.ENABLE_JOB_PROCESSOR === 'true') {
			logger.info('Starting job processor...', 'startup');
			/** Job processor will start automatically */
		}

		/** Create Express app */
		const app = express();

		/** Security middleware */
		app.use(
			helmet({
				contentSecurityPolicy: {
					directives: {
						connectSrc: ["'self'"],
						defaultSrc: ["'self'"],
						imgSrc: ["'self'", 'data:', 'https:'],
						scriptSrc: ["'self'"],
						styleSrc: ["'self'", "'unsafe-inline'"]
					}
				}
			})
		);

		/** Rate limiting */
		const limiter = rateLimit({
			legacyHeaders: false,
			max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
			message: 'Too many requests from this IP, please try again later.',
			standardHeaders: true,
			windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || '60000')
		});

		/** Rate limiting */
		app.use('/api', limiter);

		/** CORS configuration */
		const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
			'http://localhost:3000',
			'http://localhost:3001'
		];
		app.use(
			cors({
				credentials: true,
				origin: corsOrigins
			})
		);

		/** Monitoring middleware */
		if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
			app.use(performanceMonitor.middleware);
		}

		/** Body parsing */
		app.use(express.json({ limit: '10mb' }));
		app.use(express.urlencoded({ extended: true, limit: '10mb' }));

		/** Health check endpoints */
		app.get('/health', async (req, res) => {
			try {
				/** Quick health check */
				await advancedPool.query('SELECT 1');
				const cacheCheck = await redisCache.healthCheck();

				res.json({
					services: {
						cache: cacheCheck.status,
						cacheLatency: cacheCheck.latency,
						database: 'healthy'
					},
					status: 'healthy',
					timestamp: new Date().toISOString()
				});
			} catch (error) {
				res.status(503).json({
					error: (error as Error).message,
					status: 'unhealthy',
					timestamp: new Date().toISOString()
				});
			}
		});

		/** Detailed health check */
		app.get('/health/detailed', async (req, res) => {
			try {
				const [dbStats, cacheStats, queueStats] = await Promise.all([
					advancedPool.getPoolStats(),
					redisCache.getStats(),
					jobProcessor.getQueueStats()
				]);

				res.json({
					cache: cacheStats,
					database: dbStats,
					queues: queueStats,
					status: 'healthy',
					timestamp: new Date().toISOString(),
					uptime: process.uptime(),
					version: process.env.API_VERSION || '1.0.0'
				});
			} catch (error) {
				res.status(503).json({
					error: (error as Error).message,
					status: 'unhealthy'
				});
			}
		});

		/** Performance metrics endpoint */
		if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
			app.get('/metrics/performance', (req, res) => {
				const stats = performanceMonitor.getStats();
				res.json(stats);
			});
		}

		/** Database metrics endpoint */
		if (process.env.ENABLE_DATABASE_MONITORING === 'true') {
			app.get('/metrics/database', (req, res) => {
				const stats = databaseMonitor.getPerformanceStats();
				const suggestions = databaseMonitor.getOptimizationSuggestions();

				res.json({ stats, suggestions });
			});
		}

		/** Queue management endpoints */
		app.get('/admin/queues', async (req, res) => {
			/** Add authentication middleware in production */
			try {
				const stats = await jobProcessor.getQueueStats();

				res.json(stats);
			} catch (error) {
				res.status(500).json({ error: (error as Error).message });
			}
		});

		/** Serve static dashboard files */
		app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
		app.use('/public', express.static(path.join(__dirname, '../public')));

		/** Dashboard routes */
		app.get('/', (req, res) =>
			res.redirect('/dashboard/sponsor-dashboard.html')
		);
		app.get('/dashboard', (req, res) =>
			res.redirect('/dashboard/sponsor-dashboard.html')
		);
		app.get('/dashboard/sponsor', (req, res) =>
			res.redirect('/dashboard/sponsor-dashboard.html')
		);
		app.get('/dashboard/analytics', (req, res) =>
			res.redirect('/dashboard/analytics-dashboard.html')
		);
		app.get('/dashboard/historical', (req, res) =>
			res.redirect('/dashboard/historical-dashboard.html')
		);
		app.get('/dashboard/race-event', (req, res) =>
			res.redirect('/dashboard/race-event-dashboard.html')
		);

		const EXPRESS_PORT = Number(process.env.PORT || '3001');
		/** Start Express server */
		app.listen(EXPRESS_PORT, () => {
			logger.info(`📊 Dashboard server running`, 'startup', {
				port: EXPRESS_PORT,
				url: `http://localhost:${EXPRESS_PORT}`
			});
		});

		/** Start Apollo GraphQL Server */
		const server = new ApolloServer<MyContext>({
			introspection: process.env.NODE_ENV !== 'production',
			plugins: [
				/** Cache control plugin for HTTP caching */
				ApolloServerPluginCacheControl({
					calculateHttpHeaders: true,
					defaultMaxAge: 300 // 5 minutes default cache
				}),

				/** Inline tracing for performance monitoring */
				ApolloServerPluginInlineTrace(),

				/** Custom performance monitoring plugin */
				{
					requestDidStart() {
						return Promise.resolve({
							didEncounterErrors(requestContext: any) {
								logger.error('GraphQL errors encountered', 'graphql', {
									errors: requestContext.errors.map((e: any) => ({
										extensions: e.extensions,
										message: e.message,
										path: e.path
									})),
									operationName: requestContext.request.operationName
								});
								return Promise.resolve();
							},
							willSendResponse(requestContext: any) {
								const { response, request } = requestContext;

								/** Log slow queries */
								if (
									requestContext.metrics?.duration &&
									requestContext.metrics.duration > 1000
								) {
									logger.warn('Slow GraphQL query detected', 'performance', {
										duration: requestContext.metrics.duration,
										operationName: request.operationName,
										query: request.query?.substring(0, 100) + '...'
									});
								}

								/** Add performance headers */
								if (requestContext.metrics) {
									response.http.headers.set(
										'X-Query-Duration',
										requestContext.metrics.duration?.toString() || '0'
									);
									response.http.headers.set(
										'X-Query-Complexity',
										requestContext.metrics.queryComplexity?.toString() || '0'
									);
								}

								/** Cache control based on query type */
								if (request.operationName?.includes('Query')) {
									response.http.headers.set(
										'Cache-Control',
										'public, max-age=300'
									); // 5 minutes for queries
								} else if (request.operationName?.includes('Mutation')) {
									response.http.headers.set(
										'Cache-Control',
										'no-cache, no-store, must-revalidate'
									);
								}
								return Promise.resolve();
							}
						});
					}
				},

				/** Landing page plugin */
				ApolloServerPluginLandingPageLocalDefault()
			],
			resolvers,
			typeDefs
		});

		const { url } = await startStandaloneServer(server, {
			context: async () => ({
				cache: redisCache,
				dataloaders: createDataLoaders(advancedPool),
				db: advancedPool,
				jobProcessor: jobProcessor
			}),
			listen: { port: 3000 }
		});

		logger.info('🚀 NASCAR Data API started successfully!', 'startup', {
			dashboardUrl: `http://localhost:${EXPRESS_PORT}/dashboard`,
			graphqlUrl: url,
			healthUrl: `http://localhost:${EXPRESS_PORT}/health`
		});

		/** Graceful shutdown */
		process.on('SIGINT', async () => {
			logger.info('Shutting down gracefully...', 'shutdown');

			await Promise.all([
				server.stop(),
				advancedPool.close(),
				redisCache.close(),
				jobProcessor.shutdown()
			]);

			logger.info('Shutdown complete', 'shutdown');

			process.exit(0);
		});
	} catch (error) {
		logger.error('Failed to start server', 'startup', {
			error: (error as Error).message,
			stack: (error as Error).stack
		});

		process.exit(1);
	}
}

startServer();
