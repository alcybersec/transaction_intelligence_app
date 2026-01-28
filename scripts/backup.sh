#!/bin/bash
# Transaction Intelligence App - Database Backup Script
# Creates timestamped pg_dump backups with retention policy

set -euo pipefail

# Configuration (can be overridden via environment)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAILY="${RETENTION_DAILY:-14}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-8}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-24}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-txn_postgres}"
POSTGRES_USER="${POSTGRES_USER:-txnuser}"
POSTGRES_DB="${POSTGRES_DB:-txndb}"
COMPRESS="${COMPRESS:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directories
setup_directories() {
    log_info "Setting up backup directories..."
    mkdir -p "${BACKUP_DIR}/daily"
    mkdir -p "${BACKUP_DIR}/weekly"
    mkdir -p "${BACKUP_DIR}/monthly"
}

# Check if postgres container is running
check_postgres() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
        exit 1
    fi
    log_info "PostgreSQL container is running"
}

# Create the backup
create_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local day_of_week=$(date '+%u')  # 1=Monday, 7=Sunday
    local day_of_month=$(date '+%d')
    local backup_file="txn_backup_${timestamp}"

    log_info "Creating database backup..."

    # Create the backup using pg_dump
    if [ "${COMPRESS}" = "true" ]; then
        backup_file="${backup_file}.sql.gz"
        docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" --clean --if-exists | gzip > "${BACKUP_DIR}/daily/${backup_file}"
    else
        backup_file="${backup_file}.sql"
        docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" --clean --if-exists > "${BACKUP_DIR}/daily/${backup_file}"
    fi

    local backup_size=$(du -h "${BACKUP_DIR}/daily/${backup_file}" | cut -f1)
    log_info "Backup created: ${backup_file} (${backup_size})"

    # Copy to weekly on Sundays (day 7)
    if [ "${day_of_week}" = "7" ]; then
        cp "${BACKUP_DIR}/daily/${backup_file}" "${BACKUP_DIR}/weekly/"
        log_info "Weekly backup copy created"
    fi

    # Copy to monthly on the 1st
    if [ "${day_of_month}" = "01" ]; then
        cp "${BACKUP_DIR}/daily/${backup_file}" "${BACKUP_DIR}/monthly/"
        log_info "Monthly backup copy created"
    fi

    echo "${BACKUP_DIR}/daily/${backup_file}"
}

# Apply retention policy
apply_retention() {
    log_info "Applying retention policy..."

    # Daily retention
    local daily_count=$(find "${BACKUP_DIR}/daily" -name "txn_backup_*" -type f | wc -l)
    if [ "${daily_count}" -gt "${RETENTION_DAILY}" ]; then
        local to_delete=$((daily_count - RETENTION_DAILY))
        log_info "Removing ${to_delete} old daily backup(s)..."
        find "${BACKUP_DIR}/daily" -name "txn_backup_*" -type f | sort | head -n "${to_delete}" | xargs rm -f
    fi

    # Weekly retention
    local weekly_count=$(find "${BACKUP_DIR}/weekly" -name "txn_backup_*" -type f | wc -l)
    if [ "${weekly_count}" -gt "${RETENTION_WEEKLY}" ]; then
        local to_delete=$((weekly_count - RETENTION_WEEKLY))
        log_info "Removing ${to_delete} old weekly backup(s)..."
        find "${BACKUP_DIR}/weekly" -name "txn_backup_*" -type f | sort | head -n "${to_delete}" | xargs rm -f
    fi

    # Monthly retention
    local monthly_count=$(find "${BACKUP_DIR}/monthly" -name "txn_backup_*" -type f | wc -l)
    if [ "${monthly_count}" -gt "${RETENTION_MONTHLY}" ]; then
        local to_delete=$((monthly_count - RETENTION_MONTHLY))
        log_info "Removing ${to_delete} old monthly backup(s)..."
        find "${BACKUP_DIR}/monthly" -name "txn_backup_*" -type f | sort | head -n "${to_delete}" | xargs rm -f
    fi

    log_info "Retention policy applied"
}

# Show backup statistics
show_stats() {
    echo ""
    log_info "Backup Statistics:"
    echo "  Daily backups:   $(find "${BACKUP_DIR}/daily" -name "txn_backup_*" -type f 2>/dev/null | wc -l) / ${RETENTION_DAILY}"
    echo "  Weekly backups:  $(find "${BACKUP_DIR}/weekly" -name "txn_backup_*" -type f 2>/dev/null | wc -l) / ${RETENTION_WEEKLY}"
    echo "  Monthly backups: $(find "${BACKUP_DIR}/monthly" -name "txn_backup_*" -type f 2>/dev/null | wc -l) / ${RETENTION_MONTHLY}"

    local total_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
    echo "  Total size:      ${total_size:-0}"
}

# Main execution
main() {
    log_info "Starting Transaction Intelligence App backup..."

    setup_directories
    check_postgres

    local backup_path=$(create_backup)
    apply_retention
    show_stats

    log_info "Backup completed successfully: ${backup_path}"
}

# Run main function
main "$@"
