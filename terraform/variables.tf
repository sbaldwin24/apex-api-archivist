# Variables for Apex Data API Multi-Region Infrastructure

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "db_instance_class" {
  description = "RDS instance class for both primary and secondary databases"
  type        = string
  default     = "db.r6g.large"
  
  validation {
    condition = can(regex("^db\\.(t3|t4g|r6g|r6i|r5|r5b|m6i|m5)\\.(micro|small|medium|large|xlarge|2xlarge|4xlarge|8xlarge|12xlarge|16xlarge|24xlarge)$", var.db_instance_class))
    error_message = "DB instance class must be a valid RDS instance type."
  }
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources (ALB, RDS)"
  type        = bool
  default     = false  # Set to true for production environments
}

variable "backup_retention_days" {
  description = "Number of days to retain automated database backups"
  type        = number
  default     = 14
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention days must be between 1 and 35."
  }
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights for RDS instances"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Amount of time in days to retain Performance Insights data"
  type        = number
  default     = 7
  
  validation {
    condition     = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be 7 (free tier) or a multiple of 31 up to 731 days."
  }
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for RDS primary instance"
  type        = bool
  default     = true
}

variable "cloudfront_price_class" {
  description = "CloudFront distribution price class"
  type        = string
  default     = "PriceClass_100"  # Use only North America and Europe edge locations
  
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "CloudFront price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

variable "enable_alb_access_logs" {
  description = "Enable ALB access logs"
  type        = bool
  default     = true
}

# Deprecated variable - kept for backwards compatibility
variable "db_password" {
  description = "Database password (deprecated - AWS Secrets Manager is now used instead)"
  type        = string
  sensitive   = true
  default     = null
}

# Common tags applied to all resources
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project         = "apex-api"
    Owner           = "apex-team"
    CostCenter      = "engineering"
    Repository      = "apex-api-archivist"
    TerraformManaged = "true"
  }
}
