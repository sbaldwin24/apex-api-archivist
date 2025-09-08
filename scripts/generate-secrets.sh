#!/bin/bash
# Generate secure secrets for NASCAR Data API production deployment

set -euo pipefail

echo "🔐 Generating secure secrets for NASCAR Data API..."

# Function to generate a random string
generate_secret() {
  local length=${1:-32}
  openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate secrets
SESSION_SECRET=$(generate_secret 64)
JWT_SECRET=$(generate_secret 32)
POSTGRES_PASSWORD=$(generate_secret 24)
REDIS_PASSWORD=$(generate_secret 24)

# Create .env.prod file
cat >.env.prod <<EOF
# NASCAR Data API - Production Environment Variables
# Generated on $(date)
# ⚠️  DO NOT COMMIT THIS FILE TO VERSION CONTROL ⚠️

# ============================================================================
# Database Configuration (Production)
# ============================================================================
POSTGRES_DB=apex_prod
POSTGRES_USER=apex_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://apex_user:${POSTGRES_PASSWORD}@postgres:5432/apex_prod

# ============================================================================
# Redis Configuration (Production)
# ============================================================================
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# ============================================================================
# Security Secrets (Production)
# ============================================================================
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# ============================================================================
# API Configuration
# ============================================================================
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_CORS=false
API_RATE_LIMIT=50

# ============================================================================
# External Services (Configure these manually)
# ============================================================================
SENTRY_DSN=
NEW_RELIC_LICENSE_KEY=

# ============================================================================
# SSL and Domain Configuration (Configure these manually)
# ============================================================================
DOMAIN_NAME=your-domain.com
SSL_EMAIL=your-email@domain.com

# ============================================================================
# Backup Configuration (Configure these manually)
# ============================================================================
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
EOF

# Set proper permissions
chmod 600 .env.prod

echo "✅ Production secrets generated successfully!"
echo ""
echo "📋 Generated credentials:"
echo "   Database Password: ${POSTGRES_PASSWORD}"
echo "   Redis Password:    ${REDIS_PASSWORD}"
echo "   Session Secret:    ${SESSION_SECRET:0:16}... (truncated)"
echo "   JWT Secret:        ${JWT_SECRET:0:16}... (truncated)"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   1. Store these credentials in a secure password manager"
echo "   2. Never commit .env.prod to version control"
echo "   3. Restrict file permissions (already set to 600)"
echo "   4. Configure external services manually in .env.prod"
echo "   5. Update domain and SSL configuration for production"
echo ""
echo "📁 Configuration files created:"
echo "   .env.prod (production secrets - DO NOT COMMIT)"
echo ""
echo "🚀 You can now deploy with: docker-compose -f docker-compose.prod.yml up -d"
