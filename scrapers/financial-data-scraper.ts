import BaseScraper, { SummarySection } from '../src/base/base-scraper';
import { FinancialDataScraper as CoreFinancialScraper } from '../src/financial-scraper';
import ConfigManager from '../src/base/config-manager';
import ErrorHandler from '../src/base/error-handler';

export class FinancialDataScraper extends BaseScraper {
  private errorHandler: ErrorHandler;
  private coreFinancialScraper: CoreFinancialScraper;

  constructor() {
    super({
      scraperName: 'Financial Data',
      schemaFile: './financial-schema.sql',
      enableSummary: true,
      logLevel: ConfigManager.getLogLevel() as any
    });
    
    this.errorHandler = ErrorHandler.forComponent('financial-data-scraper');
    this.coreFinancialScraper = new CoreFinancialScraper();
  }

  protected async scrapeData(): Promise<void> {
    await this.errorHandler.withRetry(
      async () => {
        // Delegate to the core financial scraper's scrapeData method
        await this.coreFinancialScraper['scrapeData']();
      },
      {
        operation: 'scrape_financial_data',
        component: 'financial-data-scraper',
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
        title: 'SPONSOR CONTRACTS OVERVIEW',
        icon: '💼',
        query: `
          SELECT 
            COUNT(*) as total_contracts,
            COUNT(DISTINCT sponsor_name) as unique_sponsors,
            COUNT(DISTINCT driver_id) as sponsored_drivers,
            SUM(contract_value) as total_contract_value,
            AVG(contract_value) as avg_contract_value,
            SUM(activation_budget) as total_activation_budget,
            SUM(media_value) as total_media_value
          FROM sponsor_contracts
        `,
        formatter: (stats) => {
          console.log(`  Total contracts: ${stats.total_contracts}`);
          console.log(`  Unique sponsors: ${stats.unique_sponsors}`);
          console.log(`  Sponsored drivers: ${stats.sponsored_drivers}`);
          console.log(`  Total contract value: ${this.formatCurrency(stats.total_contract_value || 0, true)}`);
          console.log(`  Average contract value: ${this.formatCurrency(stats.avg_contract_value || 0, true)}`);
          console.log(`  Total activation budget: ${this.formatCurrency(stats.total_activation_budget || 0, true)}`);
          console.log(`  Total estimated media value: ${this.formatCurrency(stats.total_media_value || 0, true)}`);
        }
      },
      {
        title: 'PRIZE MONEY DISTRIBUTION',
        icon: '🏆',
        query: `
          SELECT 
            COUNT(*) as events_with_prize_data,
            SUM(total_purse) as total_prize_money,
            AVG(total_purse) as avg_event_purse,
            MAX(total_purse) as largest_purse,
            SUM(winner_payout) as total_winner_payouts,
            SUM(points_fund) as total_points_fund,
            SUM(playoff_bonus) as total_playoff_bonuses
          FROM prize_money
        `,
        formatter: (stats) => {
          console.log(`  Events with prize data: ${stats.events_with_prize_data}`);
          console.log(`  Total prize money: ${this.formatCurrency(stats.total_prize_money || 0, true)}`);
          console.log(`  Average event purse: ${this.formatCurrency(stats.avg_event_purse || 0, true)}`);
          console.log(`  Largest single purse: ${this.formatCurrency(stats.largest_purse || 0, true)}`);
          console.log(`  Total winner payouts: ${this.formatCurrency(stats.total_winner_payouts || 0, true)}`);
          console.log(`  Points fund contributions: ${this.formatCurrency(stats.total_points_fund || 0, true)}`);
          console.log(`  Playoff bonuses: ${this.formatCurrency(stats.total_playoff_bonuses || 0, true)}`);
        }
      },
      {
        title: 'TEAM BUDGET ANALYSIS',
        icon: '🏎️',
        query: `
          SELECT 
            COUNT(*) as teams_tracked,
            SUM(total_budget) as combined_budgets,
            AVG(total_budget) as avg_team_budget,
            MAX(total_budget) as highest_budget,
            MIN(total_budget) as lowest_budget,
            SUM(driver_salaries) as total_driver_salaries,
            SUM(car_development) as total_rd_spend,
            SUM(facility_rent) as total_facility_costs,
            SUM(insurance) as total_insurance_costs
          FROM team_budgets
          WHERE season = 2024
        `,
        formatter: (stats) => {
          console.log(`  Teams tracked: ${stats.teams_tracked}`);
          console.log(`  Combined budgets: ${this.formatCurrency(stats.combined_budgets || 0, true)}`);
          console.log(`  Average team budget: ${this.formatCurrency(stats.avg_team_budget || 0, true)}`);
          console.log(`  Highest budget: ${this.formatCurrency(stats.highest_budget || 0, true)}`);
          console.log(`  Lowest budget: ${this.formatCurrency(stats.lowest_budget || 0, true)}`);
          console.log(`  Total driver salaries: ${this.formatCurrency(stats.total_driver_salaries || 0, true)}`);
          console.log(`  Total R&D spending: ${this.formatCurrency(stats.total_rd_spend || 0, true)}`);
          console.log(`  Facility costs: ${this.formatCurrency(stats.total_facility_costs || 0, true)}`);
          console.log(`  Insurance costs: ${this.formatCurrency(stats.total_insurance_costs || 0, true)}`);
        }
      },
      {
        title: 'MERCHANDISE REVENUE',
        icon: '🛍️',
        query: `
          SELECT 
            COUNT(*) as total_merchandise_records,
            COUNT(DISTINCT driver_id) as drivers_with_merchandise,
            COUNT(DISTINCT product_category) as product_categories,
            SUM(revenue_amount) as total_merchandise_revenue,
            SUM(units_sold) as total_units_sold,
            AVG(average_price) as avg_item_price,
            MAX(revenue_amount) as highest_single_revenue
          FROM merchandise_revenue
        `,
        formatter: (stats) => {
          console.log(`  Merchandise records: ${stats.total_merchandise_records}`);
          console.log(`  Drivers with merchandise: ${stats.drivers_with_merchandise}`);
          console.log(`  Product categories: ${stats.product_categories}`);
          console.log(`  Total merchandise revenue: ${this.formatCurrency(stats.total_merchandise_revenue || 0)}`);
          console.log(`  Total units sold: ${this.formatNumber(stats.total_units_sold || 0)}`);
          console.log(`  Average item price: ${this.formatCurrency(stats.avg_item_price || 0)}`);
          console.log(`  Highest single revenue: ${this.formatCurrency(stats.highest_single_revenue || 0)}`);
        }
      },
      {
        title: 'ACTIVATION SPENDING',
        icon: '📢',
        query: `
          SELECT 
            COUNT(*) as total_activations,
            COUNT(DISTINCT sponsor_name) as sponsors_activating,
            COUNT(DISTINCT activation_type) as activation_types,
            SUM(cost_amount) as total_activation_spend,
            AVG(cost_amount) as avg_activation_cost,
            SUM(estimated_reach) as total_estimated_reach,
            AVG(engagement_score) as avg_engagement_score,
            MAX(cost_amount) as most_expensive_activation
          FROM activation_costs
        `,
        formatter: (stats) => {
          console.log(`  Total activations: ${stats.total_activations}`);
          console.log(`  Sponsors activating: ${stats.sponsors_activating}`);
          console.log(`  Activation types: ${stats.activation_types}`);
          console.log(`  Total activation spend: ${this.formatCurrency(stats.total_activation_spend || 0, true)}`);
          console.log(`  Average activation cost: ${this.formatCurrency(stats.avg_activation_cost || 0)}`);
          console.log(`  Total estimated reach: ${this.formatNumber(stats.total_estimated_reach / 1000000 || 0, 1)}M people`);
          console.log(`  Average engagement score: ${this.formatNumber(stats.avg_engagement_score || 0, 1)}/100`);
          console.log(`  Most expensive activation: ${this.formatCurrency(stats.most_expensive_activation || 0)}`);
        }
      },
      {
        title: 'ROI PERFORMANCE',
        icon: '📈',
        query: `
          SELECT 
            COUNT(*) as roi_calculations,
            AVG(roi_percentage) as avg_roi_percentage,
            MAX(roi_percentage) as best_roi_percentage,
            MIN(roi_percentage) as worst_roi_percentage,
            SUM(total_investment) as total_tracked_investment,
            SUM(total_roi_value) as total_roi_value,
            COUNT(CASE WHEN roi_percentage > 0 THEN 1 END) as profitable_sponsorships,
            COUNT(CASE WHEN roi_percentage > 100 THEN 1 END) as highly_profitable_sponsorships
          FROM sponsor_roi_calculations
        `,
        formatter: (stats) => {
          console.log(`  ROI calculations: ${stats.roi_calculations}`);
          console.log(`  Average ROI: ${this.formatNumber(stats.avg_roi_percentage || 0, 1)}%`);
          console.log(`  Best ROI: ${this.formatNumber(stats.best_roi_percentage || 0, 1)}%`);
          console.log(`  Worst ROI: ${this.formatNumber(stats.worst_roi_percentage || 0, 1)}%`);
          console.log(`  Total tracked investment: ${this.formatCurrency(stats.total_tracked_investment || 0, true)}`);
          console.log(`  Total ROI value: ${this.formatCurrency(stats.total_roi_value || 0, true)}`);
          console.log(`  Profitable sponsorships: ${stats.profitable_sponsorships} of ${stats.roi_calculations}`);
          console.log(`  Highly profitable (>100% ROI): ${stats.highly_profitable_sponsorships}`);
        }
      },
      {
        title: 'TOP PERFORMING SPONSORSHIPS',
        icon: '🌟',
        query: `
          SELECT 
            sc.sponsor_name,
            d.first_name || ' ' || d.last_name as driver_name,
            sc.contract_value,
            roi.roi_percentage,
            roi.total_roi_value,
            roi.total_investment
          FROM sponsor_roi_calculations roi
          JOIN sponsor_contracts sc ON roi.sponsor_name = sc.sponsor_name AND roi.driver_id = sc.driver_id
          LEFT JOIN drivers d ON roi.driver_id = d.id
          WHERE roi.roi_percentage > 0
          ORDER BY roi.roi_percentage DESC
          LIMIT 10
        `,
        formatter: (stats) => {
          if (Array.isArray(stats)) {
            stats.forEach((sponsorship, index) => {
              console.log(`  ${index + 1}. ${sponsorship.sponsor_name} + ${sponsorship.driver_name || 'Unknown Driver'}`);
              console.log(`     ROI: ${this.formatNumber(sponsorship.roi_percentage || 0, 1)}% | Contract: ${this.formatCurrency(sponsorship.contract_value || 0, true)} | Value Generated: ${this.formatCurrency(sponsorship.total_roi_value || 0, true)}`);
            });
          } else if (stats) {
            console.log(`  1. ${stats.sponsor_name} + ${stats.driver_name || 'Unknown Driver'}`);
            console.log(`     ROI: ${this.formatNumber(stats.roi_percentage || 0, 1)}% | Contract: ${this.formatCurrency(stats.contract_value || 0, true)} | Value Generated: ${this.formatCurrency(stats.total_roi_value || 0, true)}`);
          }
        }
      }
    ];
  }
}

// Main execution function
async function main(): Promise<void> {
  const scraper = new FinancialDataScraper();
  await scraper.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default FinancialDataScraper;
