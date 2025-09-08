#!/bin/bash

# NASCAR Data API - Development Environment Startup Script
# This script sets up and starts the complete development environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
ENV_FILE="$PROJECT_ROOT/.env.development"

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

# Check if Docker is installed and running
check_docker() {
  log_info "Checking Docker installation..."

  if ! command -v docker &>/dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi

  if ! docker info &>/dev/null; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
  fi

  log_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
  log_info "Checking Docker Compose availability..."

  if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
  elif docker-compose --version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
  else
    log_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
  fi

  log_success "Docker Compose is available: $DOCKER_COMPOSE"
}

# Create environment file if it doesn't exist
setup_environment() {
  log_info "Setting up environment configuration..."

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_FILE.example" ]]; then
      log_info "Creating .env.development from example..."
      cp "$ENV_FILE.example" "$ENV_FILE"
      log_warning "Please review and update $ENV_FILE with appropriate values"
    else
      log_warning ".env.development file not found and no example available"
    fi
  else
    log_success "Environment file exists: $ENV_FILE"
  fi
}

# Create necessary directories
create_directories() {
  log_info "Creating necessary directories..."

  local dirs=(
    "$PROJECT_ROOT/logs"
    "$PROJECT_ROOT/backups"
    "$PROJECT_ROOT/docker/ssl"
  )

  for dir in "${dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
      mkdir -p "$dir"
      log_info "Created directory: $dir"
    fi
  done

  log_success "Directory structure verified"
}

# Pull latest images
pull_images() {
  log_info "Pulling latest Docker images..."

  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" pull --ignore-pull-failures

  log_success "Images pulled successfully"
}

# Build application image
build_application() {
  log_info "Building application Docker image..."

  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --pull api

  log_success "Application image built successfully"
}

# Start services
start_services() {
  log_info "Starting development services..."

  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

  log_success "Services started successfully"
}

# Wait for services to be healthy
wait_for_health() {
  log_info "Waiting for services to be healthy..."

  local services=("postgres" "redis" "api")
  local max_wait=300 # 5 minutes
  local wait_time=0

  for service in "${services[@]}"; do
    log_info "Checking health of $service..."

    while [[ $wait_time -lt $max_wait ]]; do
      if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps "$service" | grep -q "(healthy)"; then
        log_success "$service is healthy"
        break
      fi

      if [[ $wait_time -ge $max_wait ]]; then
        log_error "$service failed to become healthy within $max_wait seconds"
        show_logs "$service"
        exit 1
      fi

      sleep 5
      wait_time=$((wait_time + 5))
      echo -n "."
    done
  done

  echo # New line after dots
  log_success "All services are healthy"
}

# Show service logs
show_logs() {
  local service=${1:-}

  if [[ -n "$service" ]]; then
    log_info "Showing logs for $service..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=50 "$service"
  else
    log_info "Showing logs for all services..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=50
  fi
}

# Show service status
show_status() {
  log_info "Development environment status:"
  echo

  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps

  echo
  log_info "Service URLs:"
  echo "  API Server:     http://localhost:3000"
  echo "  API Health:     http://localhost:3000/health"
  echo "  pgAdmin:        http://localhost:5050"
  echo "  Redis Insight:  http://localhost:8001"
  echo "  PostgreSQL:     localhost:5432"
  echo "  Redis:          localhost:6379"
}

# Cleanup function
cleanup() {
  log_info "Cleaning up..."
  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
}

# Main execution
main() {
  log_info "Starting NASCAR Data API development environment..."
  echo

  # Check prerequisites
  check_docker
  check_docker_compose

  # Setup environment
  setup_environment
  create_directories

  # Build and start
  pull_images
  build_application
  start_services

  # Wait for health and show status
  wait_for_health
  show_status

  echo
  log_success "Development environment is ready!"
  log_info "Use 'docker-compose -f $COMPOSE_FILE logs -f' to follow logs"
  log_info "Use '$0 stop' to stop all services"
}

# Handle command line arguments
case "${1:-start}" in
"start")
  main
  ;;
"stop")
  log_info "Stopping development environment..."
  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
  log_success "Development environment stopped"
  ;;
"restart")
  log_info "Restarting development environment..."
  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart
  log_success "Development environment restarted"
  ;;
"logs")
  show_logs "${2:-}"
  ;;
"status")
  show_status
  ;;
"clean")
  log_info "Cleaning up development environment..."
  cd "$PROJECT_ROOT"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" down -v --remove-orphans
  docker system prune -f
  log_success "Development environment cleaned"
  ;;
*)
  echo "Usage: $0 {start|stop|restart|logs [service]|status|clean}"
  echo
  echo "Commands:"
  echo "  start    - Start the development environment (default)"
  echo "  stop     - Stop all services"
  echo "  restart  - Restart all services"
  echo "  logs     - Show logs for all services or specific service"
  echo "  status   - Show status of all services"
  echo "  clean    - Stop services and clean up volumes/images"
  exit 1
  ;;
esac
