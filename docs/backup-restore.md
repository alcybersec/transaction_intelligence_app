# Backup & Restore Runbook

This document describes the backup and restore procedures for the Transaction Intelligence App.

## Overview

The backup system creates PostgreSQL database dumps with the following retention policy:
- **Daily backups**: Kept for 14 days
- **Weekly backups**: Kept for 8 weeks (created on Sundays)
- **Monthly backups**: Kept for 24 months (created on the 1st)

## Quick Commands

```bash
# Create a backup
make backup

# List available backups
make backup-list

# Restore from backup (interactive - requires confirmation)
make restore FILE=./backups/daily/txn_backup_20250129_120000.sql.gz

# Verify a backup without affecting production
make backup-verify FILE=./backups/daily/txn_backup_20250129_120000.sql.gz
```

## Backup Procedure

### Manual Backup

Run the backup script:

```bash
make backup
```

This will:
1. Create a compressed pg_dump in `./backups/daily/`
2. Copy to `./backups/weekly/` if today is Sunday
3. Copy to `./backups/monthly/` if today is the 1st
4. Apply retention policy (remove old backups)
5. Show backup statistics

### Automated Backups

For production, set up a cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/transaction_intelligence_app && make backup >> ./backups/backup.log 2>&1
```

### Backup to TrueNAS/Remote Storage

After running the local backup, sync to remote storage:

```bash
# Using rsync to TrueNAS
rsync -av --delete ./backups/ user@truenas:/mnt/pool/backups/txn-insight/

# Or using restic for encrypted backups
restic -r sftp:user@truenas:/mnt/pool/restic-repo backup ./backups/
```

### Backup Configuration

Environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `./backups` | Backup storage directory |
| `RETENTION_DAILY` | `14` | Days to keep daily backups |
| `RETENTION_WEEKLY` | `8` | Weeks to keep weekly backups |
| `RETENTION_MONTHLY` | `24` | Months to keep monthly backups |
| `POSTGRES_CONTAINER` | `txn_postgres` | PostgreSQL container name |
| `COMPRESS` | `true` | Compress backups with gzip |

## Restore Procedure

### Standard Restore

1. **List available backups**:
   ```bash
   make backup-list
   ```

2. **Stop the application** (optional but recommended for large restores):
   ```bash
   docker compose stop api worker
   ```

3. **Run the restore**:
   ```bash
   make restore FILE=./backups/daily/txn_backup_20250129_120000.sql.gz
   ```

4. **Confirm when prompted** (type `yes`)

The restore script will:
- Create a safety backup before restoring
- Stop dependent services (api, worker)
- Restore the database
- Verify the restore succeeded
- Restart services

### Restore to Fresh VM

For disaster recovery or migration:

1. **Set up a new environment**:
   ```bash
   git clone <repository>
   cd transaction_intelligence_app
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Start PostgreSQL only**:
   ```bash
   docker compose up -d postgres
   ```

3. **Run migrations** (creates schema):
   ```bash
   make db-migrate
   ```

4. **Restore data**:
   ```bash
   make restore FILE=/path/to/backup.sql.gz
   ```

5. **Start remaining services**:
   ```bash
   make up
   ```

6. **Verify the dashboard shows correct data**

### Verify Backup Integrity

Before relying on a backup for disaster recovery, verify it:

```bash
make backup-verify FILE=./backups/daily/txn_backup_20250129_120000.sql.gz
```

This creates a temporary database, restores the backup, checks table counts, and cleans up.

## Restore Drill Checklist

Perform this drill quarterly to ensure backups are working:

- [ ] Stop all services: `make down`
- [ ] Remove database volume: `docker volume rm transaction_intelligence_app_postgres_data`
- [ ] Start fresh: `make up`
- [ ] Run migrations: `make db-migrate`
- [ ] Restore latest backup: `make restore FILE=<latest_backup>`
- [ ] Verify dashboard loads with correct data
- [ ] Verify transaction list shows expected records
- [ ] Verify a specific transaction's evidence is accessible
- [ ] Document any issues and restore time
- [ ] Record drill completion date

## Troubleshooting

### Backup Fails

**Container not running**:
```bash
# Check container status
docker compose ps

# Start services
make up
```

**Disk space full**:
```bash
# Check disk usage
df -h

# Manually clean old backups
rm ./backups/daily/txn_backup_2024*.sql.gz
```

### Restore Fails

**Permission denied**:
```bash
chmod +x scripts/restore.sh
```

**Database connection refused**:
```bash
# Ensure postgres is healthy
docker compose exec postgres pg_isready
```

**Restore corrupted**:
```bash
# Restore from the safety backup created before the failed restore
make restore FILE=./backups/pre-restore/pre_restore_YYYYMMDD_HHMMSS.sql.gz
```

### Data Integrity Issues After Restore

If data appears corrupted after restore:

1. Check the safety backup exists
2. Re-restore from the safety backup
3. Try an older backup
4. If all backups are affected, contact support

## Security Considerations

1. **Backup files contain sensitive data** - encrypted raw message bodies are in the dump
2. **Store backups securely** - use encrypted storage for remote backups
3. **Limit access** - only admins should have access to backup files
4. **Encryption key required** - the `ENCRYPTION_KEY` must match for decryption to work
5. **Keep ENCRYPTION_KEY backed up separately** - without it, encrypted fields cannot be read

## Recovery Time Objectives

| Scenario | Target RTO | Notes |
|----------|-----------|-------|
| Service restart | < 5 min | `make up` |
| Restore from local backup | < 15 min | Depends on DB size |
| Restore from remote backup | < 30 min | Add transfer time |
| Full disaster recovery | < 1 hour | New VM setup + restore |

## Backup Storage Locations

Default structure:
```
./backups/
├── daily/           # Last 14 days
├── weekly/          # Last 8 weeks
├── monthly/         # Last 24 months
└── pre-restore/     # Safety backups before each restore
```

Recommended remote backup locations:
- TrueNAS dataset: `/mnt/pool/backups/txn-insight/`
- Restic repository (encrypted)
- Cloud storage (S3, Backblaze B2) for off-site
