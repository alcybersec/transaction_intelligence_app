.PHONY: up down logs db-migrate test lint build clean help backup restore backup-list monitoring monitoring-down

# Default target
help:
	@echo "Transaction Intelligence App - Development Commands"
	@echo ""
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - Tail logs from all services"
	@echo "  make build       - Rebuild all containers"
	@echo "  make db-migrate  - Run database migrations"
	@echo "  make test        - Run all tests"
	@echo "  make lint        - Run linters"
	@echo "  make clean       - Remove containers and volumes"
	@echo ""
	@echo "Backup & Restore:"
	@echo "  make backup      - Create database backup"
	@echo "  make backup-list - List available backups"
	@echo "  make restore FILE=<path> - Restore from backup file"
	@echo ""
	@echo "Monitoring (optional):"
	@echo "  make monitoring      - Start Prometheus + Grafana"
	@echo "  make monitoring-down - Stop monitoring services"
	@echo ""

# Start all services
up:
	docker compose up -d
	@echo "Services started. API: http://localhost:8001 | Frontend: http://localhost:5174"

# Stop all services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Rebuild containers
build:
	docker compose build

# Run database migrations
db-migrate:
	docker compose exec api alembic upgrade head

# Run all tests
test: test-backend test-frontend test-worker

test-backend:
	docker compose exec api pytest -v

test-frontend:
	docker compose exec frontend npm test -- --run

test-worker:
	docker compose exec worker pytest -v

# Run linters
lint: lint-backend lint-frontend lint-worker

lint-backend:
	docker compose exec api ruff check .
	docker compose exec api ruff format --check .

lint-frontend:
	docker compose exec frontend npm run lint

lint-worker:
	docker compose exec worker ruff check .
	docker compose exec worker ruff format --check .

# Format code
format:
	docker compose exec api ruff format .
	docker compose exec worker ruff format .
	docker compose exec frontend npm run format

# Clean up everything
clean:
	docker compose down -v --remove-orphans
	@echo "Containers and volumes removed"

# Initialize a fresh .env file from example
init-env:
	@if [ ! -f .env ]; then cp .env.example .env; echo ".env created from .env.example"; else echo ".env already exists"; fi

# Shell access
shell-api:
	docker compose exec api /bin/sh

shell-worker:
	docker compose exec worker /bin/sh

shell-db:
	docker compose exec postgres psql -U txnuser -d txndb

# Backup & Restore
backup:
	@chmod +x scripts/backup.sh
	@./scripts/backup.sh

backup-list:
	@chmod +x scripts/backup-list.sh
	@./scripts/backup-list.sh

restore:
ifndef FILE
	@echo "Usage: make restore FILE=./backups/daily/txn_backup_YYYYMMDD_HHMMSS.sql.gz"
	@exit 1
endif
	@chmod +x scripts/restore.sh
	@./scripts/restore.sh $(FILE)

# Verify backup can be restored (creates temp DB, restores, checks, destroys)
backup-verify:
ifndef FILE
	@echo "Usage: make backup-verify FILE=./backups/daily/txn_backup_YYYYMMDD_HHMMSS.sql.gz"
	@exit 1
endif
	@echo "Creating temporary verification database..."
	@docker compose exec postgres psql -U txnuser -d postgres -c "DROP DATABASE IF EXISTS txndb_verify;"
	@docker compose exec postgres psql -U txnuser -d postgres -c "CREATE DATABASE txndb_verify;"
	@echo "Restoring backup to verification database..."
	@if echo "$(FILE)" | grep -q ".gz$$"; then \
		gunzip -c $(FILE) | docker compose exec -T postgres psql -U txnuser -d txndb_verify --quiet; \
	else \
		docker compose exec -T postgres psql -U txnuser -d txndb_verify --quiet < $(FILE); \
	fi
	@echo "Checking table counts..."
	@docker compose exec postgres psql -U txnuser -d txndb_verify -c "SELECT tablename, (xpath('/row/cnt/text()', query_to_xml('SELECT COUNT(*) AS cnt FROM ' || tablename, false, false, '')))[1]::text::int AS row_count FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
	@docker compose exec postgres psql -U txnuser -d postgres -c "DROP DATABASE txndb_verify;"
	@echo "Backup verification completed successfully!"

# Monitoring (Prometheus + Grafana)
monitoring:
	docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana
	@echo "Monitoring started. Prometheus: http://localhost:9090 | Grafana: http://localhost:3000"

monitoring-down:
	docker compose -f docker-compose.yml -f docker-compose.monitoring.yml down prometheus grafana
	@echo "Monitoring services stopped"

# Start all services including monitoring
up-full:
	docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
	@echo "All services started including monitoring"
