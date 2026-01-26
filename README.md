# Transaction Intelligence App

A self-hosted, dockerized app that ingests Android SMS (via Tasker) and ProtonMail email (via Proton Mail Bridge IMAP), extracts and stores card/account transactions, and serves a modern PWA banking-style UI for analytics, budgeting, exports, and optional local-only AI features via Ollama.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Make (optional, for convenience commands)

### Setup

1. Clone the repository and navigate to the project directory

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your configuration (especially secrets for production)

4. Start all services:
   ```bash
   make up
   ```
   Or without make:
   ```bash
   docker compose up -d
   ```

5. Access the application:
   - **Frontend**: http://localhost:5174
   - **API Docs**: http://localhost:8001/docs
   - **API Health**: http://localhost:8001/health

### Development Commands

```bash
make up          # Start all services
make down        # Stop all services
make logs        # Tail logs from all services
make build       # Rebuild all containers
make db-migrate  # Run database migrations
make test        # Run all tests
make lint        # Run linters
make clean       # Remove containers and volumes
```

### Running Tests

```bash
# All tests
make test

# Backend only
make test-backend

# Frontend only
make test-frontend

# Worker only
make test-worker
```

### Running Linters

```bash
# All linters
make lint

# Backend only (ruff)
make lint-backend

# Frontend only (eslint)
make lint-frontend
```

## Project Structure

```
├── backend/          # FastAPI backend API
│   ├── app/          # Application code
│   ├── tests/        # Backend tests
│   └── alembic/      # Database migrations
├── frontend/         # React + Vite PWA
│   └── src/          # Frontend source code
├── worker/           # Background job worker
│   ├── app/          # Worker code
│   └── tests/        # Worker tests
├── migrations/       # Shared migration scripts
├── docs/             # Documentation
└── docker-compose.yml
```

## Architecture

### Services

- **api**: FastAPI backend serving REST endpoints
- **worker**: Background job processor (RQ) + IMAP email ingestion
- **postgres**: PostgreSQL database
- **redis**: Queue and caching
- **frontend**: React PWA with Vite

### External Dependencies

- **Proton Mail Bridge**: Runs on host OS, worker connects via IMAP
- **Ollama** (optional): LAN-accessible for AI features

## License

MIT
