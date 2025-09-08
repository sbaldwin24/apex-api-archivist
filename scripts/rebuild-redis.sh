#!/bin/bash
# Rebuild Docker containers with Redis 8.2.1-alpine
# Apex Data API - Redis Version Update

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}🔄 Redis 8.2.1 Update & Rebuild${NC}"
  echo "============================================"
}

pull_redis_image() {
  echo -e "${YELLOW}📥 Pulling Redis 8.2.1-alpine image...${NC}"
  docker pull redis:8.2.1-alpine
  echo -e "${GREEN}✅ Redis image pulled successfully${NC}"
}

rebuild_development() {
  echo -e "${YELLOW}🛠️  Rebuilding development environment...${NC}"

  # Stop existing containers if running
  docker-compose -f docker-compose.dev.yml down || true

  # Pull all images
  docker-compose -f docker-compose.dev.yml pull

  # Start services
  docker-compose -f docker-compose.dev.yml up -d

  echo -e "${GREEN}✅ Development environment rebuilt${NC}"
}

rebuild_production() {
  echo -e "${YELLOW}🏭 Rebuilding production environment...${NC}"

  # Stop existing containers if running
  docker-compose -f docker-compose.prod.yml down || true

  # Pull all images
  docker-compose -f docker-compose.prod.yml pull

  # Start services
  docker-compose -f docker-compose.prod.yml up -d

  echo -e "${GREEN}✅ Production environment rebuilt${NC}"
}

rebuild_base() {
  echo -e "${YELLOW}🔧 Rebuilding base environment...${NC}"

  # Stop existing containers if running
  docker-compose down || true

  # Pull all images
  docker-compose pull

  # Start services
  docker-compose up -d

  echo -e "${GREEN}✅ Base environment rebuilt${NC}"
}

check_redis_version() {
  local env=${1:-dev}
  local compose_cmd

  case "$env" in
  "prod" | "production")
    compose_cmd="docker-compose -f docker-compose.prod.yml"
    ;;
  "base")
    compose_cmd="docker-compose"
    ;;
  *)
    compose_cmd="docker-compose -f docker-compose.dev.yml"
    ;;
  esac

  echo -e "${BLUE}🔍 Checking Redis version in $env environment...${NC}"

  if $compose_cmd ps | grep -q redis; then
    local redis_version
    redis_version=$($compose_cmd exec -T redis redis-server --version | head -1 || echo "Unable to get version")
    echo "Redis Version: $redis_version"

    # Test Redis connectivity
    if $compose_cmd exec -T redis redis-cli ping >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Redis is healthy and responding${NC}"
    else
      echo -e "${RED}❌ Redis is not responding${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  Redis container not running in $env environment${NC}"
  fi
}

show_help() {
  cat <<EOF
Usage: $0 [COMMAND]

COMMANDS:
    pull        Pull Redis 8.2.1 image only
    dev         Rebuild development environment
    prod        Rebuild production environment
    base        Rebuild base environment
    all         Rebuild all environments
    check       Check Redis versions in all environments
    help        Show this help message

EXAMPLES:
    $0 pull     # Just pull the new Redis image
    $0 dev      # Rebuild development environment
    $0 prod     # Rebuild production environment
    $0 all      # Rebuild all environments
    $0 check    # Check Redis versions

EOF
}

# Main script logic
main() {
  print_header

  if [[ $# -eq 0 ]]; then
    show_help
    exit 0
  fi

  local command=$1

  case "$command" in
  "pull")
    pull_redis_image
    ;;
  "dev" | "development")
    pull_redis_image
    rebuild_development
    check_redis_version dev
    ;;
  "prod" | "production")
    pull_redis_image
    rebuild_production
    check_redis_version prod
    ;;
  "base")
    pull_redis_image
    rebuild_base
    check_redis_version base
    ;;
  "all")
    pull_redis_image
    echo -e "${YELLOW}🔄 Rebuilding all environments...${NC}"
    rebuild_base
    rebuild_development
    rebuild_production
    echo ""
    echo -e "${BLUE}🔍 Checking all environments...${NC}"
    check_redis_version base
    check_redis_version dev
    check_redis_version prod
    ;;
  "check" | "verify")
    check_redis_version base
    check_redis_version dev
    check_redis_version prod
    ;;
  "help" | "-h" | "--help")
    show_help
    ;;
  *)
    echo -e "${RED}❌ Unknown command: $command${NC}"
    echo "Use '$0 help' for usage information"
    exit 1
    ;;
  esac

  echo ""
  echo -e "${GREEN}🎉 Redis 8.2.1 update completed!${NC}"
  echo ""
  echo -e "${BLUE}📋 What's New in Redis 8.2.1:${NC}"
  echo "  • Enhanced performance and stability"
  echo "  • Improved memory efficiency"
  echo "  • Security updates and bug fixes"
  echo "  • Better JSON and search capabilities"
  echo ""
  echo -e "${YELLOW}💡 Next Steps:${NC}"
  echo "  1. Test your application with Redis 8.2.1"
  echo "  2. Monitor performance improvements"
  echo "  3. Update any Redis-specific configurations if needed"
}

# Check if Docker is available
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
  exit 1
fi

# Check if Docker daemon is running
if ! docker info &>/dev/null; then
  echo -e "${RED}❌ Docker daemon is not running${NC}"
  echo "Please start Docker and try again"
  exit 1
fi

# Run main function
main "$@"
