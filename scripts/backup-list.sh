#!/bin/bash
# Transaction Intelligence App - List Available Backups
# Shows all available backups with size and age information

BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_backups() {
    local dir="$1"
    local type="$2"
    local color="$3"

    echo -e "${color}${type} Backups:${NC}"
    if [ -d "${dir}" ] && [ "$(ls -A ${dir} 2>/dev/null)" ]; then
        ls -lht "${dir}" | grep "txn_backup_" | while read line; do
            echo "  ${line}"
        done
    else
        echo "  (none)"
    fi
    echo ""
}

echo ""
echo "Transaction Intelligence App - Available Backups"
echo "================================================="
echo ""

show_backups "${BACKUP_DIR}/daily" "Daily" "${GREEN}"
show_backups "${BACKUP_DIR}/weekly" "Weekly" "${YELLOW}"
show_backups "${BACKUP_DIR}/monthly" "Monthly" "${CYAN}"
show_backups "${BACKUP_DIR}/pre-restore" "Pre-Restore Safety" "${YELLOW}"

# Total size
if [ -d "${BACKUP_DIR}" ]; then
    total_size=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
    echo "Total backup storage: ${total_size:-0}"
fi
