import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'NASCAR Data API',
      version: version,
      description: `
        A comprehensive NASCAR data acquisition and API server that provides access to:
        - Historical and current race results
        - Driver statistics and performance data
        - Team information and manufacturer data
        - Broadcast metrics and sponsor visibility analytics
        - Track information and racing statistics
        
        ## Features
        - RESTful API endpoints for NASCAR data
        - GraphQL API for flexible queries
        - Real-time data scraping capabilities
        - Performance analytics and reporting
        - Historical data spanning multiple NASCAR eras
        
        ## Authentication
        Some endpoints require authentication via JWT tokens.
        Contact your system administrator for access credentials.
      `,
      contact: {
        name: 'API Support',
        email: 'support@apex-data.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://staging-api.nascar-data.com',
        description: 'Staging server'
      },
      {
        url: 'https://api.nascar-data.com',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Driver: {
          type: 'object',
          required: ['id', 'firstName', 'lastName'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the driver',
              example: 'dale_earnhardt_jr'
            },
            firstName: {
              type: 'string',
              description: 'Driver first name',
              example: 'Dale'
            },
            lastName: {
              type: 'string',
              description: 'Driver last name',
              example: 'Earnhardt Jr.'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'Driver date of birth',
              example: '1974-10-10'
            },
            hometown: {
              type: 'string',
              description: 'Driver hometown',
              example: 'Kannapolis, NC'
            }
          }
        },
        Team: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the team',
              example: 'hendrick_motorsports'
            },
            name: {
              type: 'string',
              description: 'Team name',
              example: 'Hendrick Motorsports'
            },
            manufacturer: {
              type: 'string',
              enum: ['Chevrolet', 'Ford', 'Toyota', 'Dodge'],
              description: 'Car manufacturer',
              example: 'Chevrolet'
            },
            owner: {
              type: 'string',
              description: 'Team owner',
              example: 'Rick Hendrick'
            },
            location: {
              type: 'string',
              description: 'Team headquarters location',
              example: 'Concord, NC'
            },
            foundedYear: {
              type: 'integer',
              description: 'Year the team was founded',
              example: 1984
            }
          }
        },
        Track: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the track',
              example: 'daytona_international_speedway'
            },
            name: {
              type: 'string',
              description: 'Track name',
              example: 'Daytona International Speedway'
            },
            city: {
              type: 'string',
              description: 'Track city',
              example: 'Daytona Beach'
            },
            state: {
              type: 'string',
              description: 'Track state',
              example: 'FL'
            },
            lengthMiles: {
              type: 'number',
              format: 'float',
              description: 'Track length in miles',
              example: 2.5
            },
            type: {
              type: 'string',
              enum: ['Oval', 'Road Course', 'Superspeedway', 'Short Track'],
              description: 'Track type',
              example: 'Superspeedway'
            },
            surface: {
              type: 'string',
              enum: ['Asphalt', 'Concrete', 'Dirt'],
              description: 'Track surface',
              example: 'Asphalt'
            }
          }
        },
        Race: {
          type: 'object',
          required: ['id', 'name', 'eventDate', 'trackId'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the race',
              example: 'daytona_500_2024'
            },
            name: {
              type: 'string',
              description: 'Race name',
              example: 'Daytona 500'
            },
            eventDate: {
              type: 'string',
              format: 'date',
              description: 'Race date',
              example: '2024-02-18'
            },
            trackId: {
              type: 'string',
              description: 'Track where race was held',
              example: 'daytona_international_speedway'
            },
            leadChanges: {
              type: 'integer',
              description: 'Number of lead changes during race',
              example: 42
            },
            differentLeaders: {
              type: 'integer',
              description: 'Number of different race leaders',
              example: 15
            }
          }
        },
        RaceResult: {
          type: 'object',
          required: ['id', 'finishPosition', 'startPosition', 'driverId', 'teamId'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the race result',
              example: 'daytona_500_2024_dale_earnhardt_jr'
            },
            finishPosition: {
              type: 'integer',
              minimum: 1,
              maximum: 43,
              description: 'Final finishing position',
              example: 3
            },
            startPosition: {
              type: 'integer',
              minimum: 1,
              maximum: 43,
              description: 'Starting position',
              example: 7
            },
            carNumber: {
              type: 'string',
              description: 'Car number',
              example: '88'
            },
            lapsCompleted: {
              type: 'integer',
              description: 'Number of laps completed',
              example: 200
            },
            lapsLed: {
              type: 'integer',
              description: 'Number of laps led',
              example: 15
            },
            status: {
              type: 'string',
              enum: ['Running', 'Accident', 'Engine', 'Transmission', 'Disqualified'],
              description: 'Race finish status',
              example: 'Running'
            },
            points: {
              type: 'integer',
              description: 'Championship points earned',
              example: 42
            },
            prizeMoney: {
              type: 'integer',
              description: 'Prize money earned in dollars',
              example: 150000
            },
            driverId: {
              type: 'string',
              description: 'Driver ID reference',
              example: 'dale_earnhardt_jr'
            },
            teamId: {
              type: 'string',
              description: 'Team ID reference',
              example: 'hendrick_motorsports'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            message: {
              type: 'string',
              description: 'Response message'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        ValidationError: {
          description: 'Invalid input parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints'
      },
      {
        name: 'Drivers',
        description: 'NASCAR driver information and statistics'
      },
      {
        name: 'Teams',
        description: 'NASCAR team information and history'
      },
      {
        name: 'Tracks',
        description: 'Racing venue information and statistics'
      },
      {
        name: 'Races',
        description: 'Race events and results'
      },
      {
        name: 'Analytics',
        description: 'Performance analytics and reporting'
      },
      {
        name: 'Scraping',
        description: 'Data scraping management (Admin only)'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/middleware/*.ts'
  ]
};

export const specs = swaggerJsdoc(options);
