# Apex Data API Multi-Region Infrastructure

This Terraform configuration deploys a highly available, multi-region Apex Data
API infrastructure on AWS with the following components:

## Architecture Overview

### Core Components

- **CloudFront Distribution**: Global CDN with optimized caching policies
- **Application Load Balancers**: Primary (us-east-1) and secondary (us-west-2)
  regions
- **RDS PostgreSQL**: Primary database with cross-region read replica
  (PostgreSQL 17.2)
- **ElastiCache Redis**: High-availability Redis clusters in both regions (Redis
  7.2)
- **VPC Networking**: Isolated networks in both regions with proper routing
- **Security Groups**: Least privilege access controls
- **S3 Buckets**: ALB access logs storage
- **IAM Roles**: RDS Enhanced Monitoring

### Key Features

- **Modern Configuration**: Uses AWS provider 5.x with current best practices
- **Security**: AWS Secrets Manager for database passwords, encrypted storage,
  Redis auth tokens
- **Monitoring**: RDS Enhanced Monitoring and Performance Insights
- **High Availability**: Multi-AZ RDS and ElastiCache deployments with
  cross-region replication
- **Performance**: CloudFront with managed cache policies, gp3 storage, and
  optimized Redis clusters
- **Compliance**: Comprehensive tagging and access logging
- **Latest Versions**: PostgreSQL 17.2, Redis 7.2 (ElastiCache), Docker Redis
  8.2.x

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Terraform >= 1.0** installed
3. **AWS permissions** for all resource types being created
4. **S3 backend** (optional but recommended for team environments)

## Quick Start

1. **Clone and navigate to terraform directory**:

   ```bash
   cd terraform/
   ```

2. **Copy and customize variables**:

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your desired values
   ```

3. **Initialize Terraform**:

   ```bash
   terraform init
   ```

4. **Plan the deployment**:

   ```bash
   terraform plan
   ```

5. **Apply the configuration**:
   ```bash
   terraform apply
   ```

## Configuration Files

- **`multi-region.tf`**: Main infrastructure resources
- **`variables.tf`**: Variable definitions with validation
- **`outputs.tf`**: Output values for integration
- **`terraform.tfvars.example`**: Example variable values
- **`README.md`**: This documentation

## Key Variables

### Environment Configuration

```hcl
environment = "dev"  # dev, staging, or prod
```

### Database Configuration

```hcl
db_instance_class       = "db.r6g.large"    # Instance size
backup_retention_days   = 14                # Backup retention
enable_deletion_protection = false          # Set true for production
```

### Cache Configuration

```hcl
redis_node_type        = "cache.r7g.large"  # ElastiCache instance size
redis_engine_version   = "7.2"              # Latest supported version
redis_num_cache_nodes  = 2                  # High availability
```

### Performance Settings

```hcl
enable_performance_insights = true
performance_insights_retention_period = 7   # 7 days free, 31+ paid
enable_multi_az = true                       # High availability
```

## Security Considerations

### Database Security

- **AWS Secrets Manager**: Automatic password management and rotation
- **Encryption**: All storage encrypted at rest
- **Network Isolation**: Database only accessible from ALB security groups
- **Cross-region replication**: Encrypted in transit

### Network Security

- **VPC Isolation**: Separate VPCs per region
- **Security Groups**: Least privilege access
- **ALB**: HTTPS redirect enforced
- **CloudFront**: TLS 1.2+ required

### Access Logging

- **ALB Access Logs**: Stored in S3 with proper bucket policies
- **CloudFront Logs**: Available for analysis
- **RDS Monitoring**: Enhanced monitoring enabled

## Cost Optimization

### Instance Sizing

- **Development**: `db.t3.medium` or `db.r6g.large`
- **Production**: `db.r6g.xlarge` or larger based on workload

### CloudFront Pricing

- **PriceClass_100**: North America and Europe only (cost-effective)
- **PriceClass_All**: Global distribution (higher cost)

### Storage

- **gp3**: Performance and cost optimized
- **Automated scaling**: Prevents over-provisioning

## Monitoring and Alerts

### Built-in Monitoring

- **RDS Enhanced Monitoring**: 60-second granularity
- **Performance Insights**: Query-level visibility
- **CloudWatch Integration**: Automatic metrics collection

### Recommended Additions

- **CloudWatch Alarms**: CPU, memory, connection thresholds
- **SNS Topics**: Alert notifications
- **CloudWatch Dashboards**: Operational visibility

## Maintenance

### Regular Tasks

1. **Monitor RDS storage**: Auto-scaling prevents issues
2. **Review CloudFront cache hit ratios**: Optimize caching
3. **Check ALB access logs**: Identify patterns and issues
4. **Update engine versions**: Apply security patches

### Backup Strategy

- **Automated backups**: 14-day retention (configurable)
- **Final snapshots**: Created before deletion
- **Cross-region**: Read replica provides additional protection

## Disaster Recovery

### Multi-Region Setup

- **Primary Region**: us-east-1 (full stack)
- **Secondary Region**: us-west-2 (read replica)
- **CloudFront**: Global distribution for availability

### Failover Process

1. **Database**: Promote read replica to master
2. **Application**: Update connection strings
3. **DNS**: Update CloudFront origin to secondary ALB
4. **Monitoring**: Verify application functionality

## Upgrading

### PostgreSQL Version Updates

The configuration uses PostgreSQL 17.2 (latest supported by AWS RDS). To
upgrade:

1. **Test in development environment first**
2. **Update `engine_version` in the configuration**
3. **Plan and apply during maintenance window**
4. **Verify application compatibility**

**Note**: AWS RDS typically supports the latest PostgreSQL versions within a few
months of release. Check the
[AWS RDS PostgreSQL Release Notes](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/)
for the most current supported versions.

### Terraform Version Updates

1. **Review provider changelog**
2. **Update version constraints**
3. **Test in development environment**
4. **Apply to production**

## Troubleshooting

### Common Issues

1. **RDS Connection Issues**
   - Check security group rules
   - Verify subnet group configuration
   - Confirm database is in available state

2. **CloudFront Cache Issues**
   - Review cache behaviors and policies
   - Check origin connectivity
   - Verify SSL certificates

3. **ALB Health Check Failures**
   - Confirm target group configuration
   - Check application health endpoints
   - Review security group rules

### Getting Help

1. **AWS Support**: For AWS-specific issues
2. **Terraform Documentation**: For configuration syntax
3. **Application Logs**: For application-specific problems

## Contributing

When modifying this infrastructure:

1. **Follow naming conventions**: Use consistent resource naming with
   apex-prefix
2. **Add proper tags**: Ensure all resources are tagged with Apex branding
3. **Document changes**: Update this README for significant changes
4. **Test thoroughly**: Use development environment first
5. **Review security**: Ensure no security regressions

## Outputs

After successful deployment, the following outputs are available:

- **CloudFront domain**: For application access
- **RDS endpoints**: For application configuration
- **VPC/subnet IDs**: For additional resource deployment
- **Security group IDs**: For integration with other services

Use `terraform output` to view all available outputs.
