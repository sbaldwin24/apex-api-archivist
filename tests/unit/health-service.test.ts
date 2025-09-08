/**
 * Unit Tests for Health Service
 */

import { HealthService, HealthStatus } from '../../src/health-service';
import { TestHelpers } from '../utils/test-helpers';

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
    getStats: jest.fn(),
  },
}));

jest.mock('../../src/message-queue', () => ({
  messageQueue: {
    getStats: jest.fn(),
  },
}));

describe('HealthService', () => {
  let healthService: HealthService;
  
  beforeEach(() => {
    healthService = new HealthService();
    jest.clearAllMocks();
  });

  describe('performHealthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful database check
      const mockPool = require('../../src/database').pool;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ test: 1, timestamp: new Date() }] }) // Basic connectivity
        .mockResolvedValueOnce({ 
          rows: [{ 
            db_size: '1.2GB', 
            active_connections: 5, 
            max_connections: 200 
          }] 
        }); // Database stats

      // Mock successful cache check
      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);
      mockCache.getStats.mockReturnValue({
        hitRate: 0.85,
        size: 100,
        memoryUsed: '45MB',
        operations: 1000,
      });

      // Mock successful message queue check
      const mockQueue = require('../../src/message-queue').messageQueue;
      mockQueue.getStats.mockReturnValue({
        pendingJobs: 5,
        completedJobs: 995,
        failedJobs: 5,
        activeWorkers: 3,
        avgProcessingTime: 150,
      });

      const result = await healthService.performHealthCheck();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('cache');
      expect(result.checks).toHaveProperty('message_queue');
      expect(result.checks).toHaveProperty('system');
      expect(result.checks.database?.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.cache?.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return unhealthy status when database check fails', async () => {
      // Mock failed database check
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      // Mock successful other checks
      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);
      mockCache.getStats.mockReturnValue({
        hitRate: 0.85,
        size: 100,
        memoryUsed: '45MB',
        operations: 1000,
      });

      const mockQueue = require('../../src/message-queue').messageQueue;
      mockQueue.getStats.mockReturnValue({
        pendingJobs: 5,
        completedJobs: 995,
        failedJobs: 5,
        activeWorkers: 3,
        avgProcessingTime: 150,
      });

      const result = await healthService.performHealthCheck();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks.database?.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks.database?.message).toContain('Database error');
    });

    it('should return degraded status when cache has low hit rate', async () => {
      // Mock successful database check
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

      // Mock cache with low hit rate
      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);
      mockCache.getStats.mockReturnValue({
        hitRate: 0.3, // Low hit rate
        size: 100,
        memoryUsed: '45MB',
        operations: 1000,
      });

      const mockQueue = require('../../src/message-queue').messageQueue;
      mockQueue.getStats.mockReturnValue({
        pendingJobs: 5,
        completedJobs: 995,
        failedJobs: 5,
        activeWorkers: 3,
        avgProcessingTime: 150,
      });

      const result = await healthService.performHealthCheck();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.checks.cache?.status).toBe(HealthStatus.DEGRADED);
      expect(result.checks.cache?.message).toContain('Low cache hit rate');
    });
  });

  describe('getLivenessCheck', () => {
    it('should return alive status when database is accessible', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValueOnce({ rows: [{ test: 1 }] });

      const result = await healthService.getLivenessCheck();

      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error when database is not accessible', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database unavailable'));

      await expect(healthService.getLivenessCheck()).rejects.toThrow('Service is not alive');
    });
  });

  describe('getReadinessCheck', () => {
    it('should return ready status when all dependencies are ready', async () => {
      // Mock database ready
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockResolvedValueOnce({ rows: [{ test: 1 }] });

      // Mock cache ready
      const mockCache = require('../../src/cache-manager').cache;
      mockCache.set.mockReturnValue(undefined);
      mockCache.get.mockReturnValue('test-value');
      mockCache.delete.mockReturnValue(true);
      mockCache.getStats.mockReturnValue({
        hitRate: 0.85,
        size: 100,
        memoryUsed: '45MB',
        operations: 1000,
      });

      const result = await healthService.getReadinessCheck();

      expect(result.status).toBe('ready');
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error when database is not ready', async () => {
      const mockPool = require('../../src/database').pool;
      mockPool.query.mockRejectedValueOnce(new Error('Database not ready'));

      await expect(healthService.getReadinessCheck()).rejects.toThrow('Database not ready');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', () => {
      const mockCache = require('../../src/cache-manager').cache;
      const mockQueue = require('../../src/message-queue').messageQueue;

      mockCache.getStats.mockReturnValue({
        hitRate: 0.85,
        size: 100,
        memoryUsed: 45000000,
        operations: 1000,
      });

      mockQueue.getStats.mockReturnValue({
        pendingJobs: 5,
        completedJobs: 995,
        failedJobs: 5,
        activeWorkers: 3,
        avgProcessingTime: 150,
      });

      const metrics = healthService.getSystemMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('messageQueue');
      expect(metrics.cache.hitRate).toBe(0.85);
      expect(metrics.messageQueue.pendingJobs).toBe(5);
    });
  });
});
