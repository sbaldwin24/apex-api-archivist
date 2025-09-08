# NASCAR Data API - Development Makefile
# Provides consistent commands across different environments

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Project configuration
PROJECT_NAME := apex-data-api
NODE_VERSION := 24
PNPM_VERSION := 8

# Default target
.DEFAULT_GOAL := help

##@ Development Commands

.PHONY: setup
setup: ## Initial project setup with dependencies and database
	@echo "$(BLUE)Setting up $(PROJECT_NAME)...$(RESET)"
	@command -v pnpm >/dev/null 2>&1 || { echo "$(RED)pnpm is required. Install it first.$(RESET)"; exit 1; }
	pnpm install
	@if [ -f ".env.example" ]; then \
		cp .env.example .env.development && \
		echo "$(YELLOW)Created .env.development - please configure it$(RESET)"; \
	fi
	$(MAKE) db-setup
	@echo "$(GREEN)Setup complete! Run 'make dev' to start development$(RESET)"

.PHONY: dev
dev: ## Start development server with hot reload
	@echo "$(BLUE)Starting development server...$(RESET)"
	pnpm dev:api

.PHONY: build
build: ## Build TypeScript to JavaScript
	@echo "$(BLUE)Building application...$(RESET)"
	pnpm build

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	@echo "$(BLUE)Cleaning build artifacts...$(RESET)"
	rm -rf dist/
	rm -rf node_modules/
	rm -rf coverage/

##@ Code Quality

.PHONY: lint
lint: ## Run linter and auto-fix issues
	@echo "$(BLUE)Running linter...$(RESET)"
	pnpm lint

.PHONY: lint-check
lint-check: ## Check linting without fixing
	@echo "$(BLUE)Checking linting...$(RESET)"
	pnpm lint:check

.PHONY: format
format: ## Format all code files
	@echo "$(BLUE)Formatting code...$(RESET)"
	pnpm format

.PHONY: format-check
format-check: ## Check formatting without fixing
	@echo "$(BLUE)Checking formatting...$(RESET)"
	pnpm format:check

.PHONY: type-check
type-check: ## Run TypeScript type checking
	@echo "$(BLUE)Running type checking...$(RESET)"
	pnpm exec tsc --noEmit

.PHONY: quality
quality: lint format type-check ## Run all code quality checks
	@echo "$(GREEN)All quality checks passed!$(RESET)"

##@ Testing

.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(RESET)"
	pnpm test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(RESET)"
	pnpm test:watch

.PHONY: test-coverage
test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(RESET)"
	pnpm test:coverage

.PHONY: test-unit
test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(RESET)"
	pnpm test:unit

.PHONY: test-api
test-api: ## Run API tests only
	@echo "$(BLUE)Running API tests...$(RESET)"
	pnpm test:api

.PHONY: test-integration
test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(RESET)"
	pnpm test:integration

.PHONY: test-ci
test-ci: ## Run tests optimized for CI
	@echo "$(BLUE)Running CI tests...$(RESET)"
	pnpm test:ci

##@ Database Operations

.PHONY: db-setup
db-setup: ## Setup database with initial migrations
	@echo "$(BLUE)Setting up database...$(RESET)"
	pnpm migrate:up

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(RESET)"
	pnpm migrate:up

.PHONY: db-rollback
db-rollback: ## Rollback last migration
	@echo "$(YELLOW)Rolling back database migration...$(RESET)"
	pnpm migrate:down

.PHONY: db-status
db-status: ## Check migration status
	@echo "$(BLUE)Checking migration status...$(RESET)"
	pnpm migrate:status

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys all data)
	@echo "$(RED)WARNING: This will destroy all database data!$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	pnpm migrate:reset

.PHONY: db-seed
db-seed: ## Run database seeds
	@echo "$(BLUE)Running database seeds...$(RESET)"
	pnpm seed:run

##@ Data Scraping

.PHONY: scrape
scrape: ## Run main consolidated scraper
	@echo "$(BLUE)Running scraper...$(RESET)"
	pnpm scrape

.PHONY: scrape-list
scrape-list: ## List available scrapers
	@echo "$(BLUE)Available scrapers:$(RESET)"
	pnpm scrape:list

.PHONY: scrape-validate
scrape-validate: ## Validate scraper setup
	@echo "$(BLUE)Validating scraper setup...$(RESET)"
	pnpm scrape:validate

.PHONY: scrape-broadcast
scrape-broadcast: ## Run broadcast metrics scraper
	@echo "$(BLUE)Running broadcast metrics scraper...$(RESET)"
	pnpm scrape:broadcast

.PHONY: scrape-parallel
scrape-parallel: ## Run scrapers in parallel
	@echo "$(BLUE)Running scrapers in parallel...$(RESET)"
	pnpm scrape:parallel

##@ Docker Operations

.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(RESET)"
	docker build -t $(PROJECT_NAME):latest .

.PHONY: docker-dev
docker-dev: ## Start development environment with Docker Compose
	@echo "$(BLUE)Starting development environment...$(RESET)"
	docker compose -f docker-compose.dev.yml up -d

.PHONY: docker-prod
docker-prod: ## Start production environment with Docker Compose
	@echo "$(BLUE)Starting production environment...$(RESET)"
	docker compose -f docker-compose.prod.yml up -d

.PHONY: docker-stop
docker-stop: ## Stop Docker containers
	@echo "$(BLUE)Stopping Docker containers...$(RESET)"
	docker compose down

.PHONY: docker-logs
docker-logs: ## Show Docker container logs
	docker compose logs -f

##@ Production Deployment

.PHONY: deploy-staging
deploy-staging: ## Deploy to staging environment
	@echo "$(BLUE)Deploying to staging...$(RESET)"
	./scripts/deploy-production.sh deploy staging

.PHONY: deploy-prod
deploy-prod: ## Deploy to production environment
	@echo "$(YELLOW)Deploying to production...$(RESET)"
	./scripts/deploy-production.sh deploy production

.PHONY: rollback
rollback: ## Rollback production deployment
	@echo "$(YELLOW)Rolling back production deployment...$(RESET)"
	./scripts/deploy-production.sh rollback

.PHONY: status
status: ## Check production service status
	@echo "$(BLUE)Checking service status...$(RESET)"
	./scripts/deploy-production.sh status

##@ Monitoring and Maintenance

.PHONY: health-check
health-check: ## Check application health
	@echo "$(BLUE)Checking application health...$(RESET)"
	@curl -f http://localhost:3000/health || echo "$(RED)Health check failed$(RESET)"

.PHONY: backup
backup: ## Create manual backup
	@echo "$(BLUE)Creating backup...$(RESET)"
	./scripts/deploy-production.sh backup

.PHONY: logs
logs: ## Show application logs
	@echo "$(BLUE)Showing application logs...$(RESET)"
	pnpm start:api 2>&1 | tail -100

##@ Utilities

.PHONY: install
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	pnpm install

.PHONY: update
update: ## Update dependencies
	@echo "$(BLUE)Updating dependencies...$(RESET)"
	pnpm update

.PHONY: audit
audit: ## Run security audit
	@echo "$(BLUE)Running security audit...$(RESET)"
	pnpm audit

.PHONY: outdated
outdated: ## Check for outdated dependencies
	@echo "$(BLUE)Checking for outdated dependencies...$(RESET)"
	pnpm outdated

.PHONY: pre-commit
pre-commit: quality test-unit ## Run pre-commit checks
	@echo "$(GREEN)Pre-commit checks passed!$(RESET)"

.PHONY: ci
ci: quality test-ci ## Run full CI pipeline locally
	@echo "$(GREEN)CI pipeline completed successfully!$(RESET)"

##@ Help

.PHONY: help
help: ## Display this help message
	@echo "$(BLUE)$(PROJECT_NAME) Development Commands$(RESET)\n"
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(BLUE)<target>$(RESET)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(BLUE)%-20s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: info
info: ## Show project information
	@echo "$(BLUE)Project Information:$(RESET)"
	@echo "  Name:          $(PROJECT_NAME)"
	@echo "  Node Version:  $(NODE_VERSION)"
	@echo "  PNPM Version:  $(PNPM_VERSION)"
	@echo "  Directory:     $$(pwd)"
	@echo "  Git Branch:    $$(git branch --show-current 2>/dev/null || echo 'unknown')"
	@echo "  Git Commit:    $$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
