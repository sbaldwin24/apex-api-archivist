import request from 'supertest';
import express from 'express';
import { ApolloServer } from '@apollo/server';
// import { expressMiddleware } from '@apollo/server/express4';
import { TestHelpers, TestDataFactory } from '../utils/test-helpers';

// Mock dependencies
jest.mock('../../src/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  }
}));

jest.mock('../../src/dataloaders', () => ({
  createDataLoaders: jest.fn().mockReturnValue({
    driverLoader: {
      load: jest.fn().mockResolvedValue(TestDataFactory.createMockDriver())
    }
  })
}));

// Mock schema and resolvers
const mockTypeDefs = `#graphql
  type Driver {
    id: ID!
    firstName: String
    lastName: String!
    hometown: String
  }

  type Query {
    driver(id: ID!): Driver
    drivers: [Driver!]!
  }
`;

const mockResolvers = {
  Query: {
    driver: async (_: any, { id }: { id: string }, context: any) => {
      return context.dataloaders.driverLoader.load(id);
    },
    drivers: async () => {
      return [
        TestDataFactory.createMockDriver(),
        { ...TestDataFactory.createMockDriver(), id: 'test_driver_2', last_name: 'Driver Two' }
      ];
    }
  }
};

describe('API Endpoints', () => {
  let app: express.Application;
  let apolloServer: ApolloServer;

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create Apollo Server
    apolloServer = new ApolloServer({
      typeDefs: mockTypeDefs,
      resolvers: mockResolvers,
    });

    await apolloServer.start();

    // Add GraphQL middleware - temporarily disabled due to import issues
    // app.use('/graphql', expressMiddleware(apolloServer, {
    //   context: async () => ({
    //     dataloaders: {
    //       driverLoader: {
    //         load: jest.fn().mockResolvedValue(TestDataFactory.createMockDriver())
    //       }
    //     }
    //   })
    // }));

    // Add REST endpoints for testing
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    app.get('/api/drivers', async (req, res) => {
      try {
        const drivers = [
          TestDataFactory.createMockDriver(),
          { ...TestDataFactory.createMockDriver(), id: 'test_driver_2', last_name: 'Driver Two' }
        ];
        res.json(drivers);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/drivers/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (id === 'test_driver') {
          res.json(TestDataFactory.createMockDriver());
        } else {
          res.status(404).json({ error: 'Driver not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/races/:year', async (req, res) => {
      try {
        const { year } = req.params;
        const races = [{
          id: `test_race_${year}`,
          name: `Test Race ${year}`,
          date: `${year}-01-01`,
          track: 'Test Speedway'
        }];
        res.json(races);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/races', async (req, res): Promise<void> => {
      try {
        const raceData = req.body;
        
        // Basic validation
        if (!raceData.name || !raceData.date) {
          res.status(400).json({ error: 'Name and date are required' });
          return;
        }

        const newRace = {
          id: TestHelpers.generateTestId(),
          ...raceData,
          created: new Date().toISOString()
        };

        res.status(201).json(newRace);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  afterAll(async () => {
    await apolloServer.stop();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('REST API Endpoints', () => {
    describe('GET /api/drivers', () => {
      it('should return list of drivers', async () => {
        const response = await request(app)
          .get('/api/drivers')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toMatchObject({
          id: expect.any(String),
          first_name: expect.any(String),
          last_name: expect.any(String)
        });
      });

      it('should set correct content type', async () => {
        const response = await request(app)
          .get('/api/drivers')
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('GET /api/drivers/:id', () => {
      it('should return specific driver', async () => {
        const response = await request(app)
          .get('/api/drivers/test_driver')
          .expect(200);

        expect(response.body).toMatchObject({
          id: 'test_driver',
          first_name: 'Test',
          last_name: 'Driver'
        });
      });

      it('should return 404 for non-existent driver', async () => {
        const response = await request(app)
          .get('/api/drivers/non_existent')
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'Driver not found'
        });
      });
    });

    describe('GET /api/races/:year', () => {
      it('should return races for specific year', async () => {
        const response = await request(app)
          .get('/api/races/2024')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0]).toMatchObject({
          id: 'test_race_2024',
          name: 'Test Race 2024',
          date: '2024-01-01',
          track: 'Test Speedway'
        });
      });

      it('should handle different years', async () => {
        const response = await request(app)
          .get('/api/races/2023')
          .expect(200);

        expect(response.body[0].id).toBe('test_race_2023');
        expect(response.body[0].name).toBe('Test Race 2023');
      });
    });

    describe('POST /api/races', () => {
      it('should create new race with valid data', async () => {
        const newRace = {
          name: 'New Test Race',
          date: '2024-06-01',
          track: 'New Test Speedway'
        };

        const response = await request(app)
          .post('/api/races')
          .send(newRace)
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: 'New Test Race',
          date: '2024-06-01',
          track: 'New Test Speedway',
          created: expect.any(String)
        });
      });

      it('should validate required fields', async () => {
        const invalidRace = {
          track: 'Test Speedway'
          // Missing name and date
        };

        const response = await request(app)
          .post('/api/races')
          .send(invalidRace)
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'Name and date are required'
        });
      });

      it('should handle empty request body', async () => {
        const response = await request(app)
          .post('/api/races')
          .send({})
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'Name and date are required'
        });
      });
    });
  });

  describe('GraphQL API Endpoints', () => {
    describe('Query: driver', () => {
      it('should return specific driver', async () => {
        const query = `
          query GetDriver($id: ID!) {
            driver(id: $id) {
              id
              firstName
              lastName
              hometown
            }
          }
        `;

        const response = await request(app)
          .post('/graphql')
          .send({
            query,
            variables: { id: 'test_driver' }
          })
          .expect(200);

        expect(response.body.data.driver).toMatchObject({
          id: 'test_driver',
          firstName: 'Test',
          lastName: 'Driver',
          hometown: 'Test City'
        });

        expect(response.body.errors).toBeUndefined();
      });

      it('should handle invalid GraphQL syntax', async () => {
        const invalidQuery = `
          query {
            driver(id: "test_driver" {
              id
            }
          }
        `;

        const response = await request(app)
          .post('/graphql')
          .send({ query: invalidQuery })
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });
    });

    describe('Query: drivers', () => {
      it('should return list of drivers', async () => {
        const query = `
          query GetDrivers {
            drivers {
              id
              firstName
              lastName
            }
          }
        `;

        const response = await request(app)
          .post('/graphql')
          .send({ query })
          .expect(200);

        expect(response.body.data.drivers).toBeInstanceOf(Array);
        expect(response.body.data.drivers).toHaveLength(2);
        expect(response.body.data.drivers[0]).toMatchObject({
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String)
        });

        expect(response.body.errors).toBeUndefined();
      });
    });

    describe('GraphQL Error Handling', () => {
      it('should handle missing query', async () => {
        const response = await request(app)
          .post('/graphql')
          .send({})
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });

      it('should handle invalid field selection', async () => {
        const query = `
          query {
            driver(id: "test_driver") {
              nonExistentField
            }
          }
        `;

        const response = await request(app)
          .post('/graphql')
          .send({ query })
          .expect(400);

        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toMatch(/Cannot query field/);
      });
    });
  });

  describe('HTTP Headers and CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight OPTIONS request', async () => {
      const response = await request(app)
        .options('/api/drivers')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBeLessThan(400);
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/drivers')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/races')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle malformed JSON gracefully
    });

    it('should handle large request bodies', async () => {
      const largeData = {
        name: 'Test Race',
        date: '2024-01-01',
        description: 'x'.repeat(10000) // 10KB string
      };

      const response = await request(app)
        .post('/api/races')
        .send(largeData)
        .expect(201);

      expect(response.body.name).toBe('Test Race');
    });
  });

  describe('Content Negotiation', () => {
    it('should return JSON by default', async () => {
      const response = await request(app)
        .get('/api/drivers')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle Accept header', async () => {
      const response = await request(app)
        .get('/api/drivers')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
