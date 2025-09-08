/**
 * Global Jest teardown - runs once after all tests
 */
export default async (): Promise<void> => {
  // Clean up any global resources if needed
  console.log('🧹 Global test teardown complete');
};
