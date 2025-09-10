#!/bin/bash

# Apex API Deployment Script
# This script builds and deploys the Apex API container to AWS ECS

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="754494565257.dkr.ecr.us-east-1.amazonaws.com/apex-api"
ECS_CLUSTER="apex-api-primary"
ECS_SERVICE="apex-api-primary"
IMAGE_TAG="${1:-latest}"

echo -e "${BLUE}🏁 Starting Apex API Deployment...${NC}"
echo -e "${BLUE}   - Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}   - Repository: ${ECR_REPOSITORY}${NC}"
echo -e "${BLUE}   - Tag: ${IMAGE_TAG}${NC}"
echo ""

# Check if AWS CLI is installed and configured
if ! command -v aws &>/dev/null; then
  echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
  exit 1
fi

# Check if Docker is running
if ! docker info &>/dev/null; then
  echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
  exit 1
fi

# Step 1: Login to ECR
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY}

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully logged into ECR${NC}"
else
  echo -e "${RED}❌ Failed to login to ECR${NC}"
  exit 1
fi

# Step 2: Build the Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build --platform linux/amd64 -f Dockerfile.simple -t apex-api:${IMAGE_TAG} .

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully built Docker image${NC}"
else
  echo -e "${RED}❌ Failed to build Docker image${NC}"
  exit 1
fi

# Step 3: Tag the image for ECR
echo -e "${YELLOW}🏷️  Tagging image for ECR...${NC}"
docker tag apex-api:${IMAGE_TAG} ${ECR_REPOSITORY}:${IMAGE_TAG}
docker tag apex-api:${IMAGE_TAG} ${ECR_REPOSITORY}:latest

# Step 4: Push to ECR
echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
docker push ${ECR_REPOSITORY}:${IMAGE_TAG}
docker push ${ECR_REPOSITORY}:latest

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully pushed image to ECR${NC}"
else
  echo -e "${RED}❌ Failed to push image to ECR${NC}"
  exit 1
fi

# Step 5: Update ECS Service
echo -e "${YELLOW}🚀 Updating ECS service...${NC}"
aws ecs update-service \
  --region ${AWS_REGION} \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully triggered ECS service update${NC}"
else
  echo -e "${RED}❌ Failed to update ECS service${NC}"
  exit 1
fi

# Step 6: Wait for deployment to complete
echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
aws ecs wait services-stable \
  --region ${AWS_REGION} \
  --cluster ${ECS_CLUSTER} \
  --services ${ECS_SERVICE}

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
  echo ""
  echo -e "${BLUE}🌐 Your API is now available at:${NC}"
  echo -e "${BLUE}   - ALB: http://apex-api-primary-1441553589.us-east-1.elb.amazonaws.com${NC}"
  echo -e "${BLUE}   - CloudFront: http://d3n46y3ffnpuxa.cloudfront.net${NC}"
  echo ""
  echo -e "${BLUE}🔍 Test endpoints:${NC}"
  echo -e "${BLUE}   - Health: /health${NC}"
  echo -e "${BLUE}   - API Info: /api/v1${NC}"
  echo -e "${BLUE}   - Drivers: /api/v1/drivers${NC}"
else
  echo -e "${RED}❌ Deployment failed or timed out${NC}"
  exit 1
fi

echo -e "${GREEN}🏁 Apex API deployment completed successfully! 🎉${NC}"
