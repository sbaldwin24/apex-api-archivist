import BaseScraper, { SummarySection } from '../src/base/base-scraper';
import { scrapeEnhancedBroadcastMetrics } from '../src/enhanced-broadcast-scraper';
import ConfigManager from '../src/base/config-manager';
import ErrorHandler from '../src/base/error-handler';

export class BroadcastMetricsScraper extends BaseScraper {
  private errorHandler: ErrorHandler;

  constructor() {
    super({
      scraperName: 'Broadcast Metrics',
      schemaFile: './broadcast-metrics-schema.sql',
      enableSummary: true,
      logLevel: ConfigManager.getLogLevel() as any
    });
    
    this.errorHandler = ErrorHandler.forComponent('broadcast-metrics-scraper');
  }

  protected async scrapeData(): Promise<void> {
    await this.errorHandler.withRetry(
      () => scrapeEnhancedBroadcastMetrics(),
      {
        operation: 'scrape_broadcast_metrics',
        component: 'broadcast-metrics-scraper',
        severity: 'high'
      },
      {
        maxAttempts: 3,
        baseDelay: 5000,
        maxDelay: 30000,
        backoffFactor: 2
      }
    );
  }

  protected getSummarySections(): SummarySection[] {
    return [
      {
        title: 'BROADCAST EXPOSURE METRICS',
        icon: '📺',
        query: `
          SELECT 
            COUNT(*) as total_broadcast_records,
            COUNT(DISTINCT event_id) as events_covered,
            COUNT(DISTINCT driver_id) as drivers_covered,
            SUM(total_camera_time) as total_camera_seconds,
            SUM(media_value) as total_media_value,
            AVG(total_camera_time) as avg_camera_time,
            MAX(total_camera_time) as max_camera_time
          FROM detailed_broadcast_metrics
        `,
        formatter: (stats) => {
          console.log(`  Total broadcast records: ${stats.total_broadcast_records}`);
          console.log(`  Events covered: ${stats.events_covered}`);
          console.log(`  Drivers covered: ${stats.drivers_covered}`);
          console.log(`  Total camera time: ${this.formatDuration(stats.total_camera_seconds || 0)}`);
          console.log(`  Total media value: ${this.formatCurrency(stats.total_media_value || 0, true)}`);
          console.log(`  Average camera time per driver: ${Math.floor(stats.avg_camera_time || 0)} seconds`);
          console.log(`  Maximum camera time: ${Math.floor(stats.max_camera_time || 0)} seconds`);
        }
      },
      {
        title: 'SPONSOR VISIBILITY METRICS',
        icon: '👁️',
        query: `
          SELECT 
            COUNT(*) as total_visibility_records,
            COUNT(DISTINCT sponsor_name) as unique_sponsors,
            SUM(visibility_time) as total_visibility_seconds,
            SUM(estimated_value) as total_visibility_value,
            AVG(prominence) as avg_prominence
          FROM sponsor_visibility
        `,
        formatter: (stats) => {
          console.log(`  Total visibility records: ${stats.total_visibility_records}`);
          console.log(`  Unique sponsors tracked: ${stats.unique_sponsors}`);
          console.log(`  Total visibility time: ${this.formatDuration(stats.total_visibility_seconds || 0)}`);
          console.log(`  Total visibility value: ${this.formatCurrency(stats.total_visibility_value || 0, true)}`);
          console.log(`  Average prominence score: ${this.formatNumber(stats.avg_prominence || 0, 1)}/10`);
        }
      },
      {
        title: 'NETWORK RATINGS',
        icon: '📊',
        query: `
          SELECT 
            COUNT(*) as total_events_rated,
            AVG(total_viewers) as avg_viewership,
            MAX(total_viewers) as peak_event_viewership,
            AVG(rating) as avg_rating,
            AVG(share) as avg_share
          FROM network_ratings
        `,
        formatter: (stats) => {
          console.log(`  Events with ratings: ${stats.total_events_rated}`);
          console.log(`  Average viewership: ${this.formatNumber(stats.avg_viewership / 1000000 || 0, 1)}M viewers`);
          console.log(`  Peak event viewership: ${this.formatNumber(stats.peak_event_viewership / 1000000 || 0, 1)}M viewers`);
          console.log(`  Average rating: ${this.formatNumber(stats.avg_rating || 0, 1)}`);
          console.log(`  Average share: ${this.formatNumber(stats.avg_share || 0, 1)}%`);
        }
      },
      {
        title: 'TOP BROADCAST MEDIA VALUE',
        icon: '🏆',
        query: `
          SELECT 
            d.first_name || ' ' || d.last_name as driver_name,
            dbm.total_camera_time,
            dbm.media_value,
            dbm.commentator_mentions,
            e.name as event_name
          FROM detailed_broadcast_metrics dbm
          JOIN drivers d ON dbm.driver_id = d.id
          JOIN events e ON dbm.event_id = e.id
          ORDER BY dbm.media_value DESC
          LIMIT 10
        `,
        formatter: (stats) => {
          // This would be called for a single result, but we can handle arrays too
          if (Array.isArray(stats)) {
            stats.forEach((driver, index) => {
              console.log(`  ${index + 1}. ${driver.driver_name} - ${driver.event_name}`);
              console.log(`     Media Value: ${this.formatCurrency(driver.media_value || 0)}K | Camera Time: ${driver.total_camera_time}s | Mentions: ${driver.commentator_mentions}`);
            });
          }
        }
      },
      {
        title: 'BROADCAST ROI ANALYSIS',
        icon: '📈',
        query: `
          SELECT 
            COUNT(*) as total_roi_calculations,
            AVG(roi_percentage) as avg_roi_percentage,
            SUM(media_value) as total_tracked_media_value,
            SUM(total_investment) as total_tracked_investment
          FROM sponsor_roi_calculations
          WHERE calculation_period = 'race'
        `,
        formatter: (stats) => {
          if (stats.total_roi_calculations > 0) {
            console.log(`  ROI calculations completed: ${stats.total_roi_calculations}`);
            console.log(`  Average broadcast ROI: ${this.formatNumber(stats.avg_roi_percentage || 0, 1)}%`);
            console.log(`  Total tracked media value: ${this.formatCurrency(stats.total_tracked_media_value || 0, true)}`);
            console.log(`  Total tracked investment: ${this.formatCurrency(stats.total_tracked_investment || 0, true)}`);
          }
        }
      }
    ];
  }
}

// Main execution function
async function main(): Promise<void> {
  const scraper = new BroadcastMetricsScraper();
  await scraper.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default BroadcastMetricsScraper;
