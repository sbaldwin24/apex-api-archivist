#!/bin/bash

# NASCAR Data API - Database Backup Script
# This script creates automated database backups with rotation

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
DATE_FORMAT=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/backup.log"

# Database connection parameters (from environment)
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-nascar_prod}
DB_USER=${POSTGRES_USER:-nascar_user}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to create database backup
create_backup() {
  local backup_file="${BACKUP_DIR}/nascar_${DB_NAME}_${DATE_FORMAT}.sql"
  local compressed_backup="${backup_file}.gz"

  log "Starting database backup..."

  # Create the backup
  if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose --no-password --format=custom --compress=9 \
    --file="$backup_file" 2>>"$LOG_FILE"; then

    # Compress the backup
    if gzip "$backup_file"; then
      local size=$(du -h "$compressed_backup" | cut -f1)
      log "Backup completed successfully: $compressed_backup ($size)"
      echo "$compressed_backup"
    else
      log "ERROR: Failed to compress backup file"
      return 1
    fi
  else
    log "ERROR: Database backup failed"
    return 1
  fi
}

# Function to clean old backups
cleanup_old_backups() {
  log "Cleaning up backups older than $RETENTION_DAYS days..."

  local deleted_count=0

  # Find and delete old backups
  while IFS= read -r -d '' file; do
    rm "$file"
    log "Deleted old backup: $(basename "$file")"
    ((deleted_count++))
  done < <(find "$BACKUP_DIR" -name "nascar_*.sql.gz" -mtime +$RETENTION_DAYS -print0)

  log "Cleanup completed: $deleted_count old backups removed"
}

# Function to verify backup integrity
verify_backup() {
  local backup_file="$1"

  log "Verifying backup integrity..."

  if gzip -t "$backup_file" 2>/dev/null; then
    log "Backup integrity check passed"
    return 0
  else
    log "ERROR: Backup integrity check failed"
    return 1
  fi
}

# Function to upload backup to cloud storage (if configured)
upload_to_cloud() {
  local backup_file="$1"

  if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
    log "Uploading backup to S3..."

    if command -v aws &>/dev/null; then
      local s3_path
      s3_path="s3://${AWS_S3_BUCKET}/backups/$(basename "$backup_file")"

      if aws s3 cp "$backup_file" "$s3_path" 2>>"$LOG_FILE"; then
        log "Backup uploaded to S3: $s3_path"
      else
        log "WARNING: Failed to upload backup to S3"
      fi
    else
      log "WARNING: AWS CLI not available, skipping S3 upload"
    fi
  fi
}

# Function to send notification
send_notification() {
  local status="$1"
  local message="$2"

  # Slack notification
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local color
    case "$status" in
    "success") color="good" ;;
    "error") color="danger" ;;
    *) color="warning" ;;
    esac

    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"NASCAR API Database Backup\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" 2>/dev/null || true
  fi

  # Discord notification
  if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
    curl -s -X POST "$DISCORD_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{
                \"embeds\": [{
                    \"title\": \"NASCAR API Database Backup\",
                    \"description\": \"$message\",
                    \"color\": $(case "$status" in success) echo 65280 ;; error) echo 16711680 ;; *) echo 16776960 ;; esac),
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
                }]
            }" 2>/dev/null || true
  fi
}

# Main backup function
main() {
  log "=== Starting backup process ==="

  local backup_file
  local success=true

  # Create backup
  if backup_file=$(create_backup); then
    # Verify backup
    if verify_backup "$backup_file"; then
      # Upload to cloud if configured
      upload_to_cloud "$backup_file"

      # Cleanup old backups
      cleanup_old_backups

      # Send success notification
      local size
      size=$(du -h "$backup_file" | cut -f1)
      send_notification "success" "Database backup completed successfully. File: $(basename "$backup_file") ($size)"

      log "=== Backup process completed successfully ==="
    else
      success=false
      log "=== Backup process failed: integrity check failed ==="
    fi
  else
    success=false
    log "=== Backup process failed: backup creation failed ==="
  fi

  # Send error notification if backup failed
  if [[ "$success" != true ]]; then
    send_notification "error" "Database backup failed. Check logs for details."
    exit 1
  fi
}

# Handle script arguments
case "${1:-backup}" in
"backup")
  main
  ;;
"verify")
  if [[ $# -lt 2 ]]; then
    echo "Usage: $0 verify <backup_file>"
    exit 1
  fi
  verify_backup "$2"
  ;;
"cleanup")
  cleanup_old_backups
  ;;
"test-notification")
  send_notification "success" "This is a test notification from the backup script"
  ;;
*)
  echo "Usage: $0 {backup|verify <file>|cleanup|test-notification}"
  echo
  echo "Commands:"
  echo "  backup             - Create database backup (default)"
  echo "  verify <file>      - Verify backup file integrity"
  echo "  cleanup            - Clean up old backup files"
  echo "  test-notification  - Test notification system"
  exit 1
  ;;
esac
