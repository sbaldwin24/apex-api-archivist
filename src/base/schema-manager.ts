import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../database';
import { StructuredLogger } from '../structured-logger';

export interface SchemaConfig {
  name: string;
  file: string;
  dependencies?: string[];
  priority?: number;
}

export class SchemaManager {
  private logger: StructuredLogger;
  private schemas: Map<string, SchemaConfig> = new Map();
  
  constructor() {
    this.logger = new StructuredLogger('schema-manager');
    this.loadSchemaConfigurations();
  }

  /**
   * Load all schema configurations
   */
  private loadSchemaConfigurations(): void {
    const schemaConfigs: SchemaConfig[] = [
      // Core schema - highest priority
      { name: 'core', file: 'schema.sql', priority: 1 },
      
      // Feature schemas - medium priority
      { name: 'broadcast-metrics', file: 'broadcast-metrics-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'performance', file: 'performance-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'financial', file: 'financial-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'qualifying', file: 'qualifying-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'stages', file: 'stage-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'sponsors', file: 'sponsor-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'paint-schemes', file: 'paint-scheme-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'pit-stops', file: 'pit-stop-schema.sql', dependencies: ['core'], priority: 2 },
      { name: 'track-layouts', file: 'track-layouts-schema.sql', dependencies: ['core'], priority: 2 },
      
      // Advanced schemas - lowest priority
      { name: 'complete-roi', file: 'complete-roi-schema.sql', dependencies: ['core', 'financial', 'broadcast-metrics'], priority: 3 },
      { name: 'final-roi', file: 'final-roi-schema.sql', dependencies: ['core', 'complete-roi'], priority: 4 },
      { name: 'easy-targets', file: 'easy-targets-schema.sql', dependencies: ['core'], priority: 3 },
      { name: 'historical', file: 'historical-schema.sql', dependencies: ['core'], priority: 3 }
    ];

    for (const config of schemaConfigs) {
      this.schemas.set(config.name, config);
    }
  }

  /**
   * Setup a specific schema by name
   */
  async setupSchema(schemaName: string): Promise<void> {
    const config = this.schemas.get(schemaName);
    if (!config) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    // Setup dependencies first
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        await this.setupSchema(dep);
      }
    }

    await this.executeSchemaFile(config);
  }

  /**
   * Setup multiple schemas by names
   */
  async setupSchemas(schemaNames: string[]): Promise<void> {
    // Sort by dependencies and priority
    const sortedNames = this.sortSchemasByDependencies(schemaNames);
    
    for (const schemaName of sortedNames) {
      await this.setupSchema(schemaName);
    }
  }

  /**
   * Setup all schemas in dependency order
   */
  async setupAllSchemas(): Promise<void> {
    const allSchemaNames = Array.from(this.schemas.keys());
    await this.setupSchemas(allSchemaNames);
  }

  /**
   * Execute a schema file
   */
  private async executeSchemaFile(config: SchemaConfig): Promise<void> {
    const client = await pool.connect();
    
    try {
      this.logger.info(`Setting up schema: ${config.name}`, 'schema-setup');
      
      const schemaPath = join(process.cwd(), config.file);
      const schema = readFileSync(schemaPath, 'utf8');
      
      await client.query(schema);
      
      this.logger.info(`Schema '${config.name}' created successfully`, 'schema-setup');
    } catch (error: any) {
      this.logger.error(`Error creating schema '${config.name}'`, 'schema-setup', {
        file: config.file,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sort schemas by dependencies and priority
   */
  private sortSchemasByDependencies(schemaNames: string[]): string[] {
    const visited = new Set<string>();
    const sorted: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const config = this.schemas.get(name);
      if (!config) return;

      // Visit dependencies first
      if (config.dependencies) {
        for (const dep of config.dependencies) {
          if (schemaNames.includes(dep)) {
            visit(dep);
          }
        }
      }

      sorted.push(name);
    };

    // Sort by priority first, then visit
    const sortedByPriority = schemaNames.sort((a, b) => {
      const configA = this.schemas.get(a);
      const configB = this.schemas.get(b);
      return (configA?.priority || 999) - (configB?.priority || 999);
    });

    for (const name of sortedByPriority) {
      visit(name);
    }

    return sorted;
  }

  /**
   * Get schema configuration
   */
  getSchemaConfig(name: string): SchemaConfig | undefined {
    return this.schemas.get(name);
  }

  /**
   * List all available schemas
   */
  listSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate schema file exists
   */
  validateSchemaFile(config: SchemaConfig): boolean {
    try {
      const schemaPath = join(process.cwd(), config.file);
      readFileSync(schemaPath, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate all schema files exist
   */
  validateAllSchemaFiles(): { valid: string[], invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const [name, config] of this.schemas) {
      if (this.validateSchemaFile(config)) {
        valid.push(name);
      } else {
        invalid.push(name);
      }
    }

    return { valid, invalid };
  }
}

export default SchemaManager;
