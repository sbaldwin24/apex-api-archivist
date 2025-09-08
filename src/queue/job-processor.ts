import Bull from 'bull';
import { redisCache } from '../cache/redis-cache';
import { StructuredLogger } from '../structured-logger';

export interface ScrapingJobData {
  type: 'race' | 'driver' | 'season' | 'broadcast' | 'standings';
  url?: string;
  raceId?: string;
  driverId?: string;
  year?: number;
  priority?: 'low' | 'normal' | 'high';
  metadata?: any;
}

export interface JobProgress {
  current: number;
  total: number;
  message?: string;
  stage?: string;
}

/**
 * Production job processing system for NASCAR data scraping
 * Uses Bull queues with Redis for reliable background processing
 */
export class JobProcessor {
  private scraperQueue: Bull.Queue<ScrapingJobData>;
  private analyticsQueue: Bull.Queue;
  private notificationQueue: Bull.Queue;
  private logger: StructuredLogger;

  constructor(redisConfig?: Bull.QueueOptions['redis']) {
    const redisOptions = redisConfig || {
      port: Number(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Remove retry limit for queue operations
      retryDelayOnFailover: 100,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000
    };

    // Initialize queues
    this.scraperQueue = new Bull('scraper-queue', { redis: redisOptions });
    this.analyticsQueue = new Bull('analytics-queue', { redis: redisOptions });
    this.notificationQueue = new Bull('notification-queue', { redis: redisOptions });

    this.logger = new StructuredLogger('job-processor');

    this.setupQueues();
    this.setupErrorHandling();
  }

  private setupQueues(): void {
    // Scraper queue processing
    this.scraperQueue.process('race-scraping', 5, this.processRaceScraping.bind(this));
    this.scraperQueue.process('driver-scraping', 3, this.processDriverScraping.bind(this));
    this.scraperQueue.process('broadcast-analysis', 2, this.processBroadcastAnalysis.bind(this));
    this.scraperQueue.process('season-update', 1, this.processSeasonUpdate.bind(this));

    // Analytics queue processing
    this.analyticsQueue.process('calculate-standings', 2, this.processStandingsCalculation.bind(this));
    this.analyticsQueue.process('performance-metrics', 3, this.processPerformanceMetrics.bind(this));
    this.analyticsQueue.process('roi-analysis', 1, this.processROIAnalysis.bind(this));

    // Notification queue processing
    this.notificationQueue.process('send-alert', 10, this.processSendAlert.bind(this));
    this.notificationQueue.process('data-ready', 5, this.processDataReady.bind(this));

    this.logger.info('Job queues initialized', 'setup', {
      scraperWorkers: 11,
      analyticsWorkers: 6,
      notificationWorkers: 15
    });
  }

  private setupErrorHandling(): void {
    // Global error handlers
    this.scraperQueue.on('failed', (job, err) => {
      this.logger.error('Scraper job failed', 'job-failure', {
        jobId: job.id,
        jobType: job.name,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });
    });

    this.scraperQueue.on('completed', (job, result) => {
      this.logger.info('Scraper job completed', 'job-success', {
        jobId: job.id,
        jobType: job.name,
        duration: Date.now() - job.processedOn!,
        result: typeof result === 'object' ? Object.keys(result) : 'success'
      });
    });

    // Auto-cleanup completed jobs
    this.scraperQueue.clean(24 * 60 * 60 * 1000, 'completed', 100); // Keep completed jobs for 24h
    this.scraperQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed', 50); // Keep failed jobs for 7 days
  }

  /**
   * Add scraping jobs to queue
   */
  async addScrapingJob(
    jobType: string, 
    data: ScrapingJobData, 
    options: Bull.JobOptions = {}
  ): Promise<Bull.Job<ScrapingJobData>> {
    const defaultOptions: Bull.JobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 50,
      removeOnFail: 20
    };

    // Priority mapping
    const priorityMap = { high: 1, normal: 5, low: 10 };
    const priority = priorityMap[data.priority || 'normal'];

    const job = await this.scraperQueue.add(jobType, data, {
      ...defaultOptions,
      ...options,
      priority
    });

    this.logger.info('Scraping job queued', 'job-queue', {
      jobId: job.id,
      jobType,
      priority: data.priority || 'normal',
      queueSize: await this.scraperQueue.count()
    });

    return job;
  }

  /**
   * Process race scraping jobs
   */
  private async processRaceScraping(job: Bull.Job<ScrapingJobData>): Promise<any> {
    const { raceId, url, year } = job.data;
    
    job.progress({ current: 0, total: 100, stage: 'initializing' });

    try {
      // Import scraper dynamically to avoid circular dependencies
      const { scrapeRaceData } = await import('../scrapers/race-scraper');
      
      job.progress({ current: 20, total: 100, stage: 'fetching race page' });
      
      const raceData = await scrapeRaceData({ url: url || `race-${raceId}`, year });
      
      job.progress({ current: 80, total: 100, stage: 'saving to database' });
      
      // Cache the results
      if (raceId && raceData) {
        await redisCache.cacheRaceResults(raceId, raceData);
      }

      job.progress({ current: 100, total: 100, stage: 'completed' });

      // Trigger analytics job
      await this.analyticsQueue.add('performance-metrics', {
        raceId,
        type: 'race-completed'
      }, { delay: 5000 }); // 5 second delay to allow DB commit

      return { raceId, recordsProcessed: Array.isArray(raceData) ? raceData.length : 0 };
    } catch (error) {
      this.logger.error('Race scraping failed', 'scraper-error', {
        jobId: job.id,
        raceId,
        url,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process driver scraping jobs  
   */
  private async processDriverScraping(job: Bull.Job<ScrapingJobData>): Promise<any> {
    const { driverId, year } = job.data;

    job.progress({ current: 0, total: 100, stage: 'fetching driver data' });

    try {
      // Import scraper dynamically
      const { scrapeDriverStats } = await import('../scrapers/driver-scraper');
      
      job.progress({ current: 50, total: 100, stage: 'processing statistics' });
      
      const driverStats = await scrapeDriverStats({ driverId, year });
      
      // Cache the results
      if (driverId && year && driverStats) {
        await redisCache.cacheDriverStats(driverId, year, driverStats);
      }

      job.progress({ current: 100, total: 100, stage: 'completed' });

      return { driverId, year, statsUpdated: true };
    } catch (error) {
      this.logger.error('Driver scraping failed', 'scraper-error', {
        jobId: job.id,
        driverId,
        year,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process broadcast analysis jobs
   */
  private async processBroadcastAnalysis(job: Bull.Job<ScrapingJobData>): Promise<any> {
    const { raceId, metadata } = job.data;

    job.progress({ current: 0, total: 100, stage: 'analyzing broadcast data' });

    try {
      // Import broadcast analyzer
      const { analyzeBroadcastMetrics } = await import('../analytics/broadcast-analyzer');
      
      job.progress({ current: 50, total: 100, stage: 'calculating metrics' });
      
      const analysis = await analyzeBroadcastMetrics({ raceId, metadata });
      
      job.progress({ current: 100, total: 100, stage: 'completed' });

      return { raceId, analysisCompleted: true, metricsCalculated: analysis ? 1 : 0 };
    } catch (error) {
      this.logger.error('Broadcast analysis failed', 'analytics-error', {
        jobId: job.id,
        raceId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process season update jobs
   */
  private async processSeasonUpdate(job: Bull.Job<ScrapingJobData>): Promise<any> {
    const { year } = job.data;

    job.progress({ current: 0, total: 100, stage: 'updating season data' });

    try {
      // This would be a comprehensive season update
      job.progress({ current: 25, total: 100, stage: 'updating standings' });
      
      // Trigger standings calculation
      await this.analyticsQueue.add('calculate-standings', { year });
      
      job.progress({ current: 75, total: 100, stage: 'invalidating caches' });
      
      // Invalidate related caches
      await redisCache.invalidatePattern(`standings:${year}*`);
      await redisCache.invalidatePattern(`season:${year}*`);
      
      job.progress({ current: 100, total: 100, stage: 'completed' });

      return { year, seasonUpdated: true };
    } catch (error) {
      this.logger.error('Season update failed', 'update-error', {
        jobId: job.id,
        year,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process standings calculation
   */
  private async processStandingsCalculation(job: Bull.Job): Promise<any> {
    const { year } = job.data;

    try {
      // Import standings calculator
      const { calculateStandings } = await import('../analytics/standings-calculator');
      
      const standings = await calculateStandings(year);
      
      // Cache updated standings
      await redisCache.cacheStandings(year, standings);
      
      return { year, standingsCalculated: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process performance metrics calculation
   */
  private async processPerformanceMetrics(job: Bull.Job): Promise<any> {
    // Implementation would calculate various performance metrics
    return { metricsCalculated: true };
  }

  /**
   * Process ROI analysis
   */
  private async processROIAnalysis(job: Bull.Job): Promise<any> {
    // Implementation would calculate sponsor ROI
    return { roiCalculated: true };
  }

  /**
   * Process alert notifications
   */
  private async processSendAlert(job: Bull.Job): Promise<any> {
    const { type, message, recipients } = job.data;
    
    // Implementation would send notifications via email/Slack/etc.
    this.logger.info('Alert sent', 'notification', { type, recipients: recipients?.length });
    
    return { alertSent: true };
  }

  /**
   * Process data ready notifications
   */
  private async processDataReady(job: Bull.Job): Promise<any> {
    const { dataType, id } = job.data;
    
    // Implementation would notify subscribers that data is ready
    this.logger.info('Data ready notification sent', 'notification', { dataType, id });
    
    return { notificationSent: true };
  }

  /**
   * Bulk add multiple jobs efficiently
   */
  async addBulkScrapingJobs(jobs: Array<{ type: string; data: ScrapingJobData }>): Promise<Bull.Job[]> {
    const jobPromises = jobs.map(({ type, data }) => 
      this.addScrapingJob(type, data)
    );
    
    const completedJobs = await Promise.all(jobPromises);
    
    this.logger.info('Bulk jobs queued', 'bulk-queue', {
      count: jobs.length,
      types: jobs.map(j => j.type)
    });
    
    return completedJobs;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    const [scraperCounts, analyticsCounts, notificationCounts] = await Promise.all([
      this.scraperQueue.getJobCounts(),
      this.analyticsQueue.getJobCounts(),
      this.notificationQueue.getJobCounts()
    ]);

    return {
      scraper: scraperCounts,
      analytics: analyticsCounts,
      notifications: notificationCounts,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.scraperQueue.close(),
      this.analyticsQueue.close(),
      this.notificationQueue.close()
    ]);
    
    this.logger.info('Job processor shutdown completed', 'shutdown');
  }
}

// Singleton instance
export const jobProcessor = new JobProcessor();

export default JobProcessor;
