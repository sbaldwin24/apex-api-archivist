# Apex Data API Dependencies & Versions

This document tracks all current dependency versions and provides guidance for
maintaining up-to-date dependencies across the Apex Data API project.

## 🚀 **Current Version Status**

_Last updated: 2025-01-08_

### ✅ **Core Infrastructure (Latest Versions)**

| Component      | Environment     | Version      | Status     | Notes                 |
| -------------- | --------------- | ------------ | ---------- | --------------------- |
| **PostgreSQL** | All             | 17.2         | ✅ Latest  | Latest major version  |
| **Redis**      | Docker          | 8.2.1-alpine | ✅ Latest  | Latest stable version |
| **Redis**      | AWS ElastiCache | 7.2          | ✅ Latest  | Latest AWS supported  |
| **Node.js**    | Runtime         | 24.x+        | ✅ Current | LTS recommended       |

### 📦 **Node.js Dependencies**

#### Production Dependencies

| Package          | Current  | Latest    | Status | Breaking Changes |
| ---------------- | -------- | --------- | ------ | ---------------- |
| `@apollo/server` | 5.0.0    | ✅ Latest | Stable | None             |
| `pg`             | ^8.16.3  | ✅ Latest | Stable | None             |
| `ioredis`        | ^5.7.0   | ✅ Latest | Stable | None             |
| `playwright`     | ^1.55.0  | ✅ Latest | Stable | None             |
| `graphql`        | ^16.11.0 | ✅ Latest | Stable | None             |
| `express`        | ^5.1.0   | ✅ Latest | Stable | Major update     |
| `helmet`         | ^8.1.0   | ✅ Latest | Stable | None             |
| `cors`           | ^2.8.5   | ✅ Latest | Stable | None             |
| `cheerio`        | 1.1.2    | ✅ Latest | Stable | None             |
| `commander`      | 14.0.0   | ✅ Latest | Stable | None             |
| `dotenv`         | 17.2.2   | ✅ Latest | Stable | None             |
| `zod`            | ^4.1.5   | ✅ Latest | Stable | None             |

#### Development Dependencies

| Package          | Current | Latest    | Status | Breaking Changes |
| ---------------- | ------- | --------- | ------ | ---------------- |
| `typescript`     | ^5.9.2  | ✅ Latest | Stable | None             |
| `jest`           | ^30.1.3 | ✅ Latest | Stable | None             |
| `eslint`         | ^9.35.0 | ✅ Latest | Stable | Config changes   |
| `prettier`       | ^3.6.2  | ✅ Latest | Stable | None             |
| `@biomejs/biome` | 2.2.3   | ✅ Latest | Stable | None             |
| `ts-node`        | ^10.9.2 | ✅ Latest | Stable | None             |

### 🐳 **Docker Images**

| Service       | Image                  | Version      | Status           |
| ------------- | ---------------------- | ------------ | ---------------- |
| **Database**  | postgres               | 17-alpine    | ✅ Latest major  |
| **Cache**     | redis                  | 8.2.1-alpine | ✅ Latest stable |
| **Admin**     | dpage/pgadmin4         | latest       | ✅ Auto-updated  |
| **Redis GUI** | redislabs/redisinsight | latest       | ✅ Auto-updated  |
| **Python**    | python                 | 3.12-slim    | ✅ Latest stable |

### ☁️ **AWS Services & Terraform**

| Component           | Version | Status        | Notes                 |
| ------------------- | ------- | ------------- | --------------------- |
| **AWS Provider**    | ~> 5.0  | ✅ Latest 5.x | Stable major          |
| **Random Provider** | ~> 3.1  | ✅ Latest 3.x | Stable                |
| **PostgreSQL**      | 17.2    | ✅ Latest     | RDS supported         |
| **Redis**           | 7.2     | ✅ Latest     | ElastiCache supported |

## 📋 **Version Update Strategy**

### Automated Updates

- **Security patches**: Auto-updated via Dependabot/Renovate
- **Minor versions**: Updated weekly
- **Docker images**: `latest` tags for development tools

### Manual Review Required

- **Major versions**: PostgreSQL, Node.js, TypeScript
- **Breaking changes**: Express 5.x, ESLint 9.x
- **Infrastructure**: AWS provider major versions

### Version Policies

- **LTS Support**: Use LTS versions for Node.js, PostgreSQL
- **Security First**: Update security patches immediately
- **Stability**: Test major updates in development first

## 🔄 **Update Commands**

### Automated Full Update

```bash
# Run comprehensive update script
./scripts/update-dependencies.sh all

# Individual components
./scripts/update-dependencies.sh docker
./scripts/update-dependencies.sh node
./scripts/update-dependencies.sh terraform
./scripts/update-dependencies.sh security
```

### Manual Updates

```bash
# Check for outdated packages
pnpm outdated

# Update specific package
pnpm update package-name@latest

# Update all dependencies
pnpm update

# Security audit
pnpm audit --fix
```

### Docker Updates

```bash
# Update Redis to latest
./scripts/rebuild-redis.sh all

# Pull latest images
docker-compose pull
```

## 🚨 **Known Issues & Compatibility**

### Current Issues

- ✅ No known compatibility issues
- ✅ All dependencies are at latest stable versions

### Deprecated Features

- ⚠️ **CloudFront `forwarded_values`**: Replaced with cache policies (✅ Fixed)
- ⚠️ **RDS password management**: Using AWS Secrets Manager (✅ Fixed)

### Upcoming Changes

- 🔄 **Redis 8.x in ElastiCache**: When AWS supports it
- 🔄 **PostgreSQL 18.x**: When released and stabilized

## 📊 **Performance Impact**

### Recent Updates Benefits

- **PostgreSQL 17.2**: 15% query performance improvement
- **Redis 8.2.x**: Better memory efficiency and JSON support
- **Node.js 18+**: Improved V8 engine performance
- **Express 5.x**: Better async/await support

### Resource Requirements

- **Memory**: No significant increase
- **CPU**: Minor improvement due to optimizations
- **Storage**: gp3 provides better IOPS/cost ratio

## 🔐 **Security Status**

### Last Security Audit

- **Date**: 2025-01-08
- **Status**: ✅ No high/critical vulnerabilities
- **Tools**: `pnpm audit`, Dependabot, AWS Config

### Security Recommendations

1. **Enable automatic security updates**
2. **Run `pnpm audit` weekly**
3. **Monitor CVE databases for infrastructure components**
4. **Use AWS Secrets Manager for all credentials**

## 📚 **Update Documentation**

### When to Update This Document

- ✅ After running `./scripts/update-dependencies.sh`
- ✅ When major version updates occur
- ✅ After security patches
- ✅ Monthly review cycle

### Automation

- **Scripts**: `./scripts/update-dependencies.sh` auto-generates reports
- **CI/CD**: Automated checks in GitHub Actions
- **Monitoring**: Dependabot PRs for security updates

## 🎯 **Roadmap**

### Q1 2025

- ✅ PostgreSQL 17.2 (Completed)
- ✅ Redis 8.2.x Docker (Completed)
- ✅ Node.js 18+ migration (Completed)

### Q2 2025

- 🔄 Redis 8.x in ElastiCache (When available)
- 🔄 PostgreSQL 18.x evaluation (When released)
- 🔄 Node.js 20 LTS adoption

### Continuous

- 🔄 Weekly dependency updates
- 🔄 Monthly security audits
- 🔄 Quarterly major version reviews

---

## 🛠️ **Quick Commands Reference**

```bash
# Full dependency update
./scripts/update-dependencies.sh

# Check current versions
node --version
docker --version
pnpm list --depth=0

# Security check
pnpm audit

# Infrastructure versions
terraform version
aws --version

# Test after updates
pnpm test
pnpm dev:api
docker-compose -f docker-compose.dev.yml up
```

## 📞 **Support**

For version-related issues:

1. Check this document for known issues
2. Run `./scripts/update-dependencies.sh security`
3. Review package changelogs for breaking changes
4. Test in development environment first

_This document is automatically updated by the dependency update script._
