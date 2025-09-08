# Outputs for Apex Data API Multi-Region Infrastructure

# CloudFront Distribution
output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.apex_api.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.apex_api.id
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID for Route 53 aliases"
  value       = aws_cloudfront_distribution.apex_api.hosted_zone_id
}

# Application Load Balancers
output "primary_alb_dns_name" {
  description = "Primary ALB DNS name"
  value       = aws_lb.primary.dns_name
}

output "primary_alb_zone_id" {
  description = "Primary ALB zone ID for Route 53 aliases"
  value       = aws_lb.primary.zone_id
}

output "secondary_alb_dns_name" {
  description = "Secondary ALB DNS name"
  value       = aws_lb.secondary.dns_name
}

output "secondary_alb_zone_id" {
  description = "Secondary ALB zone ID for Route 53 aliases"
  value       = aws_lb.secondary.zone_id
}

# RDS Database Instances
output "primary_rds_endpoint" {
  description = "Primary RDS instance endpoint"
  value       = aws_db_instance.primary.endpoint
  sensitive   = true
}

output "primary_rds_port" {
  description = "Primary RDS instance port"
  value       = aws_db_instance.primary.port
}

output "secondary_rds_endpoint" {
  description = "Secondary RDS instance endpoint"
  value       = aws_db_instance.secondary.endpoint
  sensitive   = true
}

output "secondary_rds_port" {
  description = "Secondary RDS instance port"
  value       = aws_db_instance.secondary.port
}

output "rds_master_user_secret_arn" {
  description = "ARN of the master user secret for RDS"
  value       = aws_db_instance.primary.master_user_secret[0].secret_arn
  sensitive   = true
}

output "primary_rds_identifier" {
  description = "Primary RDS instance identifier"
  value       = aws_db_instance.primary.identifier
}

output "secondary_rds_identifier" {
  description = "Secondary RDS instance identifier"
  value       = aws_db_instance.secondary.identifier
}

# VPC and Networking
output "primary_vpc_id" {
  description = "Primary VPC ID"
  value       = aws_vpc.primary.id
}

output "primary_vpc_cidr" {
  description = "Primary VPC CIDR block"
  value       = aws_vpc.primary.cidr_block
}

output "secondary_vpc_id" {
  description = "Secondary VPC ID"
  value       = aws_vpc.secondary.id
}

output "secondary_vpc_cidr" {
  description = "Secondary VPC CIDR block"
  value       = aws_vpc.secondary.cidr_block
}

# Subnet IDs
output "primary_public_subnet_ids" {
  description = "Primary region public subnet IDs"
  value       = [aws_subnet.primary_public_1.id, aws_subnet.primary_public_2.id]
}

output "secondary_public_subnet_ids" {
  description = "Secondary region public subnet IDs"
  value       = [aws_subnet.secondary_public_1.id, aws_subnet.secondary_public_2.id]
}

# Security Groups
output "primary_alb_security_group_id" {
  description = "Primary ALB security group ID"
  value       = aws_security_group.alb_primary.id
}

output "secondary_alb_security_group_id" {
  description = "Secondary ALB security group ID"
  value       = aws_security_group.alb_secondary.id
}

output "primary_rds_security_group_id" {
  description = "Primary RDS security group ID"
  value       = aws_security_group.rds_primary.id
}

output "secondary_rds_security_group_id" {
  description = "Secondary RDS security group ID"
  value       = aws_security_group.rds_secondary.id
}

# ElastiCache Redis Clusters
output "primary_redis_endpoint" {
  description = "Primary Redis cluster endpoint"
  value       = aws_elasticache_replication_group.primary.configuration_endpoint_address
  sensitive   = true
}

output "primary_redis_port" {
  description = "Primary Redis cluster port"
  value       = 6379
}

output "secondary_redis_endpoint" {
  description = "Secondary Redis cluster endpoint"
  value       = aws_elasticache_replication_group.secondary.configuration_endpoint_address
  sensitive   = true
}

output "secondary_redis_port" {
  description = "Secondary Redis cluster port"
  value       = 6379
}

output "primary_redis_auth_token" {
  description = "Primary Redis cluster auth token"
  value       = aws_elasticache_replication_group.primary.auth_token
  sensitive   = true
}

output "secondary_redis_auth_token" {
  description = "Secondary Redis cluster auth token"
  value       = aws_elasticache_replication_group.secondary.auth_token
  sensitive   = true
}

# S3 Buckets
output "primary_alb_logs_bucket" {
  description = "Primary ALB access logs S3 bucket name"
  value       = aws_s3_bucket.alb_logs.id
}

output "secondary_alb_logs_bucket" {
  description = "Secondary ALB access logs S3 bucket name"
  value       = aws_s3_bucket.alb_logs_secondary.id
}

# Monitoring
output "rds_monitoring_role_arn_primary" {
  description = "RDS Enhanced Monitoring role ARN for primary region"
  value       = aws_iam_role.rds_monitoring.arn
}

output "rds_monitoring_role_arn_secondary" {
  description = "RDS Enhanced Monitoring role ARN for secondary region"
  value       = aws_iam_role.rds_monitoring_secondary.arn
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "regions" {
  description = "AWS regions used in this deployment"
  value = {
    primary   = "us-east-1"
    secondary = "us-west-2"
  }
}
