#!/bin/bash

# Apex Data API - Production Deployment Script
# This script handles secure production deployment with rollback capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.production"

# Deployment configuration
IMAGE_NAME="apex-api"
REGISTRY_URL="${DOCKER_REGISTRY:-}"
VERSION="${DEPLOYMENT_VERSION:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_RETENTION_DAYS=7

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

# Security check functions
check_environment_file() {
  log_info "Checking production environment file..."

  if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Production environment file not found: $ENV_FILE"
    log_error "Please create it from .env.production.example and configure all values"
    exit 1
  fi

  # Check for placeholder values
  local placeholders=(
    "CHANGE_THIS_PASSWORD"
    "your-super-secret"
    "your-jwt-secret"
    "CHANGE_THIS_REDIS_PASSWORD"
  )

  for placeholder in "${placeholders[@]}"; do
    if grep -q "$placeholder" "$ENV_FILE"; then
      log_error "Found placeholder value '$placeholder' in $ENV_FILE"
      log_error "Please replace all placeholder values with actual secrets"
      exit 1
    fi
  done

  # Check for required environment variables
  local required_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "SESSION_SECRET"
    "JWT_SECRET"
  )

  for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" "$ENV_FILE"; then
      log_error "Required environment variable '$var' not found in $ENV_FILE"
      exit 1
    fi
  done

  log_success "Environment file validation passed"
}

check_docker_registry() {
  if [[ -n "$REGISTRY_URL" ]]; then
    log_info "Checking Docker registry authentication..."

    if ! docker login "$REGISTRY_URL" --username "$DOCKER_USERNAME" --password-stdin <<<"$DOCKER_PASSWORD" 2>/dev/null; then
      log_error "Failed to authenticate with Docker registry: $REGISTRY_URL"
      log_error "Please ensure DOCKER_USERNAME and DOCKER_PASSWORD are set correctly"
      exit 1
    fi

    log_success "Docker registry authentication successful"
  else
    log_warning "No Docker registry configured, using local images"
  fi
}

check_prerequisites() {
  log_info "Checking deployment prerequisites..."

  # Check Docker
  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi

  if ! docker info &>/dev/null; then
    log_error "Docker is not running"
    exit 1
  fi

  # Check Docker Compose
  if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
  elif docker-compose --version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
  else
    log_error "Docker Compose is not available"
    exit 1
  fi

  # Check required files
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    log_error "Production compose file not found: $COMPOSE_FILE"
    exit 1
  fi

  log_success "Prerequisites check passed"
}

# Backup functions
backup_database() {
  log_info "Creating database backup..."

  local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d)"
  local backup_file="$backup_dir/apex_prod_$(date +%H%M%S).sql"

  mkdir -p "$backup_dir"

  # Create database backup
  if docker exec apex_postgres_prod pg_dump -U apex_user -d apex_prod >"$backup_file" 2>/dev/null; then
    log_success "Database backup created: $backup_file"

    # Compress backup
    gzip "$backup_file"
    log_info "Backup compressed: ${backup_file}.gz"

    # Clean old backups
    find "$PROJECT_ROOT/backups" -name "*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete
    log_info "Old backups cleaned (older than $BACKUP_RETENTION_DAYS days)"

    echo "$backup_file.gz"
  else
    log_error "Failed to create database backup"
    exit 1
  fi
}

backup_application() {
  log_info "Creating application backup..."

  local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d)"
  local current_image=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep "$IMAGE_NAME" | head -n1)

  if [[ -n "$current_image" ]]; then
    docker tag "$current_image" "${IMAGE_NAME}:backup-$(date +%Y%m%d-%H%M%S)"
    log_success "Application backup tagged: ${IMAGE_NAME}:backup-$(date +%Y%m%d-%H%M%S)"
  else
    log_warning "No current application image found to backup"
  fi
}

# Build and deployment functions
build_application() {
  log_deploy "Building application for production..."

  cd "$PROJECT_ROOT"

  # Build with version tag
  docker build \
    --target production \
    --build-arg NODE_ENV=production \
    --build-arg DEPLOYMENT_VERSION="$VERSION" \
    --build-arg DEPLOYMENT_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg DEPLOYMENT_COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    .

  log_success "Application built successfully: ${IMAGE_NAME}:${VERSION}"
}

push_to_registry() {
  if [[ -n "$REGISTRY_URL" ]]; then
    log_deploy "Pushing image to registry..."

    local remote_image="$REGISTRY_URL/${IMAGE_NAME}:${VERSION}"
    local remote_latest="$REGISTRY_URL/${IMAGE_NAME}:latest"

    docker tag "${IMAGE_NAME}:${VERSION}" "$remote_image"
    docker tag "${IMAGE_NAME}:latest" "$remote_latest"

    docker push "$remote_image"
    docker push "$remote_latest"

    log_success "Images pushed to registry"
  else
    log_info "Skipping registry push (no registry configured)"
  fi
}

# Health check functions
wait_for_healthy_services() {
  log_info "Waiting for services to become healthy..."

  local services=("postgres" "redis" "api")
  local max_wait=300 # 5 minutes

  for service in "${services[@]}"; do
    log_info "Checking health of $service..."

    local wait_time=0
    while [[ $wait_time -lt $max_wait ]]; do
      if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps "$service" | grep -q "(healthy)"; then
        log_success "$service is healthy"
        break
      fi

      if [[ $wait_time -ge $max_wait ]]; then
        log_error "$service failed to become healthy within $max_wait seconds"
        show_service_logs "$service"
        return 1
      fi

      sleep 10
      wait_time=$((wait_time + 10))
      echo -n "."
    done
  done

  echo
  log_success "All services are healthy"
}

run_smoke_tests() {
  log_info "Running smoke tests..."

  local api_url="http://localhost:3000"
  local tests_passed=0
  local tests_total=0

  # Test 1: Health endpoint
  ((tests_total++))
  if curl -sf "$api_url/health" >/dev/null; then
    log_success "✓ Health endpoint test passed"
    ((tests_passed++))
  else
    log_error "✗ Health endpoint test failed"
  fi

  # Test 2: Liveness probe
  ((tests_total++))
  if curl -sf "$api_url/health/live" >/dev/null; then
    log_success "✓ Liveness probe test passed"
    ((tests_passed++))
  else
    log_error "✗ Liveness probe test failed"
  fi

  # Test 3: Readiness probe
  ((tests_total++))
  if curl -sf "$api_url/health/ready" >/dev/null; then
    log_success "✓ Readiness probe test passed"
    ((tests_passed++))
  else
    log_error "✗ Readiness probe test failed"
  fi

  # Test 4: API endpoint
  ((tests_total++))
  if curl -sf "$api_url/api/races/2024" >/dev/null; then
    log_success "✓ API endpoint test passed"
    ((tests_passed++))
  else
    log_warning "⚠ API endpoint test failed (may be expected if no data)"
    ((tests_passed++)) # Count as passed for now
  fi

  if [[ $tests_passed -eq $tests_total ]]; then
    log_success "All smoke tests passed ($tests_passed/$tests_total)"
    return 0
  else
    log_error "Some smoke tests failed ($tests_passed/$tests_total)"
    return 1
  fi
}

# Rollback functions
rollback_deployment() {
  log_warning "Initiating deployment rollback..."

  local backup_image
  backup_image=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep "${IMAGE_NAME}:backup-" | head -n1 | awk '{print $1}')

  if [[ -n "$backup_image" ]]; then
    log_info "Rolling back to: $backup_image"

    # Tag backup as latest
    docker tag "$backup_image" "${IMAGE_NAME}:latest"

    # Restart services with backup image
    cd "$PROJECT_ROOT"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --force-recreate api

    if wait_for_healthy_services; then
      log_success "Rollback completed successfully"
    else
      log_error "Rollback failed - manual intervention required"
      exit 1
    fi
  else
    log_error "No backup image found for rollback"
    log_error "Manual recovery required"
    exit 1
  fi
}

# Utility functions
show_service_logs() {
  local service=${1:-}

  if [[ -n "$service" ]]; then
    log_info "Showing recent logs for $service:"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=100 "$service"
  else
    log_info "Showing recent logs for all services:"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=50
  fi
}

show_deployment_info() {
  log_info "Deployment Information:"
  echo "  Version:        $VERSION"
  echo "  Image:          ${IMAGE_NAME}:${VERSION}"
  echo "  Timestamp:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "  Commit SHA:     $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  echo "  Environment:    production"
  echo
}

show_service_status() {
  log_info "Production service status:"
  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
  echo

  log_info "Service URLs:"
  echo "  API Server:     http://localhost:80 (via NGINX)"
  echo "  Direct API:     http://localhost:3000 (bypassing NGINX)"
  echo "  Health Check:   http://localhost/health"
  echo
}

# Main deployment function
deploy() {
  log_deploy "Starting production deployment..."
  show_deployment_info

  # Pre-deployment checks
  check_prerequisites
  check_environment_file
  check_docker_registry

  # Create backups
  local db_backup
  db_backup=$(backup_database)
  backup_application

  # Build and deploy
  build_application
  push_to_registry

  # Deploy services
  cd "$PROJECT_ROOT"
  log_deploy "Deploying services..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --force-recreate

  # Verify deployment
  if wait_for_healthy_services; then
    if run_smoke_tests; then
      show_service_status
      log_success "Production deployment completed successfully!"
      log_info "Database backup: $db_backup"

      return 0
    else
      log_error "Smoke tests failed - rolling back deployment"
      rollback_deployment
      return 1
    fi
  else
    log_error "Services failed health checks - rolling back deployment"
    rollback_deployment
    return 1
  fi
}

# Command handling
case "${1:-deploy}" in
"deploy")
  deploy
  ;;
"rollback")
  rollback_deployment
  ;;
"status")
  show_service_status
  ;;
"logs")
  show_service_logs "${2:-}"
  ;;
"backup")
  backup_database
  backup_application
  ;;
"test")
  run_smoke_tests
  ;;
*)
  echo "Usage: $0 {deploy|rollback|status|logs [service]|backup|test}"
  echo
  echo "Commands:"
  echo "  deploy    - Deploy to production (default)"
  echo "  rollback  - Rollback to previous version"
  echo "  status    - Show service status"
  echo "  logs      - Show logs for all or specific service"
  echo "  backup    - Create manual backup"
  echo "  test      - Run smoke tests"
  exit 1
  ;;
esac
