import { ConfigManager } from '../../src/base/config-manager';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    
    // Reset singleton instance for clean testing
    (ConfigManager as any).instance = null;
  });

  describe('Configuration Loading', () => {
    it('should load default configuration values', () => {
      // In test environment, some values are set by .env.test
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.environment).toBe('test'); // Set by .env.test
      expect(config.logLevel).toBe('error'); // Set by .env.test
      expect(config.database.host).toBe('localhost');
      expect(config.database.port).toBe(5432);
      expect(config.api.port).toBe(3001); // Set by .env.test
    });

    it('should load configuration from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';
      process.env.DB_HOST = 'prod-db.example.com';
      process.env.DB_PORT = '5433';
      process.env.DB_USER = 'prod_user';
      process.env.DB_PASSWORD = 'prod_pass';
      process.env.DB_NAME = 'prod_db';
      process.env.API_PORT = '8080';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.environment).toBe('production');
      expect(config.logLevel).toBe('error');
      expect(config.database.host).toBe('prod-db.example.com');
      expect(config.database.port).toBe(5433);
      expect(config.database.user).toBe('prod_user');
      expect(config.database.password).toBe('prod_pass');
      expect(config.database.database).toBe('prod_db');
      expect(config.api.port).toBe(8080);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.DB_SSL = 'true';
      process.env.PROXY_ENABLED = 'true';
      process.env.ENABLE_CORS = 'false';
      process.env.INCREMENTAL = 'true';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.database.ssl).toBe(true);
      expect(config.proxy.enabled).toBe(true);
      expect(config.api.enableCors).toBe(false);
      expect(config.scraping.incremental).toBe(true);
    });

    it('should parse numeric environment variables correctly', () => {
      process.env.SCRAPE_YEAR = '2023';
      process.env.START_RACE = '10';
      process.env.END_RACE = '20';
      process.env.DB_MAX_CONNECTIONS = '50';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.scraping.year).toBe(2023);
      expect(config.scraping.startRace).toBe(10);
      expect(config.scraping.endRace).toBe(20);
      expect(config.database.maxConnections).toBe(50);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required database fields', () => {
      // Reset singleton first
      (ConfigManager as any).instance = null;
      
      // Store original values
      const originalHost = process.env.DB_HOST;
      const originalUser = process.env.DB_USER;
      const originalPassword = process.env.DB_PASSWORD;
      const originalName = process.env.DB_NAME;
      
      try {
        delete process.env.DB_HOST;
        delete process.env.DB_USER;
        delete process.env.DB_PASSWORD;
        delete process.env.DB_NAME;

        expect(() => ConfigManager.getInstance()).toThrow('Configuration validation failed');
      } finally {
        // Restore original values
        process.env.DB_HOST = originalHost;
        process.env.DB_USER = originalUser;
        process.env.DB_PASSWORD = originalPassword;
        process.env.DB_NAME = originalName;
        (ConfigManager as any).instance = null;
      }
    });

    it('should validate scraping year range', () => {
      (ConfigManager as any).instance = null;
      process.env.SCRAPE_YEAR = '1800'; // Too old

      expect(() => ConfigManager.getInstance()).toThrow(/Invalid scraping year/);

      (ConfigManager as any).instance = null;
      process.env.SCRAPE_YEAR = '2100'; // Too far in future
      expect(() => ConfigManager.getInstance()).toThrow(/Invalid scraping year/);
    });

    it('should validate race number ranges', () => {
      // Reset singleton and set valid DB config
      (ConfigManager as any).instance = null;
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_password';
      process.env.DB_NAME = 'test_db';
      
      process.env.START_RACE = '0'; // Below minimum

      expect(() => ConfigManager.getInstance()).toThrow(/Start race must be >= 1/);

      (ConfigManager as any).instance = null;
      process.env.START_RACE = '1';
      process.env.END_RACE = '100'; // Above maximum

      expect(() => ConfigManager.getInstance()).toThrow(/End race must be <= 50/);
    });

    it('should validate API port range', () => {
      (ConfigManager as any).instance = null;
      process.env.API_PORT = '0'; // Below minimum

      expect(() => ConfigManager.getInstance()).toThrow(/Invalid API port/);

      (ConfigManager as any).instance = null;
      process.env.API_PORT = '70000'; // Above maximum

      expect(() => ConfigManager.getInstance()).toThrow(/Invalid API port/);
    });

    it('should pass validation with valid configuration', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_NAME = 'test_db';
      process.env.SCRAPE_YEAR = '2024';
      process.env.API_PORT = '3000';

      expect(() => ConfigManager.getInstance()).not.toThrow();
    });
  });

  describe('Configuration Methods', () => {
    let configManager: ConfigManager;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.DB_HOST = 'test-host';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_NAME = 'test_db';
      
      configManager = ConfigManager.getInstance();
    });

    it('should return database configuration', () => {
      const dbConfig = configManager.getDatabaseConfig();
      
      expect(dbConfig.host).toBe('test-host');
      expect(dbConfig.user).toBe('test_user');
      expect(dbConfig.password).toBe('test_pass');
      expect(dbConfig.database).toBe('test_db');
    });

    it('should return scraping configuration', () => {
      process.env.SCRAPE_YEAR = '2023';
      process.env.INCREMENTAL = 'true';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      const scrapingConfig = newConfigManager.getScrapingConfig();
      
      expect(scrapingConfig.year).toBe(2023);
      expect(scrapingConfig.incremental).toBe(true);
    });

    it('should return API configuration', () => {
      process.env.API_PORT = '4000';
      process.env.ENABLE_CORS = 'false';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      const apiConfig = newConfigManager.getAPIConfig();
      
      expect(apiConfig.port).toBe(4000);
      expect(apiConfig.enableCors).toBe(false);
    });

    it('should return proxy configuration', () => {
      process.env.PROXY_ENABLED = 'true';
      process.env.PROXYMESH_USERNAME = 'testuser';
      process.env.PROXY_ENDPOINTS = 'proxy1.com,proxy2.com';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      const proxyConfig = newConfigManager.getProxyConfig();
      
      expect(proxyConfig.enabled).toBe(true);
      expect(proxyConfig.username).toBe('testuser');
      expect(proxyConfig.endpoints).toEqual(['proxy1.com', 'proxy2.com']);
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      expect(newConfigManager.isDevelopment()).toBe(true);
      expect(newConfigManager.isProduction()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      expect(newConfigManager.isDevelopment()).toBe(false);
      expect(newConfigManager.isProduction()).toBe(true);
    });

    it('should return log level', () => {
      process.env.LOG_LEVEL = 'debug';
      
      // Create new instance to pick up env changes
      (ConfigManager as any).instance = null;
      const newConfigManager = ConfigManager.getInstance();
      
      expect(newConfigManager.getLogLevel()).toBe('debug');
    });

    it('should return configuration summary', () => {
      const summary = configManager.getConfigSummary();
      
      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('database');
      expect(summary).toHaveProperty('scraping');
      expect(summary).toHaveProperty('proxy');
      expect(summary).toHaveProperty('api');
      
      // Should not expose sensitive information
      expect(summary.database).not.toHaveProperty('password');
      expect(summary.database).not.toHaveProperty('user');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_NAME = 'test_db';
      
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Updates (for testing)', () => {
    it('should allow configuration updates and re-validate', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_NAME = 'test_db';
      
      const configManager = ConfigManager.getInstance();
      
      // Update configuration
      expect(() => configManager.updateConfig({
        api: {
          ...configManager.getAPIConfig(),
          port: 8080
        }
      })).not.toThrow();
      
      expect(configManager.getAPIConfig().port).toBe(8080);
    });

    it('should validate configuration updates', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_USER = 'test_user';
      process.env.DB_PASSWORD = 'test_pass';
      process.env.DB_NAME = 'test_db';
      
      const configManager = ConfigManager.getInstance();
      
      // Invalid configuration update
      expect(() => configManager.updateConfig({
        api: {
          ...configManager.getAPIConfig(),
          port: -1 // Invalid port
        }
      })).toThrow();
    });
  });
});
