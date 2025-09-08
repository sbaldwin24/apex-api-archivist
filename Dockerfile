# Apex Data API - Production Dockerfile
# Multi-stage build for optimized production image

# ============================================================================
# Build Stage - Install dependencies and build application
# ============================================================================
FROM node:24-alpine AS builder

# Set build-time environment variables
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Add metadata labels
LABEL maintainer="Sterling Baldwin"
LABEL description="Apex Data API - Build Stage"
LABEL version="1.0.0"

# Install system dependencies required for building
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  git \
  curl

# Create app directory
WORKDIR /usr/src/app

# Copy package manager files
COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile --prefer-offline

# Copy source code and configuration files
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY public/ ./public/
COPY *.sql ./

# Install Playwright browsers
RUN pnpm exec playwright install --with-deps chromium

# Build the application
RUN pnpm run build

# Prune development dependencies for production
RUN pnpm prune --prod --config.ignore-scripts=true

# ============================================================================
# Runtime Stage - Minimal production image
# ============================================================================
FROM node:24-alpine AS runtime

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Add metadata labels
LABEL maintainer="Sterling Baldwin"
LABEL description="Apex Data API - Production Runtime"
LABEL version="1.0.0"

# Install runtime dependencies only
RUN apk add --no-cache \
  dumb-init \
  curl \
  tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

# Create app directory with proper permissions
WORKDIR /usr/src/app
RUN chown nodejs:nodejs /usr/src/app

# Copy built application and dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/package.json ./

# Copy runtime assets and migration files
COPY --chown=nodejs:nodejs *.sql ./
COPY --chown=nodejs:nodejs public ./public
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/migrations ./migrations

# Create directories for sessions and logs
RUN mkdir -p /usr/src/app/sessions /usr/src/app/logs && \
  chown -R nodejs:nodejs /usr/src/app/sessions /usr/src/app/logs

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# ============================================================================
# Development Stage - Development environment with hot reload
# ============================================================================
FROM node:24-alpine AS development

# Set development environment
ENV NODE_ENV=development

# Add metadata labels
LABEL maintainer="Sterling Baldwin"
LABEL description="Apex Data API - Development Environment"
LABEL version="1.0.0"

# Install development dependencies
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  git \
  curl

# Create app directory
WORKDIR /usr/src/app

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose ports for API and development tools
EXPOSE 3000 3001 9229

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start development server with hot reload
CMD ["pnpm", "dev:api"]
