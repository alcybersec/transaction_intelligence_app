.PHONY: up down logs db-migrate test lint build clean help

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
