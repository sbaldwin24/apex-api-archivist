import BaseScraper, { SummarySection } from '../src/base/base-scraper';
import { PerformanceDataScraper as CorePerformanceScraper } from '../src/performance-scraper';
import ConfigManager from '../src/base/config-manager';
import ErrorHandler from '../src/base/error-handler';

export class PerformanceDataScraper extends BaseScraper {
  private errorHandler: ErrorHandler;
  private corePerformanceScraper: CorePerformanceScraper;

  constructor() {
    super({
      scraperName: 'Performance Data',
      schemaFile: './performance-schema.sql',
      enableSummary: true,
      logLevel: ConfigManager.getLogLevel() as any
    });
    
    this.errorHandler = ErrorHandler.forComponent('performance-data-scraper');
    this.corePerformanceScraper = new CorePerformanceScraper();
  }

  protected async scrapeData(): Promise<void> {
    await this.errorHandler.withRetry(
      async () => {
        // Delegate to the core performance scraper's scrapeData method
        await this.corePerformanceScraper['scrapeData']();
      },
      {
        operation: 'scrape_performance_data',
        component: 'performance-data-scraper',
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
        title: 'TELEMETRY DATA OVERVIEW',
        icon: '📊',
        query: `
          SELECT 
            COUNT(*) as total_telemetry_records,
            COUNT(DISTINCT event_id) as events_covered,
            COUNT(DISTINCT driver_id) as drivers_covered,
            AVG(lap_time) as avg_lap_time,
            AVG(speed) as avg_speed,
            MAX(speed) as max_speed,
            MIN(lap_time) as fastest_lap_time
          FROM telemetry_data
        `,
        formatter: (stats) => {
          console.log(`  Total telemetry records: ${stats.total_telemetry_records}`);
          console.log(`  Events covered: ${stats.events_covered}`);
          console.log(`  Drivers covered: ${stats.drivers_covered}`);
          console.log(`  Average lap time: ${this.formatNumber(stats.avg_lap_time || 0, 3)}s`);
          console.log(`  Average speed: ${this.formatNumber(stats.avg_speed || 0, 1)} mph`);
          console.log(`  Maximum speed: ${this.formatNumber(stats.max_speed || 0, 1)} mph`);
          console.log(`  Fastest lap time: ${this.formatNumber(stats.fastest_lap_time || 0, 3)}s`);
        }
      },
      {
        title: 'TIRE STRATEGY EFFICIENCY',
        icon: '🏁',
        query: `
          SELECT 
            COUNT(*) as total_pit_stops,
            COUNT(DISTINCT driver_id) as drivers_tracked,
            AVG(pit_stop_duration) as avg_pit_stop_time,
            MIN(pit_stop_duration) as fastest_pit_stop,
            MAX(pit_stop_duration) as slowest_pit_stop,
            COUNT(DISTINCT tire_compound) as tire_compounds_used,
            AVG(fuel_added) as avg_fuel_added,
            AVG(tire_age) as avg_tire_age
          FROM tire_strategy
        `,
        formatter: (stats) => {
          console.log(`  Total pit stops: ${stats.total_pit_stops}`);
          console.log(`  Drivers tracked: ${stats.drivers_tracked}`);
          console.log(`  Average pit stop time: ${this.formatNumber(stats.avg_pit_stop_time || 0, 2)}s`);
          console.log(`  Fastest pit stop: ${this.formatNumber(stats.fastest_pit_stop || 0, 2)}s`);
          console.log(`  Slowest pit stop: ${this.formatNumber(stats.slowest_pit_stop || 0, 2)}s`);
          console.log(`  Tire compounds used: ${stats.tire_compounds_used}`);
          console.log(`  Average fuel added: ${this.formatNumber(stats.avg_fuel_added || 0, 1)} gallons`);
          console.log(`  Average tire age at change: ${this.formatNumber(stats.avg_tire_age || 0, 0)} laps`);
        }
      },
      {
        title: 'FUEL EFFICIENCY ANALYSIS',
        icon: '⛽',
        query: `
          SELECT 
            COUNT(*) as fuel_data_points,
            AVG(fuel_consumption) as avg_fuel_consumption,
            MIN(fuel_consumption) as best_fuel_economy,
            MAX(fuel_consumption) as worst_fuel_economy,
            AVG(estimated_range) as avg_estimated_range,
            COUNT(*) FILTER (WHERE fuel_saving = true) as fuel_saving_instances,
            AVG(fuel_remaining) as avg_fuel_remaining
          FROM fuel_data
        `,
        formatter: (stats) => {
          console.log(`  Fuel data points: ${stats.fuel_data_points}`);
          console.log(`  Average fuel consumption: ${this.formatNumber(stats.avg_fuel_consumption || 0, 2)} mpg`);
          console.log(`  Best fuel economy: ${this.formatNumber(stats.best_fuel_economy || 0, 2)} mpg`);
          console.log(`  Worst fuel economy: ${this.formatNumber(stats.worst_fuel_economy || 0, 2)} mpg`);
          console.log(`  Average estimated range: ${this.formatNumber(stats.avg_estimated_range || 0, 0)} laps`);
          console.log(`  Fuel saving instances: ${stats.fuel_saving_instances}`);
          console.log(`  Average fuel remaining: ${this.formatNumber(stats.avg_fuel_remaining || 0, 2)} gallons`);
        }
      },
      {
        title: 'CAR SETUP OPTIMIZATION',
        icon: '🔧',
        query: `
          SELECT 
            COUNT(*) as total_setups,
            COUNT(DISTINCT driver_id) as drivers_with_setups,
            COUNT(DISTINCT session_type) as session_types,
            AVG(front_spoiler) as avg_front_spoiler,
            AVG(rear_spoiler) as avg_rear_spoiler,
            AVG(wedge) as avg_wedge,
            AVG(track_bar) as avg_track_bar
          FROM car_setup
          WHERE front_spoiler IS NOT NULL AND rear_spoiler IS NOT NULL
        `,
        formatter: (stats) => {
          console.log(`  Total setups: ${stats.total_setups}`);
          console.log(`  Drivers with setups: ${stats.drivers_with_setups}`);
          console.log(`  Session types: ${stats.session_types}`);
          console.log(`  Average front spoiler: ${this.formatNumber(stats.avg_front_spoiler || 0, 2)}°`);
          console.log(`  Average rear spoiler: ${this.formatNumber(stats.avg_rear_spoiler || 0, 2)}°`);
          console.log(`  Average wedge: ${this.formatNumber(stats.avg_wedge || 0, 1)} lbs`);
          console.log(`  Average track bar: ${this.formatNumber(stats.avg_track_bar || 0, 2)}"`);
        }
      },
      {
        title: 'COMMUNICATION INSIGHTS',
        icon: '📻',
        query: `
          SELECT 
            COUNT(*) as total_communications,
            COUNT(DISTINCT driver_id) as drivers_monitored,
            COUNT(*) FILTER (WHERE message_type = 'strategy') as strategy_comms,
            COUNT(*) FILTER (WHERE message_type = 'sponsor') as sponsor_comms,
            COUNT(*) FILTER (WHERE message_type = 'performance') as performance_comms,
            COUNT(*) FILTER (WHERE array_length(sponsor_mentions, 1) > 0) as comms_with_sponsor_mentions,
            COUNT(DISTINCT speaker) as unique_speakers
          FROM radio_communications
        `,
        formatter: (stats) => {
          console.log(`  Total communications: ${stats.total_communications}`);
          console.log(`  Drivers monitored: ${stats.drivers_monitored}`);
          console.log(`  Strategy communications: ${stats.strategy_comms}`);
          console.log(`  Sponsor communications: ${stats.sponsor_comms}`);
          console.log(`  Performance communications: ${stats.performance_comms}`);
          console.log(`  Communications with sponsor mentions: ${stats.comms_with_sponsor_mentions}`);
          console.log(`  Unique speakers: ${stats.unique_speakers}`);
        }
      },
      {
        title: 'PERFORMANCE CORRELATIONS',
        icon: '📈',
        query: `
          SELECT 
            COUNT(*) as total_correlations,
            COUNT(DISTINCT sponsor_name) as sponsors_analyzed,
            AVG(performance_score) as avg_performance_score,
            MAX(performance_score) as best_performance_score,
            MIN(performance_score) as lowest_performance_score,
            AVG(avg_speed) as overall_avg_speed,
            AVG(pit_stop_efficiency) as avg_pit_efficiency,
            AVG(fuel_efficiency) as avg_fuel_efficiency
          FROM performance_correlations
          WHERE performance_score IS NOT NULL
        `,
        formatter: (stats) => {
          console.log(`  Performance correlations: ${stats.total_correlations}`);
          console.log(`  Sponsors analyzed: ${stats.sponsors_analyzed}`);
          console.log(`  Average performance score: ${this.formatNumber(stats.avg_performance_score || 0, 2)}`);
          console.log(`  Best performance score: ${this.formatNumber(stats.best_performance_score || 0, 2)}`);
          console.log(`  Lowest performance score: ${this.formatNumber(stats.lowest_performance_score || 0, 2)}`);
          console.log(`  Overall average speed: ${this.formatNumber(stats.overall_avg_speed || 0, 1)} mph`);
          console.log(`  Average pit efficiency: ${this.formatNumber(stats.avg_pit_efficiency || 0, 2)}s`);
          console.log(`  Average fuel efficiency: ${this.formatNumber(stats.avg_fuel_efficiency || 0, 2)} mpg`);
        }
      },
      {
        title: 'TECHNICAL PERFORMANCE LEADERS',
        icon: '🏆',
        query: `
          SELECT 
            d.first_name || ' ' || d.last_name as driver_name,
            pas.technical_score,
            pas.avg_speed,
            pas.fastest_lap_time,
            pas.fuel_efficiency,
            pas.avg_pit_time,
            pas.pit_stops,
            e.name as event_name
          FROM performance_analytics_summary pas
          JOIN drivers d ON pas.driver_id = d.id
          JOIN events e ON pas.event_id = e.id
          WHERE pas.technical_score IS NOT NULL
          ORDER BY pas.technical_score DESC
          LIMIT 10
        `,
        formatter: (stats) => {
          if (Array.isArray(stats)) {
            stats.forEach((driver, index) => {
              console.log(`  ${index + 1}. ${driver.driver_name} (${driver.event_name})`);
              console.log(`     Technical Score: ${this.formatNumber(driver.technical_score || 0, 2)}`);
              console.log(`     Avg Speed: ${this.formatNumber(driver.avg_speed || 0, 1)} mph | Fastest Lap: ${this.formatNumber(driver.fastest_lap_time || 0, 3)}s`);
              console.log(`     Fuel Efficiency: ${this.formatNumber(driver.fuel_efficiency || 0, 2)} mpg | Avg Pit Time: ${this.formatNumber(driver.avg_pit_time || 0, 2)}s | Pit Stops: ${driver.pit_stops || 0}`);
            });
          } else if (stats) {
            console.log(`  1. ${stats.driver_name} (${stats.event_name})`);
            console.log(`     Technical Score: ${this.formatNumber(stats.technical_score || 0, 2)}`);
            console.log(`     Avg Speed: ${this.formatNumber(stats.avg_speed || 0, 1)} mph | Fastest Lap: ${this.formatNumber(stats.fastest_lap_time || 0, 3)}s`);
            console.log(`     Fuel Efficiency: ${this.formatNumber(stats.fuel_efficiency || 0, 2)} mpg | Avg Pit Time: ${this.formatNumber(stats.avg_pit_time || 0, 2)}s | Pit Stops: ${stats.pit_stops || 0}`);
          }
        }
      },
      {
        title: 'SPONSOR PERFORMANCE IMPACT',
        icon: '🤝',
        query: `
          SELECT 
            pc.sponsor_name,
            COUNT(*) as events_tracked,
            AVG(pc.performance_score) as avg_performance_score,
            AVG(pc.avg_speed) as avg_speed,
            AVG(pc.pit_stop_efficiency) as avg_pit_efficiency,
            SUM(pc.radio_mentions) as total_radio_mentions
          FROM performance_correlations pc
          WHERE pc.sponsor_name IS NOT NULL AND pc.performance_score IS NOT NULL
          GROUP BY pc.sponsor_name
          ORDER BY AVG(pc.performance_score) DESC
          LIMIT 10
        `,
        formatter: (stats) => {
          if (Array.isArray(stats)) {
            stats.forEach((sponsor, index) => {
              console.log(`  ${index + 1}. ${sponsor.sponsor_name}`);
              console.log(`     Events Tracked: ${sponsor.events_tracked} | Avg Performance: ${this.formatNumber(sponsor.avg_performance_score || 0, 2)}`);
              console.log(`     Avg Speed: ${this.formatNumber(sponsor.avg_speed || 0, 1)} mph | Pit Efficiency: ${this.formatNumber(sponsor.avg_pit_efficiency || 0, 2)}s`);
              console.log(`     Radio Mentions: ${sponsor.total_radio_mentions || 0}`);
            });
          } else if (stats) {
            console.log(`  1. ${stats.sponsor_name}`);
            console.log(`     Events Tracked: ${stats.events_tracked} | Avg Performance: ${this.formatNumber(stats.avg_performance_score || 0, 2)}`);
            console.log(`     Avg Speed: ${this.formatNumber(stats.avg_speed || 0, 1)} mph | Pit Efficiency: ${this.formatNumber(stats.avg_pit_efficiency || 0, 2)}s`);
            console.log(`     Radio Mentions: ${stats.total_radio_mentions || 0}`);
          }
        }
      }
    ];
  }
}

// Main execution function
async function main(): Promise<void> {
  const scraper = new PerformanceDataScraper();
  await scraper.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default PerformanceDataScraper;
