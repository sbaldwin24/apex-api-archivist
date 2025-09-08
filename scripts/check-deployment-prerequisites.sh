#!/bin/bash
# Apex Data API - Deployment Prerequisites Check
# Verifies all required tools are installed and configured

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}🚀 Apex Data API - Deployment Prerequisites Check${NC}"
  echo "============================================"
  echo ""
}

check_tool() {
  local tool=$1
  local install_cmd=$2

  if command -v "$tool" &>/dev/null; then
    local version=$($tool --version 2>&1 | head -1 || echo "unknown")
    echo -e "${GREEN}✅ $tool${NC} - $version"
    return 0
  else
    echo -e "${RED}❌ $tool${NC} - Not installed"
    echo -e "${YELLOW}   Install with: $install_cmd${NC}"
    return 1
  fi
}

check_docker() {
  echo -e "${YELLOW}📦 Checking Docker...${NC}"

  local docker_ok=0

  if ! check_tool "docker" "Install Docker Desktop from https://docker.com/desktop"; then
    docker_ok=1
  fi

  if command -v docker &>/dev/null; then
    if ! docker info &>/dev/null; then
      echo -e "${RED}❌ Docker daemon is not running${NC}"
      echo -e "${YELLOW}   Please start Docker Desktop${NC}"
      docker_ok=1
    else
      echo -e "${GREEN}✅ Docker daemon is running${NC}"
    fi

    # Check Docker Compose
    if docker compose version &>/dev/null; then
      echo -e "${GREEN}✅ Docker Compose (plugin)${NC} - $(docker compose version)"
    elif docker-compose --version &>/dev/null; then
      echo -e "${GREEN}✅ Docker Compose (standalone)${NC} - $(docker-compose --version)"
    else
      echo -e "${RED}❌ Docker Compose not found${NC}"
      docker_ok=1
    fi
  fi

  return $docker_ok
}

check_node() {
  echo -e "${YELLOW}📦 Checking Node.js Environment...${NC}"

  local node_ok=0

  if ! check_tool "node" "Install from https://nodejs.org (recommend v18+)"; then
    node_ok=1
  else
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)

    if [[ $major_version -ge 18 ]]; then
      echo -e "${GREEN}✅ Node.js version is compatible (v$node_version >= v18)${NC}"
    else
      echo -e "${RED}❌ Node.js version too old (v$node_version < v18)${NC}"
      node_ok=1
    fi
  fi

  if ! check_tool "pnpm" "npm install -g pnpm"; then
    node_ok=1
  fi

  return $node_ok
}

check_terraform() {
  echo -e "${YELLOW}☁️ Checking Terraform (for AWS deployment)...${NC}"

  if ! check_tool "terraform" "Download from https://terraform.io/downloads"; then
    echo -e "${YELLOW}   Note: Only required for AWS infrastructure deployment${NC}"
    return 1
  fi

  return 0
}

check_aws() {
  echo -e "${YELLOW}☁️ Checking AWS CLI (for AWS deployment)...${NC}"

  local aws_ok=0

  if ! check_tool "aws" "Install from https://aws.amazon.com/cli/"; then
    echo -e "${YELLOW}   Note: Only required for AWS deployment${NC}"
    aws_ok=1
  else
    # Check AWS credentials
    if aws sts get-caller-identity &>/dev/null; then
      echo -e "${GREEN}✅ AWS credentials configured${NC}"
    else
      echo -e "${RED}❌ AWS credentials not configured${NC}"
      echo -e "${YELLOW}   Run: aws configure${NC}"
      aws_ok=1
    fi
  fi

  return $aws_ok
}

check_git() {
  echo -e "${YELLOW}📦 Checking Git...${NC}"

  if ! check_tool "git" "Install from https://git-scm.com"; then
    return 1
  fi

  # Check if we're in a git repository
  if git rev-parse --git-dir &>/dev/null; then
    echo -e "${GREEN}✅ In a Git repository${NC}"
  else
    echo -e "${YELLOW}⚠️  Not in a Git repository${NC}"
  fi

  return 0
}

check_environment_files() {
  echo -e "${YELLOW}📄 Checking Environment Files...${NC}"

  local env_ok=0

  # Check for environment templates
  local env_files=(
    ".env.development.example"
    ".env.prod.template"
  )

  for file in "${env_files[@]}"; do
    if [[ -f "$file" ]]; then
      echo -e "${GREEN}✅ $file${NC} exists"
    else
      echo -e "${RED}❌ $file${NC} missing"
      env_ok=1
    fi
  done

  # Check if user has created their environment files
  if [[ -f ".env" ]]; then
    echo -e "${GREEN}✅ .env${NC} exists (development)"
  else
    echo -e "${YELLOW}⚠️  .env${NC} not found (copy from .env.development.example)"
  fi

  if [[ -f ".env.production" || -f ".env.prod" ]]; then
    echo -e "${GREEN}✅ Production environment file exists${NC}"
  else
    echo -e "${YELLOW}⚠️  Production environment file not found${NC}"
    echo -e "${YELLOW}   Create .env.production from .env.prod.template${NC}"
  fi

  return $env_ok
}

generate_deployment_guide() {
  echo ""
  echo -e "${BLUE}📋 Next Steps Based on Your Deployment Choice:${NC}"
  echo ""

  echo -e "${YELLOW}1. 🐳 Local Docker Deployment (Recommended for testing):${NC}"
  echo "   • Copy environment file: cp .env.development.example .env"
  echo "   • Start services: docker-compose up -d"
  echo "   • Access API at: http://localhost:3000"
  echo ""

  echo -e "${YELLOW}2. ☁️ AWS Infrastructure Deployment (Production):${NC}"
  echo "   • Configure AWS credentials: aws configure"
  echo "   • Copy variables: cp terraform/terraform.tfvars.example terraform/terraform.tfvars"
  echo "   • Deploy infrastructure: cd terraform && terraform init && terraform plan"
  echo "   • Apply changes: terraform apply"
  echo ""

  echo -e "${YELLOW}3. 🔧 Manual Server Deployment:${NC}"
  echo "   • Install PostgreSQL 17+ and Redis 8+"
  echo "   • Configure environment: cp .env.prod.template .env.production"
  echo "   • Build application: pnpm install && pnpm build"
  echo "   • Run migrations: pnpm migrate:up"
  echo "   • Start server: pnpm start:api"
  echo ""
}

show_summary() {
  local total_checks=$1
  local failed_checks=$2

  echo ""
  echo -e "${BLUE}📊 Prerequisites Summary:${NC}"

  if [[ $failed_checks -eq 0 ]]; then
    echo -e "${GREEN}✅ All prerequisites met! ($total_checks/$total_checks)${NC}"
    echo -e "${GREEN}🚀 Ready to deploy the Apex Data API!${NC}"
  else
    local passed_checks=$((total_checks - failed_checks))

    echo -e "${YELLOW}⚠️  Some prerequisites missing ($passed_checks/$total_checks passed)${NC}"
    echo -e "${YELLOW}📝 Install missing tools before deployment${NC}"
  fi

  generate_deployment_guide
}

# Main execution
main() {
  print_header

  local failed_checks=0
  local total_checks=6

  # Core checks (required for all deployments)
  check_docker || ((failed_checks++))
  echo ""

  check_node || ((failed_checks++))
  echo ""

  check_git || ((failed_checks++))
  echo ""

  check_environment_files || ((failed_checks++))
  echo ""

  # Optional checks (for specific deployment types)
  check_terraform || echo -e "${YELLOW}   (Optional for AWS deployment)${NC}"
  echo ""

  check_aws || echo -e "${YELLOW}   (Optional for AWS deployment)${NC}"
  echo ""

  show_summary $total_checks $failed_checks

  return $failed_checks
}

main "$@"
