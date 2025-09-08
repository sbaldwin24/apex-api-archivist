import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Global Jest setup - runs once before all tests
 */
export default async (): Promise<void> => {
  // Load test environment variables
  config({ 
    path: resolve(process.cwd(), '.env.test'),
    override: true 
  });

  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Set timezone to UTC for consistent test results
  process.env.TZ = 'UTC';
  
  // Disable external network requests during tests
  process.env.MOCK_EXTERNAL_APIS = 'true';
  
  console.log('🧪 Global test setup complete');
  console.log(`📦 Test environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Test database: ${process.env.DB_NAME}`);
};
