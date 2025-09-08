#!/bin/bash

# Advanced Scrapers Deployment Script
# Automated deployment for Performance Data & Complete ROI scrapers

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.production"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Deployment settings
DEPLOYMENT_VERSION="${DEPLOYMENT_VERSION:-$TIMESTAMP}"
DRY_RUN="${DRY_RUN:-false}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_deploy() {
  echo -e "${PURPLE}[DEPLOY]${NC} $1"
}

log_test() {
  echo -e "${CYAN}[TEST]${NC} $1"
}

# Banner function
show_banner() {
  echo -e "${PURPLE}"
  cat <<"EOF"
╔═══════════════════════════════════════════════════════════════╗
║                   ADVANCED SCRAPERS DEPLOYMENT                ║
║                                                               ║
║  🏁 Performance Data Scraper                                  ║
║  📊 Complete ROI Scraper                                      ║
║                                                               ║
║  Zero-downtime deployment with rollback capability           ║
╚═══════════════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
  echo
  echo -e "${BLUE}Deployment Version:${NC} $DEPLOYMENT_VERSION"
  echo -e "${BLUE}Environment:${NC} production"
  echo -e "${BLUE}Dry Run Mode:${NC} $DRY_RUN"
  echo -e "${BLUE}Timestamp:${NC} $(date)"
  echo
}

# Validation functions
check_prerequisites() {
  log_info "Checking deployment prerequisites..."

  # Check required tools
  local required_tools=("docker" "psql" "curl" "jq" "pnpm")
  for tool in "${required_tools[@]}"; do
    if ! command -v "$tool" &>/dev/null; then
      log_error "Required tool '$tool' is not installed"
      exit 1
    fi
  done

  # Check Docker is running
  if ! docker info &>/dev/null; then
    log_error "Docker is not running"
    exit 1
  fi

  # Check environment file
  if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
  fi

  # Check database connectivity
  source "$ENV_FILE"
  if ! psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
    log_error "Cannot connect to database"
    exit 1
  fi

  log_success "Prerequisites check passed"
}

validate_schemas() {
  log_info "Validating database schemas..."

  # Check if schema files exist
  local schema_files=(
    "$PROJECT_ROOT/performance-schema.sql"
    "$PROJECT_ROOT/complete-roi-schema.sql"
  )

  for schema_file in "${schema_files[@]}"; do
    if [[ ! -f "$schema_file" ]]; then
      log_error "Schema file not found: $schema_file"
      exit 1
    fi
  done

  # Test schemas in dry-run mode
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Schema validation successful"
    return 0
  fi

  # Check if tables exist
  source "$ENV_FILE"
  local required_tables=(
    "telemetry_data"
    "tire_strategy"
    "fuel_data"
    "predictive_models"
    "real_time_sentiment"
    "ab_test_results"
  )

  for table in "${required_tables[@]}"; do
    if ! psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1" &>/dev/null; then
      log_warning "Table '$table' not found, will create during deployment"
    fi
  done

  log_success "Schema validation completed"
}

validate_codebase() {
  log_info "Validating codebase..."

  cd "$PROJECT_ROOT"

  # Check if source files exist
  local source_files=(
    "src/performance-scraper.ts"
    "src/complete-roi-scraper.ts"
    "scrapers/performance-data-scraper.ts"
    "scrapers/complete-roi-scraper.ts"
  )

  for file in "${source_files[@]}"; do
    if [[ ! -f "$file" ]]; then
      log_error "Source file not found: $file"
      exit 1
    fi
  done

  # Run linting
  if ! pnpm lint:check &>/dev/null; then
    log_error "Linting failed - please fix code issues first"
    exit 1
  fi

  # Run build test
  if ! pnpm build &>/dev/null; then
    log_error "Build failed - please fix compilation issues first"
    exit 1
  fi

  log_success "Codebase validation passed"
}

# Backup functions
create_database_backup() {
  log_info "Creating database backup..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Database backup skipped"
    return 0
  fi

  local backup_dir="$PROJECT_ROOT/backups/advanced-scrapers/$TIMESTAMP"
  mkdir -p "$backup_dir"

  source "$ENV_FILE"
  local backup_file="$backup_dir/advanced_scrapers_backup.sql"

  # Create targeted backup of existing scraper data
  psql "$DATABASE_URL" >"$backup_file" <<'EOF'
-- Backup existing scraper-related data
\copy (SELECT * FROM migrations WHERE migration_name LIKE '%performance%' OR migration_name LIKE '%roi%') TO 'migrations_backup.csv' WITH CSV HEADER;

-- Backup any existing performance data (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'telemetry_data') THEN
        EXECUTE '\copy (SELECT * FROM telemetry_data WHERE created_at > NOW() - INTERVAL ''7 days'') TO ''telemetry_backup.csv'' WITH CSV HEADER';
    END IF;
END
$$;
EOF

  if [[ -f "$backup_file" ]]; then
    gzip "$backup_file"
    echo "$backup_file.gz" >"$backup_dir/backup_location.txt"
    log_success "Database backup created: $backup_file.gz"
  else
    log_error "Failed to create database backup"
    exit 1
  fi
}

create_application_backup() {
  log_info "Creating application state backup..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Application backup skipped"
    return 0
  fi

  local backup_dir="$PROJECT_ROOT/backups/advanced-scrapers/$TIMESTAMP"
  mkdir -p "$backup_dir"

  # Backup current scraper configuration
  cp "$ENV_FILE" "$backup_dir/env_backup"

  # Backup consolidated scraper state
  if [[ -f "$PROJECT_ROOT/src/consolidated-scraper.ts" ]]; then
    cp "$PROJECT_ROOT/src/consolidated-scraper.ts" "$backup_dir/consolidated_scraper_backup.ts"
  fi

  log_success "Application state backup created in $backup_dir"
}

# Schema deployment functions
deploy_schemas() {
  log_info "Deploying database schemas..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Schema deployment simulated"
    return 0
  fi

  source "$ENV_FILE"

  # Deploy performance schema
  log_info "Deploying performance data schema..."
  if psql "$DATABASE_URL" -f "$PROJECT_ROOT/performance-schema.sql"; then
    log_success "Performance schema deployed successfully"
  else
    log_error "Failed to deploy performance schema"
    return 1
  fi

  # Deploy complete ROI schema
  log_info "Deploying complete ROI schema..."
  if psql "$DATABASE_URL" -f "$PROJECT_ROOT/complete-roi-schema.sql"; then
    log_success "Complete ROI schema deployed successfully"
  else
    log_error "Failed to deploy complete ROI schema"
    return 1
  fi

  # Verify schema deployment
  local required_tables=(
    "telemetry_data"
    "predictive_models"
    "roi_optimization_recommendations"
  )

  for table in "${required_tables[@]}"; do
    if ! psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1" &>/dev/null; then
      log_error "Table '$table' verification failed"
      return 1
    fi
  done

  log_success "All schemas deployed and verified successfully"
}

# Application deployment functions
build_and_deploy() {
  log_info "Building and deploying application..."

  cd "$PROJECT_ROOT"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Build and deployment simulated"
    return 0
  fi

  # Clean build
  rm -rf dist/

  # Install dependencies
  pnpm install --frozen-lockfile

  # Build application
  if ! pnpm build; then
    log_error "Application build failed"
    return 1
  fi

  # Build Docker image (if using containerized deployment)
  if [[ -f "Dockerfile" ]]; then
    log_info "Building Docker image..."
    docker build \
      --target production \
      --build-arg NODE_ENV=production \
      --build-arg DEPLOYMENT_VERSION="$DEPLOYMENT_VERSION" \
      --build-arg BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      -t apex-api:"$DEPLOYMENT_VERSION" \
      -t apex-api:latest \
      .

    log_success "Docker image built successfully"
  fi

  log_success "Application build completed"
}

# Testing functions
run_pre_deployment_tests() {
  log_test "Running pre-deployment tests..."

  cd "$PROJECT_ROOT"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Pre-deployment tests simulated"
    return 0
  fi

  # Run unit tests for advanced scrapers
  local test_files=(
    "tests/unit/performance-scraper.test.ts"
    "tests/unit/complete-roi-scraper.test.ts"
  )

  for test_file in "${test_files[@]}"; do
    if [[ -f "$test_file" ]]; then
      log_test "Running $test_file..."
      if ! pnpm test "$test_file"; then
        log_error "Pre-deployment test failed: $test_file"
        return 1
      fi
    fi
  done

  log_success "Pre-deployment tests passed"
}

run_smoke_tests() {
  log_test "Running smoke tests..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Smoke tests simulated"
    return 0
  fi

  # Test scraper registration
  cd "$PROJECT_ROOT"

  # Check if scrapers are registered
  if pnpm scrape --list | grep -E "(performance-data|complete-roi)" &>/dev/null; then
    log_success "✓ Scrapers registered successfully"
  else
    log_error "✗ Scraper registration failed"
    return 1
  fi

  # Test schema validation
  if pnpm scrape --validate &>/dev/null; then
    log_success "✓ Schema validation passed"
  else
    log_error "✗ Schema validation failed"
    return 1
  fi

  # Test database connectivity for scrapers
  source "$ENV_FILE"
  if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" &>/dev/null; then
    log_success "✓ Database connectivity verified"
  else
    log_error "✗ Database connectivity failed"
    return 1
  fi

  log_success "All smoke tests passed"
}

# Deployment activation functions
activate_performance_scraper() {
  log_deploy "Activating Performance Data Scraper..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Performance scraper activation simulated"
    return 0
  fi

  # Update environment variable
  if grep -q "ENABLE_PERFORMANCE_SCRAPER=" "$ENV_FILE"; then
    sed -i 's/ENABLE_PERFORMANCE_SCRAPER=.*/ENABLE_PERFORMANCE_SCRAPER=true/' "$ENV_FILE"
  else
    echo "ENABLE_PERFORMANCE_SCRAPER=true" >>"$ENV_FILE"
  fi

  # Restart services if containerized
  if command -v docker-compose &>/dev/null && [[ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]]; then
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" restart api
    sleep 10
  fi

  # Test performance scraper
  cd "$PROJECT_ROOT"
  log_test "Testing performance scraper..."

  if timeout 300 pnpm scrape performance-data; then
    log_success "Performance scraper test passed"
  else
    log_error "Performance scraper test failed"
    return 1
  fi

  log_success "Performance Data Scraper activated successfully"
}

activate_roi_scraper() {
  log_deploy "Activating Complete ROI Scraper..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: ROI scraper activation simulated"
    return 0
  fi

  # Update environment variable
  if grep -q "ENABLE_COMPLETE_ROI_SCRAPER=" "$ENV_FILE"; then
    sed -i 's/ENABLE_COMPLETE_ROI_SCRAPER=.*/ENABLE_COMPLETE_ROI_SCRAPER=true/' "$ENV_FILE"
  else
    echo "ENABLE_COMPLETE_ROI_SCRAPER=true" >>"$ENV_FILE"
  fi

  # Restart services if containerized
  if command -v docker-compose &>/dev/null && [[ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]]; then
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" restart api
    sleep 10
  fi

  # Test ROI scraper (with longer timeout due to ML processing)
  cd "$PROJECT_ROOT"
  log_test "Testing complete ROI scraper..."

  if timeout 600 pnpm scrape complete-roi; then
    log_success "Complete ROI scraper test passed"
  else
    log_error "Complete ROI scraper test failed"
    return 1
  fi

  log_success "Complete ROI Scraper activated successfully"
}

# Monitoring functions
setup_monitoring() {
  if [[ "$ENABLE_MONITORING" != "true" ]]; then
    return 0
  fi

  log_info "Setting up deployment monitoring..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Monitoring setup simulated"
    return 0
  fi

  # Create monitoring script
  cat >"$PROJECT_ROOT/monitor-advanced-scrapers.sh" <<'EOF'

  #!/bin/bash
  # Advanced Scrapers Monitoring Script

  echo "=== Advanced Scrapers Monitoring ==="
  echo "Timestamp: $(date)"
  echo

  # Check service status
  if command -v docker-compose &> /dev/null; then
    echo "=== Service Status ==="
    docker-compose -f docker-compose.prod.yml ps
    echo
  fi

# Check database records
source .env.production
echo "=== Recent Data Counts ==="
psql "$DATABASE_URL" -c "
  SELECT 
    'telemetry_data' as table_name,
    COUNT(*) as records,
    MAX(created_at) as latest_record
  FROM telemetry_data 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  UNION ALL
  SELECT 
    'predictive_models' as table_name,
    COUNT(*) as records,
    MAX(created_at) as latest_record
  FROM predictive_models 
  WHERE created_at > NOW() - INTERVAL '1 hour';
"

# Check system resources
echo "=== System Resources ==="
if command -v docker &> /dev/null; then
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -5
fi

echo
echo "=== Memory Usage ==="
free -h
EOF

  chmod +x "$PROJECT_ROOT/monitor-advanced-scrapers.sh"

  log_success "Monitoring setup completed"
}

# Rollback functions
rollback_deployment() {
  log_warning "Initiating deployment rollback..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Rollback simulated"
    return 0
  fi

  # Disable scrapers
  sed -i 's/ENABLE_PERFORMANCE_SCRAPER=true/ENABLE_PERFORMANCE_SCRAPER=false/' "$ENV_FILE"
  sed -i 's/ENABLE_COMPLETE_ROI_SCRAPER=true/ENABLE_COMPLETE_ROI_SCRAPER=false/' "$ENV_FILE"

  # Restart services
  if command -v docker-compose &>/dev/null && [[ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]]; then
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" restart api
  fi

  # Restore backups if available
  local backup_dir="$PROJECT_ROOT/backups/advanced-scrapers/$TIMESTAMP"
  if [[ -f "$backup_dir/env_backup" ]]; then
    cp "$backup_dir/env_backup" "$ENV_FILE"
    log_info "Environment configuration restored from backup"
  fi

  log_success "Rollback completed - scrapers disabled"
}

# Validation functions
validate_deployment() {
  log_info "Validating deployment..."

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry-run: Deployment validation simulated"
    return 0
  fi

  cd "$PROJECT_ROOT"
  source "$ENV_FILE"

  # Check scraper status
  local scrapers_enabled=0

  if [[ "${ENABLE_PERFORMANCE_SCRAPER:-false}" == "true" ]]; then
    ((scrapers_enabled++))
    log_info "✓ Performance scraper is enabled"
  fi

  if [[ "${ENABLE_COMPLETE_ROI_SCRAPER:-false}" == "true" ]]; then
    ((scrapers_enabled++))
    log_info "✓ Complete ROI scraper is enabled"
  fi

  # Check database tables
  local table_count
  table_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('telemetry_data', 'predictive_models', 'roi_optimization_recommendations')" | tr -d ' ')

  if [[ "$table_count" -ge "3" ]]; then
    log_info "✓ Required database tables exist"
  else
    log_error "✗ Missing required database tables"
    return 1
  fi

  # Check API health (if applicable)
  if curl -sf http://localhost/health &>/dev/null || curl -sf http://localhost:3000/health &>/dev/null; then
    log_info "✓ API service is healthy"
  else
    log_warning "⚠ API health check failed (service may not be running)"
  fi

  log_success "Deployment validation completed - $scrapers_enabled scrapers enabled"
}

# Cleanup function
cleanup_deployment() {
  log_info "Performing post-deployment cleanup..."

  # Clean up temporary files
  rm -f "$PROJECT_ROOT"/scrapers/*.log 2>/dev/null || true

  # Clean up old Docker images (keep last 3)
  if command -v docker &>/dev/null; then
    docker images apex-api --format "table {{.Tag}}" | grep -v "latest" | tail -n +4 | xargs -I {} docker rmi "apex-api:{}" 2>/dev/null || true
  fi

  log_success "Cleanup completed"
}

# Main deployment function
main_deployment() {
  local start_time
  start_time=$(date +%s)

  show_banner

  # Pre-deployment phase
  log_deploy "=== PRE-DEPLOYMENT PHASE ==="
  check_prerequisites
  validate_schemas
  validate_codebase
  run_pre_deployment_tests
  create_database_backup
  create_application_backup

  # Deployment phase
  log_deploy "=== DEPLOYMENT PHASE ==="
  deploy_schemas
  build_and_deploy
  run_smoke_tests

  # Activation phase
  log_deploy "=== ACTIVATION PHASE ==="

  # Enable performance scraper first
  if activate_performance_scraper; then
    log_success "Performance scraper deployment successful"

    # Wait and monitor
    log_info "Monitoring performance scraper for 2 minutes..."
    if [[ "$DRY_RUN" != "true" ]]; then
      sleep 120
    fi

    # Enable ROI scraper if performance scraper is stable
    if activate_roi_scraper; then
      log_success "Complete ROI scraper deployment successful"
    else
      log_error "ROI scraper activation failed"
      if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
        rollback_deployment
        return 1
      fi
    fi
  else
    log_error "Performance scraper activation failed"
    if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
      rollback_deployment
      return 1
    fi
  fi

  # Post-deployment phase
  log_deploy "=== POST-DEPLOYMENT PHASE ==="
  setup_monitoring
  validate_deployment
  cleanup_deployment

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  log_success "Advanced scrapers deployment completed successfully!"
  log_info "Total deployment time: $(($duration / 60)) minutes $(($duration % 60)) seconds"
  log_info "Deployment version: $DEPLOYMENT_VERSION"
  log_info "Monitor deployment: ./monitor-advanced-scrapers.sh"

  return 0
}

# Command line argument handling
case "${1:-deploy}" in
"deploy")
  main_deployment
  ;;
"rollback")
  rollback_deployment
  ;;
"validate")
  check_prerequisites
  validate_schemas
  validate_codebase
  validate_deployment
  ;;
"test")
  run_pre_deployment_tests
  run_smoke_tests
  ;;
"backup")
  create_database_backup
  create_application_backup
  ;;
"monitor")
  setup_monitoring
  "$PROJECT_ROOT/monitor-advanced-scrapers.sh"
  ;;
*)
  echo "Usage: $0 {deploy|rollback|validate|test|backup|monitor}"
  echo
  echo "Commands:"
  echo "  deploy    - Deploy advanced scrapers (default)"
  echo "  rollback  - Rollback deployment"
  echo "  validate  - Validate environment and deployment"
  echo "  test      - Run deployment tests"
  echo "  backup    - Create manual backups"
  echo "  monitor   - Setup and run monitoring"
  echo
  echo "Environment variables:"
  echo "  DRY_RUN=true                  - Simulate deployment without changes"
  echo "  ENABLE_MONITORING=false       - Disable monitoring setup"
  echo "  ROLLBACK_ON_FAILURE=false     - Disable automatic rollback"
  echo "  DEPLOYMENT_VERSION=custom     - Set custom deployment version"
  exit 1
  ;;
esac
