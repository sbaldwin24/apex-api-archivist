# 🏁 Apex Data API - Motorsports Data Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue)](#)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green)](#)
[![License](https://img.shields.io/badge/license-ISC-blue)](#)

**Apex Data API** is a comprehensive motorsports data acquisition and API server that
combines web scraping, GraphQL APIs, and PostgreSQL data storage. The system
handles historical racing data from multiple eras and series, providing both scraping
capabilities and API access to race results, driver statistics, team
information, and broadcast metrics.

## 🚀 Features

### Core Capabilities

- **🏎️ Motorsports Data Scraping**: Automated scraping of race results, driver stats,
  and broadcast metrics
- **📊 GraphQL API**: Comprehensive API with optimized queries and DataLoaders
- **🗄️ PostgreSQL Integration**: Advanced database pooling and migration system
- **🔒 Security & Validation**: Zod-based validation with comprehensive security
  middleware
- **⚡ Performance**: DataLoaders prevent N+1 queries, Redis caching, connection
  pooling
- **📈 Monitoring**: Health checks, performance metrics, structured logging
- **🧪 Testing**: Comprehensive test suites with Jest and custom motorsports data
  matchers

### Data Sources

- **Historical Results**: Pre-2000s through modern era (2024+)
- **Race Data**: Qualifying, practice, race results with detailed metrics
- **Driver Statistics**: Career stats, team affiliations, performance data
- **Broadcast Metrics**: TV coverage, sponsor visibility, ROI analysis
- **Financial Data**: Sponsorship deals, team budgets, revenue tracking
- **Performance Analytics**: Telemetry, pit stops, strategy analysis

## 📁 Project Structure

```
apex-api-archivist/
├── src/                           # Source code
│   ├── server.ts                  # Main API server (Express + Apollo)
│   ├── consolidated-scraper.ts    # Unified scraping orchestrator
│   ├── base/                      # Base classes and managers
│   │   ├── base-scraper.ts        # Abstract scraper foundation
│   │   ├── scraper-manager.ts     # Scraper orchestration
│   │   ├── config-manager.ts      # Configuration management
│   │   └── schema-manager.ts      # Database schema management
│   ├── database/                  # Database layer
│   │   └── advanced-pool.ts       # Connection pooling & monitoring
│   ├── middleware/                # Express middleware
│   │   ├── enhanced-validation.ts # Zod validation middleware
│   │   ├── security-middleware.ts # Security & rate limiting
│   │   ├── correlation-id.ts      # Request correlation
│   │   └── performance-monitoring.ts # Performance tracking
│   ├── validation/                # Schema validation
│   │   └── schemas.ts             # Zod validation schemas
│   ├── queue/                     # Background job processing
│   │   └── job-processor.ts       # Bull queue management
│   ├── cache/                     # Caching layer
│   │   └── redis-cache.ts         # Redis caching implementation
│   └── scrapers/                  # Individual scraper implementations
│       ├── performance-data-scraper.ts
│       └── broadcast-metrics-scraper.ts
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   ├── api/                       # API endpoint tests
│   └── database/                  # Database operation tests
├── migrations/                    # Database migrations & seeds
├── docs/                          # Documentation
│   ├── CLEANUP_REPORT.md          # Recent codebase cleanup
│   ├── ZOD_MIGRATION_COMPLETE.md  # Validation migration report
│   └── SECURITY_AUDIT.md          # Security review
└── scripts/                       # Deployment & utility scripts
    └── deploy-advanced-scrapers.sh
```

## 🛠️ Prerequisites

- **Node.js** 24+
- **PostgreSQL** 17+
- **Redis** 6+ (for caching and job queues)
- **pnpm** (preferred package manager)
- **Docker** & **Docker Compose** (for containerized development)

## 🚀 Quick Start

### 1. Clone and Install

```bash
gh repo clone sbaldwin24/apex-api-archivist
cd apex-api-archivist
pnpm install
```

### 2. Environment Setup

Copy the example environment files:

```bash
cp .env.development.example .env
cp .env.production.example .env.production
```

Update `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=apex_data

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Security
JWT_SECRET=your-256-bit-jwt-secret-key
API_KEY_SECRET=your-api-key-encryption-secret
```

### 3. Database Setup

```bash
# Run migrations
pnpm run migrate:up

# Seed with initial data (optional)
pnpm run seed:run

# Check status
pnpm run migrate:status
```

### 4. Development Server

```bash
# Start API development server
pnpm run dev:api

# Or build and start production server
pnpm run build
pnpm run start:api
```

The API will be available at `http://localhost:3000`

- GraphQL Playground: `http://localhost:3000/graphql`
- Health Check: `http://localhost:3000/health`
- API Documentation: `http://localhost:3000/docs`

## 📊 Data Scraping

### Consolidated Scraper

The modern scraping system uses a unified orchestrator:

```bash
# List available scrapers
pnpm run scrape:list

# Run all enabled scrapers
pnpm run scrape

# Run specific scraper
pnpm run scrape broadcast-metrics

# Run in parallel with concurrency control
pnpm run scrape:parallel --concurrency 3

# Validate environment and setup
pnpm run scrape:validate

# Setup database schemas
pnpm run scrape:setup-schemas
```

### Available Scrapers

- **`broadcast-metrics`**: TV coverage, sponsor visibility, ROI data
- **`performance-data`**: Telemetry, lap times, pit stop analysis
- **`financial-data`**: Sponsorship deals, team budgets
- **`complete-roi`**: Advanced ROI analysis with predictive modeling

### Configuration

Scrapers are configured via environment variables:

```env
# Enable/disable specific scrapers
ENABLE_BROADCAST_SCRAPER=true
ENABLE_PERFORMANCE_SCRAPER=true
ENABLE_FINANCIAL_SCRAPER=false

# Scraping parameters
SCRAPE_CONCURRENCY=3
SCRAPE_DELAY=2000
SCRAPE_TIMEOUT=30000

# Proxy configuration (optional)
ENABLE_PROXY_ROTATION=false
PROXY_LIST_URL=https://proxy-service.com/list
```

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm run test

# Run specific test categories
pnpm run test:unit       # Base classes and utilities
pnpm run test:api        # API endpoint tests
pnpm run test:integration # Integration tests
pnpm run test:database   # Database operation tests

# Coverage reporting
pnpm run test:coverage
pnpm run test:coverage:open  # Opens HTML report

# Development
pnpm run test:watch      # Watch mode
pnpm run test:debug      # Debug mode
```

### Test Features

- **Custom NASCAR matchers**: `toBeValidRaceResult()`, `toHaveValidDriverData()`
- **Database isolation**: Each test runs with clean database state
- **API testing**: Supertest integration for endpoint testing
- **Mock factories**: Generate realistic NASCAR test data
- **Coverage thresholds**: 40% minimum coverage enforced

## 🔒 Security

### Validation & Security Middleware

- **Zod validation**: Type-safe schema validation throughout
- **Rate limiting**: Configurable per-endpoint rate limits
- **Security headers**: Helmet.js integration
- **Input sanitization**: XSS and injection protection
- **CORS configuration**: Configurable origin whitelist

### Environment Security

- **`.gitignore` enhanced**: Comprehensive secret protection
- **Environment templates**: Safe `.example` files for setup
- **Secret management**: Environment variable based configuration
- **Security audit**: Regular vulnerability scanning

### Security Tools

```bash
# Verify .gitignore patterns
./verify-gitignore.sh

# Run security linting
pnpm run lint:security

# Check for vulnerabilities
pnpm run audit
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

```bash
# Build application
pnpm run build

# Run database migrations
pnpm run migrate:up

# Start production server
NODE_ENV=production pnpm run start:api
```

### Advanced Scrapers Deployment

Use the automated deployment script:

```bash
# Full deployment with validation
./scripts/deploy-advanced-scrapers.sh deploy

# Validate environment only
./scripts/deploy-advanced-scrapers.sh validate

# Monitor deployment
./scripts/deploy-advanced-scrapers.sh monitor

# Rollback if needed
./scripts/deploy-advanced-scrapers.sh rollback
```

## 📈 Monitoring & Health

### Health Endpoints

- **Basic health**: `GET /health`
- **Detailed health**: `GET /health/detailed`
- **Performance metrics**: `GET /metrics/performance`
- **Database metrics**: `GET /metrics/database`
- **Queue status**: `GET /admin/queues`

### Logging

Structured logging with correlation IDs:

```javascript
/** Automatic request correlation */
logger.info('Processing race data', 'scraper', {
  raceId: 'daytona-500-2024',
  driverCount: 40,
  correlationId: 'auto-generated'
});
```

### Performance

- **Connection pooling**: Advanced PostgreSQL connection management
- **DataLoaders**: N+1 query prevention for GraphQL
- **Redis caching**: Configurable TTL and cache strategies
- **Query optimization**: Indexed queries and performance monitoring

## 🔧 Development

### Code Quality

```bash
# Linting and formatting
pnpm run lint              # Fix linting issues
pnpm run lint:check        # Check without fixing
pnpm run format            # Format code
pnpm run format:check      # Check formatting
```

### Database Management

```bash
# Migrations
pnpm run migrate:create    # Create new migration
pnpm run migrate:up        # Apply migrations
pnpm run migrate:down      # Rollback migrations
pnpm run migrate:status    # Check migration status
pnpm run migrate:reset     # Reset database (careful!)

# Seeds
pnpm run seed:run          # Run all seeders
pnpm run seed:status       # Check seed status
pnpm run seed:reset        # Reset seed data
```

### Redis Management

```bash
pnpm run redis:status      # Check Redis status
pnpm run redis:clear-cache # Clear application cache
pnpm run redis:monitor     # Monitor Redis activity
```

## 📚 Documentation

### API Documentation

- **GraphQL Playground**: Available at `/graphql` in development
- **REST API Docs**: Auto-generated Swagger UI at `/docs`
- **Schema Documentation**: Generated from code comments

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write** tests for your changes
4. **Ensure** all tests pass (`pnpm test`)
5. **Lint** your code (`pnpm lint`)
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### Development Guidelines

- **TypeScript**: Strict typing required
- **Testing**: Comprehensive test coverage
- **Validation**: Use Zod for all schema validation
- **Logging**: Structured logging with correlation IDs
- **Security**: Follow security best practices
- **Documentation**: Update docs with significant changes

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file
for details.

## 🏁 NASCAR Data Sources

### Supported Series

- **Cup Series**: Top-level NASCAR competition
- **Xfinity Series**: Second-tier series
- **Truck Series**: NASCAR Camping World Truck Series

### Historical Coverage

- **Classic Era**: Pre-2000s NASCAR data
- **Pre-Playoff Era**: 2000-2013 season data
- **Modern Era**: 2014+ with playoffs and stage racing
- **Current Season**: Real-time 2024+ data

### Data Types

- **Race Results**: Finish positions, points, laps led
- **Qualifying**: Grid positions, speeds, lap times
- **Practice**: Session times, speed charts
- **Standings**: Points standings throughout season
- **Driver Stats**: Career statistics and achievements
- **Team Data**: Manufacturer, crew chief, team affiliations
- **Track Information**: Layout, banking, surface details
- **Weather**: Race day conditions and impact

---

**Built with ❤️ for NASCAR fans and data enthusiasts**

_For support or questions, please open an issue on GitHub._
