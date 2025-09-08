/**
 * OpenAPI/Swagger Configuration for NASCAR Data API
 * Automatically generates interactive API documentation
 */

import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('swagger');

/**
 * OpenAPI specification configuration
 */
const swaggerOptions: swaggerJsdoc.Options = {
	apis: [
		'./src/**/*.ts', // Path to API route files
		'./src/server.ts' // Main API server file
	],
	definition: {
		components: {
			parameters: {
				LimitParam: {
					description: 'Maximum number of items to return',
					in: 'query',
					name: 'limit',
					required: false,
					schema: {
						default: 50,
						maximum: 100,
						minimum: 1,
						type: 'integer'
					}
				},
				OffsetParam: {
					description: 'Number of items to skip',
					in: 'query',
					name: 'offset',
					required: false,
					schema: {
						default: 0,
						minimum: 0,
						type: 'integer'
					}
				},
				YearParam: {
					description: 'Season year',
					in: 'path',
					name: 'year',
					required: true,
					schema: {
						maximum: 2030,
						minimum: 1949,
						type: 'integer'
					}
				}
			},
			responses: {
				BadRequest: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Bad Request - Invalid input parameters'
				},
				Forbidden: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Forbidden - Insufficient permissions'
				},
				InternalServerError: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Internal Server Error'
				},
				NotFound: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Not Found - Resource not found'
				},
				ServiceUnavailable: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Service Unavailable - System is temporarily unavailable'
				},
				TooManyRequests: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Too Many Requests - Rate limit exceeded'
				},
				Unauthorized: {
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' }
						}
					},
					description: 'Unauthorized - Invalid or missing API key'
				}
			},
			schemas: {
				/** Driver Schema */
				Driver: {
					properties: {
						dateOfBirth: {
							description: 'Date of birth',
							format: 'date',
							type: 'string'
						},
						firstName: {
							description: 'Driver first name',
							type: 'string'
						},
						hometown: {
							description: 'Driver hometown',
							type: 'string'
						},
						id: {
							description: 'Unique driver identifier',
							type: 'string'
						},
						lastName: {
							description: 'Driver last name',
							type: 'string'
						}
					},
					required: ['id', 'lastName'],
					type: 'object'
				},

				/** Error Schema */
				Error: {
					properties: {
						code: {
							description: 'Error code',
							type: 'string'
						},
						error: {
							description: 'Error message',
							type: 'string'
						},
						path: {
							description: 'Request path where error occurred',
							type: 'string'
						},
						timestamp: {
							description: 'Error timestamp',
							format: 'date-time',
							type: 'string'
						}
					},
					required: ['error'],
					type: 'object'
				},
				HealthCheckResponse: {
					properties: {
						checks: {
							additionalProperties: {
								properties: {
									details: { type: 'object' },
									message: { type: 'string' },
									responseTime: { type: 'number' },
									status: { $ref: '#/components/schemas/HealthStatus' }
								},
								type: 'object'
							},
							type: 'object'
						},
						environment: {
							description: 'Environment (development, staging, production)',
							type: 'string'
						},
						responseTime: {
							description: 'Health check response time in milliseconds',
							type: 'number'
						},
						status: { $ref: '#/components/schemas/HealthStatus' },
						timestamp: {
							description: 'Timestamp of the health check',
							format: 'date-time',
							type: 'string'
						},
						uptime: {
							description: 'System uptime in milliseconds',
							type: 'number'
						},
						version: {
							description: 'Application version',
							type: 'string'
						}
					},
					required: ['status', 'timestamp', 'uptime', 'responseTime'],
					type: 'object'
				},
				/** Health Check Schemas */
				HealthStatus: {
					description: 'Health status of a system component',
					enum: ['healthy', 'degraded', 'unhealthy'],
					type: 'string'
				},

				/** Pagination Schema */
				PaginationInfo: {
					properties: {
						hasNext: {
							description: 'Whether there is a next page',
							type: 'boolean'
						},
						hasPrevious: {
							description: 'Whether there is a previous page',
							type: 'boolean'
						},
						limit: {
							description: 'Items per page',
							maximum: 100,
							minimum: 1,
							type: 'integer'
						},
						page: {
							description: 'Current page number',
							minimum: 1,
							type: 'integer'
						},
						total: {
							description: 'Total number of items',
							minimum: 0,
							type: 'integer'
						},
						totalPages: {
							description: 'Total number of pages',
							minimum: 0,
							type: 'integer'
						}
					},
					required: [
						'page',
						'limit',
						'total',
						'totalPages',
						'hasNext',
						'hasPrevious'
					],
					type: 'object'
				},

				/** Race Data Schemas */
				RaceResult: {
					properties: {
						carNumber: {
							description: 'Car number',
							type: 'string'
						},
						driverId: {
							description: 'Driver identifier',
							type: 'string'
						},
						eventId: {
							description: 'Event identifier',
							type: 'string'
						},
						finishPosition: {
							description: 'Final finishing position',
							minimum: 1,
							type: 'integer'
						},
						id: {
							description: 'Unique result identifier',
							type: 'integer'
						},
						lapsCompleted: {
							description: 'Total laps completed',
							minimum: 0,
							type: 'integer'
						},
						lapsLed: {
							description: 'Number of laps led',
							minimum: 0,
							type: 'integer'
						},
						pointsEarned: {
							description: 'Championship points earned',
							minimum: 0,
							type: 'integer'
						},
						startPosition: {
							description: 'Starting grid position',
							minimum: 1,
							type: 'integer'
						},
						status: {
							description: 'Finishing status',
							enum: [
								'Running',
								'Accident',
								'Engine',
								'Transmission',
								'Suspension',
								'Withdrawn'
							],
							type: 'string'
						},
						teamId: {
							description: 'Team identifier',
							type: 'string'
						}
					},
					required: [
						'id',
						'eventId',
						'driverId',
						'teamId',
						'carNumber',
						'finishPosition'
					],
					type: 'object'
				},

				/** Team Schema */
				Team: {
					properties: {
						id: {
							description: 'Unique team identifier',
							type: 'string'
						},
						manufacturer: {
							description: 'Manufacturer',
							enum: ['Chevrolet', 'Ford', 'Toyota'],
							type: 'string'
						},
						name: {
							description: 'Team name',
							type: 'string'
						}
					},
					required: ['id', 'name'],
					type: 'object'
				},

				/** Track Schema */
				Track: {
					properties: {
						city: {
							description: 'Track city',
							type: 'string'
						},
						id: {
							description: 'Unique track identifier',
							type: 'string'
						},
						lengthMiles: {
							description: 'Track length in miles',
							type: 'number'
						},
						name: {
							description: 'Track name',
							type: 'string'
						},
						state: {
							description: 'Track state',
							type: 'string'
						},
						type: {
							description: 'Track type',
							enum: ['Superspeedway', 'Speedway', 'Short Track', 'Road Course'],
							type: 'string'
						}
					},
					required: ['id', 'name'],
					type: 'object'
				}
			},
			securitySchemes: {
				ApiKeyAuth: {
					description: 'API Key for authentication',
					in: 'header',
					name: 'X-API-Key',
					type: 'apiKey'
				},
				BearerAuth: {
					bearerFormat: 'JWT',
					description: 'JWT Bearer token for authenticated requests',
					scheme: 'bearer',
					type: 'http'
				}
			}
		},
		info: {
			contact: {
				email: 'support@nascar-data-api.com',
				name: 'NASCAR Data API Support',
				url: 'https://nascar-data-api.com/support'
			},
			description: `
# NASCAR Data Acquisition and API Server

A comprehensive API for NASCAR race data, statistics, and analytics.

## Features

- **Race Results**: Complete race finishing positions, lap data, and statistics
- **Driver Information**: Comprehensive driver profiles and career statistics  
- **Team Data**: Team information, manufacturer details, and performance metrics
- **Track Information**: Track details, characteristics, and historical data
- **Real-time Health Monitoring**: System health and performance metrics
- **Advanced Analytics**: Performance trends, ROI data, and predictive insights

## Authentication

Most endpoints require API key authentication. Include your API key in the request header:

\`\`\`
X-API-Key: your-api-key-here
\`\`\`

## Rate Limiting

API requests are rate-limited based on your subscription tier:

- **Free Tier**: 100 requests per hour
- **Pro Tier**: 1,000 requests per hour  
- **Enterprise Tier**: 10,000 requests per hour

## Data Freshness

Data is updated in near real-time during race events and daily during off-season.

## Support

For API support, please contact: support@nascar-data-api.com
      `,
			license: {
				name: 'MIT',
				url: 'https://opensource.org/licenses/MIT'
			},
			termsOfService: 'https://nascar-data-api.com/terms',
			title: 'NASCAR Data API',
			version: process.env.API_VERSION || '1.0.0'
		},
		openapi: '3.0.3',
		servers: [
			{
				description:
					process.env.NODE_ENV === 'production'
						? 'Production API Server'
						: 'Development API Server',
				url:
					process.env.NODE_ENV === 'production'
						? 'https://api.nascar-data.com'
						: 'http://localhost:3000'
			},
			{
				description: 'Staging API Server',
				url: 'https://staging-api.nascar-data.com'
			}
		],
		tags: [
			{
				description: 'System health and monitoring endpoints',
				name: 'Health'
			},
			{
				description: 'Race data and results',
				name: 'Races'
			},
			{
				description: 'Driver information and statistics',
				name: 'Drivers'
			},
			{
				description: 'Team information and performance',
				name: 'Teams'
			},
			{
				description: 'Track information and characteristics',
				name: 'Tracks'
			},
			{
				description: 'Advanced analytics and insights',
				name: 'Analytics'
			},
			{
				description: 'Administrative endpoints (requires admin access)',
				name: 'Admin'
			}
		]
	}
};

/**
 * Generate OpenAPI specification
 */
export const generateSwaggerSpec = () => {
	try {
		const specs = swaggerJsdoc(swaggerOptions);
		logger.info('OpenAPI specification generated successfully', 'swagger');
		return specs;
	} catch (error) {
		logger.error('Failed to generate OpenAPI specification', 'swagger', {
			error: (error as Error).message
		});
		throw error;
	}
};

/**
 * Swagger UI configuration
 */
const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
	customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .scheme-container { background: #fafafa; border-radius: 4px; }
    .swagger-ui .info .title { color: #1f2937; }
    .swagger-ui .info .description p { color: #4b5563; }
    .swagger-ui .btn.authorize { background-color: #3b82f6; border-color: #3b82f6; }
    .swagger-ui .btn.authorize:hover { background-color: #2563eb; border-color: #2563eb; }
  `,
	customfavIcon: '/favicon.ico',
	customSiteTitle: 'NASCAR Data API Documentation',
	explorer: true,
	swaggerOptions: {
		docExpansion: 'none',
		filter: true,
		requestInterceptor: (request: any) => {
			/** Add API key to all requests in try-it-out */
			if (process.env.NODE_ENV === 'development') {
				request.headers['X-API-Key'] = 'dev-api-key';
			}

			return request;
		},
		showCommonExtensions: true,
		showRequestDuration: true,
		tryItOutEnabled: true
	}
};

/**
 * Setup Swagger documentation for Express app
 */
export const setupSwagger = (app: Express): void => {
	try {
		const swaggerSpec = generateSwaggerSpec();

		/** Serve OpenAPI spec as JSON */
		app.get('/api-docs.json', (req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.send(swaggerSpec);
		});

		/** Serve Swagger UI */
		app.use(
			'/api-docs',
			swaggerUi.serve,
			swaggerUi.setup(swaggerSpec, swaggerUiOptions)
		);

		/** Alternative documentation paths */
		app.use(
			'/docs',
			swaggerUi.serve,
			swaggerUi.setup(swaggerSpec, swaggerUiOptions)
		);

		app.use(
			'/swagger',
			swaggerUi.serve,
			swaggerUi.setup(swaggerSpec, swaggerUiOptions)
		);

		logger.info('Swagger documentation setup complete', 'swagger', {
			endpoints: ['/api-docs', '/docs', '/swagger'],
			specEndpoint: '/api-docs.json'
		});
	} catch (error) {
		logger.error('Failed to setup Swagger documentation', 'swagger', {
			error: (error as Error).message
		});
	}
};

/**
 * Validate OpenAPI specification
 */
export const validateSwaggerSpec = (): boolean => {
	try {
		const spec = generateSwaggerSpec();

		/** Basic validation */
		const specAsAny = spec as any;

		if (!specAsAny.openapi || !specAsAny.info || !specAsAny.paths) {
			throw new Error('Invalid OpenAPI specification: missing required fields');
		}

		logger.info('OpenAPI specification validation passed', 'swagger');

		return true;
	} catch (error) {
		logger.error('OpenAPI specification validation failed', 'swagger', {
			error: (error as Error).message
		});

		return false;
	}
};
