#!/bin/bash
# Transaction Intelligence App - Database Restore Script
# Restores database from a pg_dump backup file

set -euo pipefail

# Configuration
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-txn_postgres}"
POSTGRES_USER="${POSTGRES_USER:-txnuser}"
POSTGRES_DB="${POSTGRES_DB:-txndb}"

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

usage() {
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Arguments:"
    echo "  backup_file    Path to the backup file (.sql or .sql.gz)"
    echo ""
    echo "Examples:"
    echo "  $0 ./backups/daily/txn_backup_20250129_120000.sql.gz"
    echo "  $0 ./backups/monthly/txn_backup_20250101_000000.sql"
    echo ""
    echo "Environment variables:"
    echo "  POSTGRES_CONTAINER  Container name (default: txn_postgres)"
    echo "  POSTGRES_USER       Database user (default: txnuser)"
    echo "  POSTGRES_DB         Database name (default: txndb)"
    exit 1
}

# Check if postgres container is running
check_postgres() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
        exit 1
    fi
    log_info "PostgreSQL container is running"
}

# Validate backup file
validate_backup() {
    local backup_file="$1"

    if [ ! -f "${backup_file}" ]; then
        log_error "Backup file not found: ${backup_file}"
        exit 1
    fi

    local file_size=$(du -h "${backup_file}" | cut -f1)
    log_info "Backup file: ${backup_file} (${file_size})"
}

# Create pre-restore backup
create_safety_backup() {
    local safety_dir="./backups/pre-restore"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local safety_file="${safety_dir}/pre_restore_${timestamp}.sql.gz"

    mkdir -p "${safety_dir}"

    log_info "Creating safety backup before restore..."
    docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" --clean --if-exists | gzip > "${safety_file}"
    log_info "Safety backup created: ${safety_file}"

    echo "${safety_file}"
}

# Stop dependent services
stop_dependent_services() {
    log_warn "Stopping dependent services (api, worker)..."
    docker compose stop api worker 2>/dev/null || true
    sleep 2
}

# Restart dependent services
restart_dependent_services() {
    log_info "Restarting dependent services..."
    docker compose start api worker 2>/dev/null || true
}

# Perform the restore
perform_restore() {
    local backup_file="$1"

    log_info "Starting database restore..."

    # Determine if file is compressed
    if [[ "${backup_file}" == *.gz ]]; then
        log_info "Decompressing and restoring..."
        gunzip -c "${backup_file}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --quiet
    else
        log_info "Restoring uncompressed backup..."
        docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --quiet < "${backup_file}"
    fi

    log_info "Database restore completed"
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."

    # Check table counts
    local tables=$(docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    tables=$(echo "${tables}" | tr -d ' ')

    if [ "${tables}" -gt 0 ]; then
        log_info "Restore verified: ${tables} tables present"

        # Show row counts for key tables
        echo ""
        log_info "Table row counts:"
        for table in messages transaction_groups vendors categories users wallets instruments institutions; do
            local count=$(docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "N/A")
            count=$(echo "${count}" | tr -d ' ')
            echo "  ${table}: ${count}"
        done
    else
        log_error "Restore verification failed: no tables found"
        exit 1
    fi
}

# Main execution
main() {
    if [ $# -lt 1 ]; then
        usage
    fi

    local backup_file="$1"

    log_info "Starting Transaction Intelligence App restore..."
    log_warn "WARNING: This will overwrite all existing data!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "${confirm}" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    check_postgres
    validate_backup "${backup_file}"

    local safety_backup=$(create_safety_backup)

    stop_dependent_services

    if perform_restore "${backup_file}"; then
        verify_restore
        restart_dependent_services
        echo ""
        log_info "Restore completed successfully!"
        log_info "Safety backup available at: ${safety_backup}"
    else
        log_error "Restore failed!"
        log_warn "Attempting to restore from safety backup..."
        perform_restore "${safety_backup}"
        restart_dependent_services
        exit 1
    fi
}

# Run main function
main "$@"
