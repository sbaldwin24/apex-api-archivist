import { FinancialDataScraper } from '../../src/financial-scraper';
import { TestHelpers } from '../utils/test-helpers';
import { pool } from '../../src/database';

// Mock dependencies
jest.mock('../../src/database', () => ({
  pool: {
    connect: jest.fn(),
    end: jest.fn(),
  }
}));

jest.mock('../../src/base/config-manager');
jest.mock('../../src/base/error-handler');
jest.mock('../../src/structured-logger');

describe('FinancialDataScraper', () => {
  let scraper: FinancialDataScraper;
  let mockClient: any;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    // Mock pool.connect to return our mock client
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);

    // Create mock logger
    mockLogger = TestHelpers.createMockLogger();

    // Create scraper instance
    scraper = new FinancialDataScraper();
    
    // Replace logger with mock
    (scraper as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(scraper).toBeInstanceOf(FinancialDataScraper);
      expect((scraper as any).config.scraperName).toBe('Financial Data');
      expect((scraper as any).config.schemaFile).toBe('./financial-schema.sql');
      expect((scraper as any).config.enableSummary).toBe(true);
    });
  });

  describe('Sponsor Contract Generation', () => {
    it('should generate sponsor contract data with all required fields', () => {
      const contractData = (scraper as any).generateSponsorContractData();

      expect(contractData).toBeArray();
      expect(contractData.length).toBeGreaterThan(0);

      // Check first contract has all required fields
      const firstContract = contractData[0];
      expect(firstContract).toHaveProperty('driverId');
      expect(firstContract).toHaveProperty('sponsorName');
      expect(firstContract).toHaveProperty('contractValue');
      expect(firstContract).toHaveProperty('contractLength');
      expect(firstContract).toHaveProperty('contractType');
      expect(firstContract).toHaveProperty('startDate');
      expect(firstContract).toHaveProperty('endDate');
      expect(firstContract).toHaveProperty('performanceBonus');
      expect(firstContract).toHaveProperty('activationBudget');
      expect(firstContract).toHaveProperty('mediaValue');
      expect(firstContract).toHaveProperty('merchandiseRevenue');
      expect(firstContract).toHaveProperty('digitalRights');
    });

    it('should generate realistic contract values', () => {
      const contractData = (scraper as any).generateSponsorContractData();

      contractData.forEach((contract: any) => {
        expect(contract.contractValue).toBeNumber();
        expect(contract.contractValue).toBeGreaterThan(0);
        expect(contract.contractLength).toBeNumber();
        expect(contract.contractLength).toBeGreaterThan(0);
        expect(contract.performanceBonus).toBeNumber();
        expect(contract.activationBudget).toBeNumber();
        expect(['primary', 'associate', 'personal_services']).toContain(contract.contractType);
      });
    });
  });

  describe('Prize Money Generation', () => {
    it('should generate prize money data with enhanced fields', () => {
      const prizeData = (scraper as any).generatePrizeMoneyData();

      expect(prizeData).toBeArray();
      expect(prizeData.length).toBeGreaterThan(0);

      const firstPrize = prizeData[0];
      expect(firstPrize).toHaveProperty('eventId');
      expect(firstPrize).toHaveProperty('totalPurse');
      expect(firstPrize).toHaveProperty('winnerPayout');
      expect(firstPrize).toHaveProperty('positionPayouts');
      expect(firstPrize).toHaveProperty('bonuses');
      expect(firstPrize).toHaveProperty('pointsFund');
      expect(firstPrize).toHaveProperty('playoffBonus');
    });

    it('should generate valid position payouts structure', () => {
      const prizeData = (scraper as any).generatePrizeMoneyData();
      const firstPrize = prizeData[0];

      expect(firstPrize.positionPayouts).toBeObject();
      expect(firstPrize.positionPayouts['1']).toBe(firstPrize.winnerPayout);
      expect(Object.keys(firstPrize.positionPayouts)).toHaveLength(40); // 40 positions
    });
  });

  describe('Team Budget Generation', () => {
    it('should generate team budget data with enhanced categories', () => {
      const budgetData = (scraper as any).generateTeamBudgetData();

      expect(budgetData).toBeArray();
      expect(budgetData.length).toBeGreaterThan(0);

      const firstBudget = budgetData[0];
      expect(firstBudget).toHaveProperty('teamId');
      expect(firstBudget).toHaveProperty('season');
      expect(firstBudget).toHaveProperty('totalBudget');
      expect(firstBudget).toHaveProperty('driverSalaries');
      expect(firstBudget).toHaveProperty('carDevelopment');
      expect(firstBudget).toHaveProperty('operations');
      expect(firstBudget).toHaveProperty('marketing');
      expect(firstBudget).toHaveProperty('travelExpenses');
      expect(firstBudget).toHaveProperty('facilityRent');
      expect(firstBudget).toHaveProperty('insurance');
      expect(firstBudget).toHaveProperty('contingency');
    });

    it('should generate budgets that add up correctly', () => {
      const budgetData = (scraper as any).generateTeamBudgetData();
      const firstBudget = budgetData[0];

      const sum = firstBudget.driverSalaries + 
                  firstBudget.carDevelopment +
                  firstBudget.operations +
                  firstBudget.marketing +
                  firstBudget.travelExpenses +
                  firstBudget.facilityRent +
                  firstBudget.insurance +
                  firstBudget.contingency;

      // Should be close to total budget (within rounding tolerance)
      expect(Math.abs(sum - firstBudget.totalBudget)).toBeLessThan(firstBudget.totalBudget * 0.01);
    });
  });

  describe('Merchandise Revenue Generation', () => {
    it('should generate merchandise revenue data', () => {
      const merchandiseData = (scraper as any).generateMerchandiseRevenue();

      expect(merchandiseData).toBeArray();
      expect(merchandiseData.length).toBeGreaterThan(0);

      const firstItem = merchandiseData[0];
      expect(firstItem).toHaveProperty('eventId');
      expect(firstItem).toHaveProperty('driverId');
      expect(firstItem).toHaveProperty('sponsorName');
      expect(firstItem).toHaveProperty('productCategory');
      expect(firstItem).toHaveProperty('revenueAmount');
      expect(firstItem).toHaveProperty('unitsSold');
      expect(firstItem).toHaveProperty('averagePrice');
      expect(firstItem).toHaveProperty('saleDate');
    });

    it('should calculate average price correctly', () => {
      const merchandiseData = (scraper as any).generateMerchandiseRevenue();

      merchandiseData.forEach((item: any) => {
        const calculatedPrice = item.revenueAmount / item.unitsSold;
        expect(Math.abs(item.averagePrice - calculatedPrice)).toBeLessThan(0.01);
      });
    });
  });

  describe('Activation Spend Generation', () => {
    it('should generate activation spend data', () => {
      const activationData = (scraper as any).generateActivationSpend();

      expect(activationData).toBeArray();
      expect(activationData.length).toBeGreaterThan(0);

      const firstActivation = activationData[0];
      expect(firstActivation).toHaveProperty('eventId');
      expect(firstActivation).toHaveProperty('sponsorName');
      expect(firstActivation).toHaveProperty('activationType');
      expect(firstActivation).toHaveProperty('costAmount');
      expect(firstActivation).toHaveProperty('estimatedReach');
      expect(firstActivation).toHaveProperty('engagementScore');
      expect(firstActivation).toHaveProperty('roiEstimate');
    });

    it('should generate valid activation types', () => {
      const activationData = (scraper as any).generateActivationSpend();
      const validTypes = ['hospitality', 'display', 'sampling', 'contest', 'digital'];

      activationData.forEach((activation: any) => {
        expect(validTypes).toContain(activation.activationType);
        expect(activation.engagementScore).toBeGreaterThanOrEqual(50);
        expect(activation.engagementScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Data Saving Methods', () => {
    beforeEach(() => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('BEGIN')) return Promise.resolve();
        if (query.includes('COMMIT')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });
    });

    it('should save sponsor contracts with transaction handling', async () => {
      const contractData = [{
        driverId: 'test_driver',
        sponsorName: 'Test Sponsor',
        contractValue: 10000000,
        contractLength: 3,
        contractType: 'primary',
        startDate: '2024-01-01',
        endDate: '2026-12-31',
        performanceBonus: 1000000,
        activationBudget: 3000000,
        mediaValue: 8000000,
        merchandiseRevenue: 2000000,
        digitalRights: 500000
      }];

      await (scraper as any).saveSponsorContracts(contractData);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should save prize money data', async () => {
      const prizeData = [{
        eventId: 'test_event',
        totalPurse: 8000000,
        winnerPayout: 1200000,
        positionPayouts: { '1': 1200000, '2': 800000 },
        bonuses: { 'pole_position': 50000 },
        pointsFund: 1200000,
        playoffBonus: 0
      }];

      await (scraper as any).savePrizeMoneyData(prizeData);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('INSERT')) {
          throw new Error('Database error');
        }
        return Promise.resolve();
      });

      const contractData = [{
        driverId: 'test_driver',
        sponsorName: 'Test Sponsor',
        contractValue: 10000000,
        contractLength: 3,
        contractType: 'primary',
        startDate: '2024-01-01',
        endDate: '2026-12-31',
        performanceBonus: 1000000,
        activationBudget: 3000000
      }];

      await expect((scraper as any).saveSponsorContracts(contractData)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('ROI Calculation', () => {
    it('should calculate comprehensive ROI', async () => {
      // Mock database results
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('BEGIN') || query.includes('COMMIT')) {
          return Promise.resolve();
        }
        if (query.includes('SELECT')) {
          return Promise.resolve({
            rows: [{
              sponsor_name: 'Test Sponsor',
              driver_id: 'test_driver',
              contract_value: 10000000,
              activation_budget: 3000000,
              merchandise_revenue: 500000,
              total_activation_cost: 2000000
            }]
          });
        }
        return Promise.resolve();
      });

      await (scraper as any).calculateComprehensiveROI();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockLogger.info).toHaveBeenCalledWith('Calculating comprehensive ROI metrics', 'calculation');
      expect(mockLogger.info).toHaveBeenCalledWith('ROI calculations completed successfully', 'calculation');
    });
  });

  describe('Summary Sections', () => {
    it('should provide comprehensive summary sections', () => {
      const summarySections = (scraper as any).getSummarySections();

      expect(summarySections).toBeArray();
      expect(summarySections.length).toBeGreaterThan(5);

      const sectionTitles = summarySections.map((s: any) => s.title);
      expect(sectionTitles).toContain('SPONSOR CONTRACTS OVERVIEW');
      expect(sectionTitles).toContain('PRIZE MONEY DISTRIBUTION');
      expect(sectionTitles).toContain('TEAM BUDGET ANALYSIS');
      expect(sectionTitles).toContain('MERCHANDISE REVENUE');
      expect(sectionTitles).toContain('ACTIVATION SPENDING');
      expect(sectionTitles).toContain('ROI PERFORMANCE');

      // Check that each section has required properties
      summarySections.forEach((section: any) => {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('icon');
        expect(section).toHaveProperty('query');
        expect(section).toHaveProperty('formatter');
        expect(typeof section.formatter).toBe('function');
      });
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain legacy function export', async () => {
      // Mock the run method
      const runSpy = jest.spyOn(scraper, 'run').mockResolvedValue();

      await scraper.scrapeFinancialData();

      expect(runSpy).toHaveBeenCalled();
    });
  });
});
