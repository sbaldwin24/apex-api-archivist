import { ScraperManager, ScraperDefinition } from '../../src/base/scraper-manager';
import { TestHelpers } from '../utils/test-helpers';
import BaseScraper from '../../src/base/base-scraper';

// Mock the base scraper class
class MockScraper extends BaseScraper {
  constructor() {
    super({ scraperName: 'mock-scraper' });
  }

  override async run(): Promise<void> {
    // Mock implementation
    return Promise.resolve();
  }

  protected async scrapeData(): Promise<void> {
    // Mock implementation
    return Promise.resolve();
  }

  protected getSummarySections() {
    return [];
  }
}

class FailingScraper extends BaseScraper {
  constructor() {
    super({ scraperName: 'failing-scraper' });
  }

  override async run(): Promise<void> {
    throw new Error('Mock scraper failure');
  }

  protected async scrapeData(): Promise<void> {
    throw new Error('Mock scraper failure');
  }

  protected getSummarySections() {
    return [];
  }
}

describe('ScraperManager', () => {
  let scraperManager: ScraperManager;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    scraperManager = new ScraperManager();
    mockLogger = TestHelpers.createMockLogger();
    
    // Mock the logger
    (scraperManager as any).logger = mockLogger;
  });

  describe('Scraper Registration', () => {
    it('should register a scraper successfully', () => {
      const scraperDefinition: ScraperDefinition = {
        name: 'test-scraper',
        description: 'A test scraper',
        priority: 1,
        enabled: true,
        factory: () => new MockScraper()
      };

      scraperManager.register(scraperDefinition);

      const registered = scraperManager.getScraper('test-scraper');
      expect(registered).toEqual(scraperDefinition);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Registered scraper: test-scraper',
        'registration'
      );
    });

    it('should warn when registering duplicate scraper', () => {
      const scraperDefinition: ScraperDefinition = {
        name: 'duplicate-scraper',
        description: 'A duplicate scraper',
        priority: 1,
        enabled: true,
        factory: () => new MockScraper()
      };

      scraperManager.register(scraperDefinition);
      scraperManager.register(scraperDefinition); // Register again

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scraper 'duplicate-scraper' is already registered",
        'registration'
      );
    });

    it('should register multiple scrapers', () => {
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'scraper-1',
          description: 'First scraper',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        },
        {
          name: 'scraper-2',
          description: 'Second scraper',
          priority: 2,
          enabled: true,
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);

      expect(scraperManager.getScraper('scraper-1')).toBeDefined();
      expect(scraperManager.getScraper('scraper-2')).toBeDefined();
    });
  });

  describe('Scraper Listing', () => {
    beforeEach(() => {
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'enabled-scraper',
          description: 'An enabled scraper',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        },
        {
          name: 'disabled-scraper',
          description: 'A disabled scraper',
          priority: 2,
          enabled: false,
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);
    });

    it('should list all registered scrapers', () => {
      const scrapers = scraperManager.listScrapers();
      
      expect(scrapers).toHaveLength(2);
      expect(scrapers.map(s => s.name)).toContain('enabled-scraper');
      expect(scrapers.map(s => s.name)).toContain('disabled-scraper');
    });

    it('should list only enabled scrapers', () => {
      const enabledScrapers = scraperManager.listEnabledScrapers();
      
      expect(enabledScrapers).toHaveLength(1);
      expect(enabledScrapers[0]?.name).toBe('enabled-scraper');
    });

    it('should return empty array when no scrapers registered', () => {
      const emptyManager = new ScraperManager();
      
      expect(emptyManager.listScrapers()).toEqual([]);
      expect(emptyManager.listEnabledScrapers()).toEqual([]);
    });
  });

  describe('Scraper Validation', () => {
    it('should validate scrapers with no dependencies', () => {
      const scraperDefinition: ScraperDefinition = {
        name: 'simple-scraper',
        description: 'A simple scraper',
        priority: 1,
        enabled: true,
        factory: () => new MockScraper()
      };

      scraperManager.register(scraperDefinition);

      const validation = scraperManager.validateScrapers();
      
      expect(validation.valid).toContain('simple-scraper');
      expect(validation.invalid).toEqual([]);
    });

    it('should validate scrapers with valid dependencies', () => {
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'base-scraper',
          description: 'Base scraper',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        },
        {
          name: 'dependent-scraper',
          description: 'Dependent scraper',
          priority: 2,
          enabled: true,
          dependencies: ['base-scraper'],
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);

      const validation = scraperManager.validateScrapers();
      
      expect(validation.valid).toContain('base-scraper');
      expect(validation.valid).toContain('dependent-scraper');
      expect(validation.invalid).toEqual([]);
    });

    it('should identify scrapers with missing dependencies', () => {
      const scraperDefinition: ScraperDefinition = {
        name: 'dependent-scraper',
        description: 'Scraper with missing dependency',
        priority: 1,
        enabled: true,
        dependencies: ['missing-scraper'],
        factory: () => new MockScraper()
      };

      scraperManager.register(scraperDefinition);

      const validation = scraperManager.validateScrapers();
      
      expect(validation.valid).toEqual([]);
      expect(validation.invalid).toHaveLength(1);
      expect(validation.invalid[0]?.name).toBe('dependent-scraper');
      expect(validation.invalid[0]?.errors).toContain("Dependency 'missing-scraper' not found");
    });
  });

  describe('Dependency Ordering', () => {
    beforeEach(() => {
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'scraper-c',
          description: 'Scraper C',
          priority: 3,
          enabled: true,
          dependencies: ['scraper-a', 'scraper-b'],
          factory: () => new MockScraper()
        },
        {
          name: 'scraper-b',
          description: 'Scraper B',
          priority: 2,
          enabled: true,
          dependencies: ['scraper-a'],
          factory: () => new MockScraper()
        },
        {
          name: 'scraper-a',
          description: 'Scraper A',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);
    });

    it('should order scrapers by dependencies correctly', () => {
      // Access the private method for testing
      const orderedScrapers = (scraperManager as any).orderScrapersByDependencies([
        'scraper-c', 'scraper-b', 'scraper-a'
      ]);
      
      expect(orderedScrapers).toEqual(['scraper-a', 'scraper-b', 'scraper-c']);
    });

    it('should detect circular dependencies', () => {
      // Create circular dependency
      const circularScrapers: ScraperDefinition[] = [
        {
          name: 'scraper-x',
          description: 'Scraper X',
          priority: 1,
          enabled: true,
          dependencies: ['scraper-y'],
          factory: () => new MockScraper()
        },
        {
          name: 'scraper-y',
          description: 'Scraper Y',
          priority: 1,
          enabled: true,
          dependencies: ['scraper-x'],
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(circularScrapers);

      expect(() => {
        (scraperManager as any).orderScrapersByDependencies(['scraper-x', 'scraper-y']);
      }).toThrow(/Circular dependency detected/);
    });
  });

  describe('Scraper Execution', () => {
    beforeEach(() => {
      // Mock the schema manager to avoid database calls
      (scraperManager as any).schemaManager = {
        setupSchemas: jest.fn().mockResolvedValue(undefined)
      };
    });

    it('should run a single scraper successfully', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const scraperDefinition: ScraperDefinition = {
        name: 'test-scraper',
        description: 'Test scraper',
        priority: 1,
        enabled: true,
        factory: () => ({ run: mockRun } as any)
      };

      scraperManager.register(scraperDefinition);

      await scraperManager.runScraper('test-scraper');

      expect(mockRun).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting scraper: test-scraper',
        'execution'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Completed scraper: test-scraper',
        'execution'
      );
    });

    it('should skip disabled scrapers', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const scraperDefinition: ScraperDefinition = {
        name: 'disabled-scraper',
        description: 'Disabled scraper',
        priority: 1,
        enabled: false,
        factory: () => ({ run: mockRun } as any)
      };

      scraperManager.register(scraperDefinition);

      await scraperManager.runScraper('disabled-scraper');

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Scraper 'disabled-scraper' is disabled, skipping",
        'execution'
      );
    });

    it('should throw error for non-existent scraper', async () => {
      await expect(
        scraperManager.runScraper('non-existent')
      ).rejects.toThrow("Scraper 'non-existent' not found");
    });

    it('should handle scraper execution errors', async () => {
      const scraperDefinition: ScraperDefinition = {
        name: 'failing-scraper',
        description: 'Failing scraper',
        priority: 1,
        enabled: true,
        factory: () => new FailingScraper()
      };

      scraperManager.register(scraperDefinition);

      await expect(
        scraperManager.runScraper('failing-scraper')
      ).rejects.toThrow('Mock scraper failure');
    });

    it('should setup schemas before running scraper', async () => {
      const mockSetupSchemas = jest.fn().mockResolvedValue(undefined);
      (scraperManager as any).schemaManager.setupSchemas = mockSetupSchemas;

      const scraperDefinition: ScraperDefinition = {
        name: 'schema-scraper',
        description: 'Scraper with schemas',
        priority: 1,
        enabled: true,
        schemas: ['core', 'test-schema'],
        factory: () => new MockScraper()
      };

      scraperManager.register(scraperDefinition);

      await scraperManager.runScraper('schema-scraper');

      expect(mockSetupSchemas).toHaveBeenCalledWith(['core', 'test-schema']);
    });

    it('should run dependencies before the main scraper', async () => {
      const runOrder: string[] = [];
      
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'dependency-scraper',
          description: 'Dependency scraper',
          priority: 1,
          enabled: true,
          factory: () => ({
            run: async () => {
              runOrder.push('dependency-scraper');
            }
          } as any)
        },
        {
          name: 'main-scraper',
          description: 'Main scraper',
          priority: 2,
          enabled: true,
          dependencies: ['dependency-scraper'],
          factory: () => ({
            run: async () => {
              runOrder.push('main-scraper');
            }
          } as any)
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);

      await scraperManager.runScraper('main-scraper');

      expect(runOrder).toEqual(['dependency-scraper', 'main-scraper']);
    });

    it('should handle dry run mode', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const scraperDefinition: ScraperDefinition = {
        name: 'dry-run-scraper',
        description: 'Dry run scraper',
        priority: 1,
        enabled: true,
        factory: () => ({ run: mockRun } as any)
      };

      scraperManager.register(scraperDefinition);

      await scraperManager.runScraper('dry-run-scraper', { dryRun: true });

      expect(mockRun).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Dry run: Would execute scraper 'dry-run-scraper'",
        'execution'
      );
    });
  });

  describe('Multiple Scraper Execution', () => {
    beforeEach(() => {
      // Mock the schema manager
      (scraperManager as any).schemaManager = {
        setupSchemas: jest.fn().mockResolvedValue(undefined)
      };

      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'scraper-1',
          description: 'First scraper',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        },
        {
          name: 'scraper-2',
          description: 'Second scraper',
          priority: 2,
          enabled: true,
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);
    });

    it('should run multiple scrapers sequentially', async () => {
      const runOptions = { parallel: false };
      
      await scraperManager.runScrapers(['scraper-1', 'scraper-2'], runOptions);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting scraper: scraper-1',
        'execution'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting scraper: scraper-2',
        'execution'
      );
    });

    it('should run all enabled scrapers', async () => {
      await scraperManager.runAllScrapers();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting scraper: scraper-1',
        'execution'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting scraper: scraper-2',
        'execution'
      );
    });
  });

  describe('Status Summary', () => {
    it('should return correct status summary', () => {
      const scraperDefinitions: ScraperDefinition[] = [
        {
          name: 'enabled-scraper',
          description: 'Enabled scraper',
          priority: 1,
          enabled: true,
          factory: () => new MockScraper()
        },
        {
          name: 'disabled-scraper',
          description: 'Disabled scraper',
          priority: 2,
          enabled: false,
          factory: () => new MockScraper()
        },
        {
          name: 'invalid-scraper',
          description: 'Invalid scraper',
          priority: 3,
          enabled: true,
          dependencies: ['missing-dependency'],
          factory: () => new MockScraper()
        }
      ];

      scraperManager.registerScrapers(scraperDefinitions);

      const summary = scraperManager.getStatusSummary();

      expect(summary.total).toBe(3);
      expect(summary.enabled).toBe(2);
      expect(summary.disabled).toBe(1);
      expect(summary.valid).toBe(2);
      expect(summary.invalid).toBe(1);
      expect(summary.invalidScrapers).toHaveLength(1);
      expect(summary.invalidScrapers[0].name).toBe('invalid-scraper');
    });
  });
});
