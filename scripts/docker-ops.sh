#!/bin/bash
# Apex Data API - Docker Operations Quick Reference
# Common operations for managing the Docker deployment

set -euo pipefail

COMPOSE_DEV="docker-compose -f docker-compose.dev.yml"
COMPOSE_PROD="docker-compose -f docker-compose.prod.yml"
COMPOSE_BASE="docker-compose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}🐳 Apex Data API - Docker Operations${NC}"
  echo "================================================="
}

show_help() {
  cat <<EOF
Usage: $0 [COMMAND] [ENVIRONMENT]

COMMANDS:
    status          Show service status
    logs            View service logs
    restart         Restart services
    update          Update and restart services
    backup          Run database backup
    clean           Clean up Docker resources
    health          Check service health
    shell           Open shell in API container

ENVIRONMENTS:
    dev             Development environment (default)
    prod            Production environment
    base            Base docker-compose.yml

EXAMPLES:
    $0 status dev       # Show dev service status
    $0 logs prod api    # Show production API logs
    $0 restart dev      # Restart dev services
    $0 update prod      # Update production deployment
    $0 backup prod      # Run production backup
    $0 clean            # Clean up Docker resources

NOTE:
    For Redis 8.2.1 rebuild, use: ./scripts/rebuild-redis.sh

EOF
}

get_compose_cmd() {
  case "${1:-dev}" in
  "prod" | "production")
    echo "$COMPOSE_PROD"
    ;;
  "base")
    echo "$COMPOSE_BASE"
    ;;
  *)
    echo "$COMPOSE_DEV"
    ;;
  esac
}

cmd_status() {
  local env=${1:-dev}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  echo -e "${GREEN}📊 Service Status ($env)${NC}"
  $compose_cmd ps
}

cmd_logs() {
  local env=${1:-dev}
  local service=${2:-}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  if [[ -n "$service" ]]; then
    echo -e "${GREEN}📋 Logs for $service ($env)${NC}"
    $compose_cmd logs -f "$service"
  else
    echo -e "${GREEN}📋 All service logs ($env)${NC}"
    $compose_cmd logs -f
  fi
}

cmd_restart() {
  local env=${1:-dev}
  local service=${2:-}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  if [[ -n "$service" ]]; then
    echo -e "${YELLOW}🔄 Restarting $service ($env)${NC}"
    $compose_cmd restart "$service"
  else
    echo -e "${YELLOW}🔄 Restarting all services ($env)${NC}"
    $compose_cmd restart
  fi

  echo -e "${GREEN}✅ Restart completed${NC}"
}

cmd_update() {
  local env=${1:-dev}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  echo -e "${YELLOW}📦 Updating deployment ($env)${NC}"

  # Pull latest images
  echo "Pulling latest images..."
  $compose_cmd pull

  # Rebuild and restart
  echo "Rebuilding services..."
  $compose_cmd build

  echo "Restarting services..."
  $compose_cmd up -d

  echo -e "${GREEN}✅ Update completed${NC}"
}

cmd_backup() {
  local env=${1:-prod}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  if [[ "$env" != "prod" ]]; then
    echo -e "${RED}⚠️  Backup is only available for production environment${NC}"
    exit 1
  fi

  echo -e "${YELLOW}💾 Running database backup${NC}"
  $compose_cmd run --rm postgres-backup

  echo -e "${GREEN}✅ Backup completed${NC}"
}

cmd_clean() {
  echo -e "${YELLOW}🧹 Cleaning up Docker resources${NC}"

  # Remove unused images, containers, networks
  docker system prune -f

  # Remove unused volumes (with confirmation)
  read -p "Remove unused volumes? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume prune -f
  fi

  echo -e "${GREEN}✅ Cleanup completed${NC}"
}

cmd_health() {
  local env=${1:-dev}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  echo -e "${GREEN}🏥 Health Check ($env)${NC}"

  # Service status
  echo "Service Status:"
  $compose_cmd ps

  echo ""
  echo "Health Checks:"

  # Check API health endpoint
  if [[ "$env" == "prod" ]]; then
    echo -n "API Health: "
    if curl -sf http://localhost/health >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Healthy${NC}"
    else
      echo -e "${RED}❌ Unhealthy${NC}"
    fi
  else
    echo -n "API Health: "
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Healthy${NC}"
    else
      echo -e "${RED}❌ Unhealthy${NC}"
    fi
  fi

  # Check database
  echo -n "Database: "
  if $compose_cmd exec -T postgres pg_isready -U apex_user >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ready${NC}"
  else
    echo -e "${RED}❌ Not Ready${NC}"
  fi

  # Check Redis (if available)
  if $compose_cmd ps | grep -q redis; then
    echo -n "Redis: "
    if $compose_cmd exec -T redis redis-cli ping >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Healthy${NC}"
    else
      echo -e "${RED}❌ Unhealthy${NC}"
    fi
  fi
}

cmd_shell() {
  local env=${1:-dev}
  local service=${2:-api}
  local compose_cmd
  compose_cmd=$(get_compose_cmd "$env")

  echo -e "${GREEN}🐚 Opening shell in $service container ($env)${NC}"
  $compose_cmd exec "$service" sh
}

# Main script logic
main() {
  if [[ $# -eq 0 ]]; then
    print_header
    show_help
    exit 0
  fi

  local command=$1
  shift

  case "$command" in
  "status" | "ps")
    cmd_status "$@"
    ;;
  "logs" | "log")
    cmd_logs "$@"
    ;;
  "restart" | "reload")
    cmd_restart "$@"
    ;;
  "update" | "deploy")
    cmd_update "$@"
    ;;
  "backup")
    cmd_backup "$@"
    ;;
  "clean" | "cleanup")
    cmd_clean "$@"
    ;;
  "health" | "check")
    cmd_health "$@"
    ;;
  "shell" | "exec")
    cmd_shell "$@"
    ;;
  "help" | "-h" | "--help")
    print_header
    show_help
    ;;
  *)
    echo -e "${RED}❌ Unknown command: $command${NC}"
    echo "Use '$0 help' for usage information"
    exit 1
    ;;
  esac
}

# Run main function
main "$@"
