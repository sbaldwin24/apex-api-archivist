/**
 * API Integration Tests for Health Endpoints
 */

import request from 'supertest';
import express from 'express';
import { healthService } from '../../src/health-service';
import '../setup'; // Import custom matchers

// Create a minimal test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health endpoints (simplified version of actual implementation)
  app.get('/health', async (req, res) => {
    try {
      const healthResult = await healthService.performHealthCheck();
      const statusCode = healthResult.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthResult);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  app.get('/health/live', async (req, res) => {
    try {
      const result = await healthService.getLivenessCheck();
      res.json(result);
    } catch (error) {
      res.status(503).json({
        status: 'not_alive',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });

  app.get('/health/ready', async (req, res) => {
    try {
      const result = await healthService.getReadinessCheck();
      res.json(result);
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });

  app.get('/health/metrics', (req, res) => {
    try {
      const metrics = healthService.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
};

// Mock dependencies
jest.mock('../../src/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/cache-manager', () => ({
  cache: {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      hitRate: 0.85,
      size: 100,
      memoryUsed: 45000000,
      operations: 1000,
    }),
  },
}));

jest.mock('../../src/message-queue', () => ({
  messageQueue: {
    getStats: jest.fn().mockReturnValue({
      pendingJobs: 5,
      completedJobs: 995,
      failedJobs: 5,
      activeWorkers: 3,
      avgProcessingTime: 150,
    }),
  },
}));

describe('Health API Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and healthy status when all systems are operational', async () => {
      // Mock successful health checks
      const mockPool = require('../../src/database').pool;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ test: 1, timestamp: new Date() }] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            db_size: '1.2GB', 
            active_connections: 5, 
            max_connections: 200 
          }] 
        });

      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');

      // Check that individual health checks are present
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('message_queue');
      expect(response.body.checks).toHaveProperty('system');
    });

    it('should return 503 when database is unhealthy', async () => {
      // Mock database failure
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('unhealthy');
      expect(response.body.checks.database.message).toContain('Database error');
    });

    it('should return proper response structure', async () => {
      // Mock successful checks
      const mockPool = require('../../src/database').pool;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ test: 1, timestamp: new Date() }] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            db_size: '1.2GB', 
            active_connections: 5, 
            max_connections: 200 
          }] 
        });

      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);

      const response = await request(app)
        .get('/health');

      // Verify response structure using custom matcher
      expect(response).toHaveValidApiResponse();
      
      // Verify required fields
      expect(response.body.timestamp).toBeValidDate();
      expect(response.body.uptime).toBeWithinRange(0, 1000000);
      expect(response.body.responseTime).toBeWithinRange(0, 10000);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 when service is alive', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValueOnce({ rows: [{ test: 1 }] });

      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 503 when service is not alive', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database unavailable'));

      const response = await request(app)
        .get('/health/live')
        .expect(503);

      expect(response.body.status).toBe('not_alive');
      expect(response.body.error).toContain('Service is not alive');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when service is ready', async () => {
      // Mock database ready
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValueOnce({ rows: [{ test: 1 }] });

      // Mock cache ready
      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 503 when database is not ready', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database not ready'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body.status).toBe('not_ready');
      expect(response.body.error).toContain('Database not ready');
    });
  });

  describe('GET /health/metrics', () => {
    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('messageQueue');

      // Verify memory metrics structure
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('rss');

      // Verify CPU metrics structure
      expect(response.body.cpu).toHaveProperty('usage');
      expect(response.body.cpu).toHaveProperty('loadAverage');
      expect(response.body.cpu).toHaveProperty('count');

      // Verify cache metrics
      expect(response.body.cache).toHaveProperty('hitRate');
      expect(response.body.cache.hitRate).toBe(0.85);

      // Verify message queue metrics
      expect(response.body.messageQueue).toHaveProperty('pendingJobs');
      expect(response.body.messageQueue.pendingJobs).toBe(5);
    });

    it('should handle metrics endpoint errors gracefully', async () => {
      // Mock an error in the health service
      const originalMethod = healthService.getSystemMetrics;
      healthService.getSystemMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Metrics collection failed');
      });

      const response = await request(app)
        .get('/health/metrics')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to retrieve metrics');
      expect(response.body).toHaveProperty('timestamp');

      // Restore original method
      healthService.getSystemMetrics = originalMethod;
    });
  });

  describe('Response Headers and Content Type', () => {
    it('should return proper content type for all health endpoints', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValue({ rows: [{ test: 1 }] });

      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);

      const endpoints = ['/health', '/health/live', '/health/ready', '/health/metrics'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });

    it('should include response time in headers', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValue({ rows: [{ test: 1 }] });

      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);

      const response = await request(app).get('/health');

      // Response should be reasonably fast
      expect(response.body.responseTime).toBeLessThan(5000); // Less than 5 seconds
      expect(response.body.responseTime).toBeGreaterThan(0);
    });
  });
});
