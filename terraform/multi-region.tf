terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Local values for consistent tagging
locals {
  common_tags = {
    Environment      = var.environment
    Project         = "apex-api"
    Owner           = "apex-team"
    CostCenter      = "engineering"
    Repository      = "apex-api-archivist"
    TerraformManaged = "true"
  }
}

# Primary region (us-east-1)
provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

# Secondary region (us-west-2)
provider "aws" {
  alias  = "secondary"
  region = "us-west-2"
}

# Data sources for managed cache policies
data "aws_cloudfront_cache_policy" "managed_caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "managed_caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "managed_cors_s3_origin" {
  name = "Managed-CORS-S3Origin"
}

# Global CloudFront distribution
resource "aws_cloudfront_distribution" "apex_api" {
  origin {
    domain_name = aws_lb.primary.dns_name
    origin_id   = "primary-alb"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  origin {
    domain_name = aws_lb.secondary.dns_name
    origin_id   = "secondary-alb"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  enabled = true
  
  default_cache_behavior {
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "primary-alb"
    compress                 = true
    viewer_protocol_policy   = "redirect-to-https"
    
    # Use managed cache policy instead of forwarded_values
    cache_policy_id          = data.aws_cloudfront_cache_policy.managed_caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.managed_cors_s3_origin.id
    
    min_ttl     = 0
    default_ttl = 300
    max_ttl     = 3600
  }
  
  # Cache API responses with custom policy for dynamic content
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "primary-alb"
    compress                 = true
    viewer_protocol_policy   = "redirect-to-https"
    
    # Use caching disabled for dynamic API content
    cache_policy_id          = data.aws_cloudfront_cache_policy.managed_caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.managed_cors_s3_origin.id
    
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 300
  }
  
  # Cache static assets for longer
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "primary-alb"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    
    cache_policy_id        = data.aws_cloudfront_cache_policy.managed_caching_optimized.id
    
    min_ttl     = 3600
    default_ttl = 86400
    max_ttl     = 31536000
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  
  tags = merge(local.common_tags, {
    Name = "Apex Data API CDN"
  })
}

# Security Groups
# ALB Security Group for primary region
resource "aws_security_group" "alb_primary" {
  provider    = aws.primary
  name        = "apex-api-alb-primary-sg"
  description = "Security group for Apex Data API ALB in primary region"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API ALB Primary Security Group"
    Region = "us-east-1"
  })
}

# ALB Security Group for secondary region
resource "aws_security_group" "alb_secondary" {
  provider    = aws.secondary
  name        = "apex-api-alb-secondary-sg"
  description = "Security group for Apex Data API ALB in secondary region"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API ALB Secondary Security Group"
    Region = "us-west-2"
  })
}

# RDS Security Group for primary region
resource "aws_security_group" "rds_primary" {
  provider    = aws.primary
  name        = "apex-api-rds-primary-sg"
  description = "Security group for Apex Data API RDS in primary region"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description     = "PostgreSQL from ALB"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_primary.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API RDS Primary Security Group"
    Region = "us-east-1"
  })
}

# RDS Security Group for secondary region
resource "aws_security_group" "rds_secondary" {
  provider    = aws.secondary
  name        = "apex-api-rds-secondary-sg"
  description = "Security group for Apex Data API RDS in secondary region"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description     = "PostgreSQL from ALB"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_secondary.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API RDS Secondary Security Group"
    Region = "us-west-2"
  })
}

# S3 buckets for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  provider = aws.primary
  bucket   = "apex-api-alb-logs-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name   = "Apex Data API ALB Logs Bucket"
    Region = "us-east-1"
  })
}

resource "aws_s3_bucket" "alb_logs_secondary" {
  provider = aws.secondary
  bucket   = "apex-api-alb-logs-secondary-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name   = "Apex Data API ALB Logs Bucket Secondary"
    Region = "us-west-2"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket policies for ALB access logs
resource "aws_s3_bucket_policy" "alb_logs" {
  provider = aws.primary
  bucket   = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::127311923021:root"  # ELB service account for us-east-1
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/primary-alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_policy" "alb_logs_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.alb_logs_secondary.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::797873946194:root"  # ELB service account for us-west-2
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs_secondary.arn}/secondary-alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

# Primary region resources
resource "aws_lb" "primary" {
  provider = aws.primary
  
  name               = "apex-api-primary"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.primary_public_1.id, aws_subnet.primary_public_2.id]
  security_groups    = [aws_security_group.alb_primary.id]
  
  enable_deletion_protection = var.enable_deletion_protection
  
  # Enable access logging
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "primary-alb"
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name   = "Apex Data API Primary ALB"
    Region = "us-east-1"
  })
}

# Secondary region resources  
resource "aws_lb" "secondary" {
  provider = aws.secondary
  
  name               = "apex-api-secondary"
  internal           = false
  load_balancer_type = "application"
  subnets            = [aws_subnet.secondary_public_1.id, aws_subnet.secondary_public_2.id]
  security_groups    = [aws_security_group.alb_secondary.id]
  
  enable_deletion_protection = var.enable_deletion_protection
  
  # Enable access logging
  access_logs {
    bucket  = aws_s3_bucket.alb_logs_secondary.id
    prefix  = "secondary-alb"
    enabled = true
  }
  
  tags = merge(local.common_tags, {
    Name   = "Apex Data API Secondary ALB"
    Region = "us-west-2"
  })
}

# DB subnet groups
resource "aws_db_subnet_group" "primary" {
  provider   = aws.primary
  name       = "apex-api-primary-subnet-group"
  subnet_ids = [aws_subnet.primary_public_1.id, aws_subnet.primary_public_2.id]

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Primary DB Subnet Group"
    Region = "us-east-1"
  })
}

resource "aws_db_subnet_group" "secondary" {
  provider   = aws.secondary
  name       = "apex-api-secondary-subnet-group"
  subnet_ids = [aws_subnet.secondary_public_1.id, aws_subnet.secondary_public_2.id]

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Secondary DB Subnet Group"
    Region = "us-west-2"
  })
}

# IAM role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  provider = aws.primary
  name     = "rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  provider   = aws.primary
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# IAM role for RDS Enhanced Monitoring in secondary region
resource "aws_iam_role" "rds_monitoring_secondary" {
  provider = aws.secondary
  name     = "rds-monitoring-role-secondary"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring_secondary" {
  provider   = aws.secondary
  role       = aws_iam_role.rds_monitoring_secondary.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ElastiCache Redis Clusters
# Redis cluster for primary region
resource "aws_elasticache_subnet_group" "primary" {
  provider   = aws.primary
  name       = "apex-api-primary-redis-subnet-group"
  subnet_ids = [aws_subnet.primary_public_1.id, aws_subnet.primary_public_2.id]

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Primary Redis Subnet Group"
    Region = "us-east-1"
  })
}

resource "aws_elasticache_replication_group" "primary" {
  provider = aws.primary
  
  replication_group_id         = "apex-api-primary-redis"
  description                  = "Apex Data API primary Redis cluster"
  
  # Latest Redis version supported by AWS ElastiCache
  engine               = "redis"
  engine_version       = "7.2"  # AWS ElastiCache doesn't support 8.x yet, 7.2 is latest
  node_type           = "cache.r7g.large"
  
  # High availability configuration
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Network configuration
  subnet_group_name    = aws_elasticache_subnet_group.primary.name
  security_group_ids   = [aws_security_group.redis_primary.id]
  
  # Backup and maintenance
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  
  # Performance
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  
  tags = merge(local.common_tags, {
    Name   = "Apex Data API Primary Redis Cluster"
    Region = "us-east-1"
  })
}

# Redis cluster for secondary region
resource "aws_elasticache_subnet_group" "secondary" {
  provider   = aws.secondary
  name       = "apex-api-secondary-redis-subnet-group"
  subnet_ids = [aws_subnet.secondary_public_1.id, aws_subnet.secondary_public_2.id]

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Secondary Redis Subnet Group"
    Region = "us-west-2"
  })
}

resource "aws_elasticache_replication_group" "secondary" {
  provider = aws.secondary
  
  replication_group_id         = "apex-api-secondary-redis"
  description                  = "Apex Data API secondary Redis cluster"
  
  # Latest Redis version supported by AWS ElastiCache
  engine               = "redis"
  engine_version       = "7.2"  # AWS ElastiCache doesn't support 8.x yet, 7.2 is latest
  node_type           = "cache.r7g.large"
  
  # High availability configuration
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Network configuration
  subnet_group_name    = aws_elasticache_subnet_group.secondary.name
  security_group_ids   = [aws_security_group.redis_secondary.id]
  
  # Backup and maintenance
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  
  # Performance
  parameter_group_name = aws_elasticache_parameter_group.redis_secondary.name
  
  tags = merge(local.common_tags, {
    Name   = "Apex Data API Secondary Redis Cluster"
    Region = "us-west-2"
  })
}

# Redis parameter groups for optimization
resource "aws_elasticache_parameter_group" "redis" {
  provider = aws.primary
  
  family      = "redis7.x"
  name        = "apex-api-redis-params"
  description = "Apex Data API Redis parameter group"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }
  
  tags = local.common_tags
}

resource "aws_elasticache_parameter_group" "redis_secondary" {
  provider = aws.secondary
  
  family      = "redis7.x"
  name        = "apex-api-redis-params-secondary"
  description = "Apex Data API Redis parameter group for secondary region"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }
  
  tags = local.common_tags
}

# Security groups for Redis
resource "aws_security_group" "redis_primary" {
  provider    = aws.primary
  name        = "apex-api-redis-primary-sg"
  description = "Security group for Apex Data API Redis in primary region"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description     = "Redis from ALB"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_primary.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Redis Primary Security Group"
    Region = "us-east-1"
  })
}

resource "aws_security_group" "redis_secondary" {
  provider    = aws.secondary
  name        = "apex-api-redis-secondary-sg"
  description = "Security group for Apex Data API Redis in secondary region"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description     = "Redis from ALB"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_secondary.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name   = "Apex Data API Redis Secondary Security Group"
    Region = "us-west-2"
  })
}

# RDS with cross-region read replicas
resource "aws_db_instance" "primary" {
  provider = aws.primary
  
  identifier = "apex-api-primary"
  
  # Updated PostgreSQL version and instance class
  engine         = "postgres"
  engine_version = "17.2"  # Latest PostgreSQL 17.x supported by AWS RDS
  instance_class = var.db_instance_class
  
  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  
  # Database configuration
  db_name  = "apex_data"
  username = "apex_user"
  
  # Use AWS Secrets Manager for password management
  manage_master_user_password = true
  
  # Network configuration
  vpc_security_group_ids = [aws_security_group.rds_primary.id]
  db_subnet_group_name   = aws_db_subnet_group.primary.name
  
  # Backup and maintenance configuration
  backup_retention_period   = var.backup_retention_days
  backup_window            = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"
  delete_automated_backups = false
  
  # High availability
  multi_az               = true
  skip_final_snapshot   = false
  final_snapshot_identifier = "apex-api-primary-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  # Performance monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  
  # Deletion protection
  deletion_protection = var.enable_deletion_protection
  
  tags = merge(local.common_tags, {
    Name           = "Apex Data API Primary DB"
    Region         = "us-east-1"
    BackupSchedule = "daily"
    DatabaseEngine = "postgresql-17.2"
  })
}

resource "aws_db_instance" "secondary" {
  provider = aws.secondary
  
  identifier = "apex-api-secondary"
  
  # Cross-region read replica configuration
  replicate_source_db = aws_db_instance.primary.arn  # Use ARN for cross-region
  instance_class      = var.db_instance_class
  
  # Network configuration for secondary region
  vpc_security_group_ids = [aws_security_group.rds_secondary.id]
  
  # Performance monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_secondary.arn
  
  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  
  # Deletion protection
  deletion_protection = var.enable_deletion_protection
  skip_final_snapshot = false
  final_snapshot_identifier = "apex-api-secondary-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  tags = merge(local.common_tags, {
    Name           = "Apex Data API Secondary DB"
    Region         = "us-west-2"
    DatabaseEngine = "postgresql-17.2"
    ReplicaType    = "cross-region-read-replica"
  })
}

# VPC and networking
resource "aws_vpc" "primary" {
  provider = aws.primary
  
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name   = "NASCAR API Primary VPC"
    Region = "us-east-1"
  })
}

# Internet Gateway for primary region
resource "aws_internet_gateway" "primary" {
  provider = aws.primary
  vpc_id   = aws_vpc.primary.id

  tags = merge(local.common_tags, {
    Name   = "NASCAR API Primary IGW"
    Region = "us-east-1"
  })
}

# Route table for primary public subnets
resource "aws_route_table" "primary_public" {
  provider = aws.primary
  vpc_id   = aws_vpc.primary.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.primary.id
  }

  tags = merge(local.common_tags, {
    Name   = "Primary Public Route Table"
    Region = "us-east-1"
  })
}

resource "aws_subnet" "primary_public_1" {
  provider = aws.primary
  
  vpc_id                  = aws_vpc.primary.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "Primary Public Subnet 1"
    AZ   = "us-east-1a"
  })
}

# Route table association for primary public subnet 1
resource "aws_route_table_association" "primary_public_1" {
  provider       = aws.primary
  subnet_id      = aws_subnet.primary_public_1.id
  route_table_id = aws_route_table.primary_public.id
}

resource "aws_subnet" "primary_public_2" {
  provider = aws.primary
  
  vpc_id                  = aws_vpc.primary.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "Primary Public Subnet 2"
    AZ   = "us-east-1b"
  })
}

# Route table association for primary public subnet 2
resource "aws_route_table_association" "primary_public_2" {
  provider       = aws.primary
  subnet_id      = aws_subnet.primary_public_2.id
  route_table_id = aws_route_table.primary_public.id
}

# Secondary region networking resources
resource "aws_vpc" "secondary" {
  provider = aws.secondary
  
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name   = "NASCAR API Secondary VPC"
    Region = "us-west-2"
  })
}

# Internet Gateway for secondary region
resource "aws_internet_gateway" "secondary" {
  provider = aws.secondary
  vpc_id   = aws_vpc.secondary.id

  tags = merge(local.common_tags, {
    Name   = "NASCAR API Secondary IGW"
    Region = "us-west-2"
  })
}

# Route table for secondary public subnets
resource "aws_route_table" "secondary_public" {
  provider = aws.secondary
  vpc_id   = aws_vpc.secondary.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.secondary.id
  }

  tags = merge(local.common_tags, {
    Name   = "Secondary Public Route Table"
    Region = "us-west-2"
  })
}

resource "aws_subnet" "secondary_public_1" {
  provider = aws.secondary
  
  vpc_id                  = aws_vpc.secondary.id
  cidr_block              = "10.1.1.0/24"
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "Secondary Public Subnet 1"
    AZ   = "us-west-2a"
  })
}

# Route table association for secondary public subnet 1
resource "aws_route_table_association" "secondary_public_1" {
  provider       = aws.secondary
  subnet_id      = aws_subnet.secondary_public_1.id
  route_table_id = aws_route_table.secondary_public.id
}

resource "aws_subnet" "secondary_public_2" {
  provider = aws.secondary
  
  vpc_id                  = aws_vpc.secondary.id
  cidr_block              = "10.1.2.0/24"
  availability_zone       = "us-west-2b"
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "Secondary Public Subnet 2"
    AZ   = "us-west-2b"
  })
}

# Route table association for secondary public subnet 2
resource "aws_route_table_association" "secondary_public_2" {
  provider       = aws.secondary
  subnet_id      = aws_subnet.secondary_public_2.id
  route_table_id = aws_route_table.secondary_public.id
}


