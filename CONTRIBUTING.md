# Contributing to Transaction Intelligence App

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Make (optional, for convenience commands)
- Git

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/transaction_intelligence_app.git
   cd transaction_intelligence_app
   ```

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your local configuration (the defaults work for development).

4. Start all services:
   ```bash
   make up
   ```

5. Verify everything is running:
   - **Frontend**: http://localhost:5174
   - **API Docs**: http://localhost:8001/docs

## Running Tests

```bash
# All tests
make test

# Backend only (pytest)
make test-backend

# Frontend only (Vitest)
make test-frontend

# Worker only
make test-worker
```

## Running Linters

```bash
# All linters
make lint

# Backend only (ruff)
make lint-backend

# Frontend only (ESLint)
make lint-frontend

# Auto-format all code
make format
```

## Branch and PR Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes, ensuring tests pass and linters are clean.

3. Push your branch and open a Pull Request against `main`.

4. Fill out the PR template — describe your changes, confirm tests pass, and note any migration or config changes.

## Commit Message Conventions

This project uses conventional-style commit prefixes:

- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructuring without behavior change
- `docs:` — Documentation changes
- `test:` — Adding or updating tests
- `chore:` — Build, CI, or tooling changes

Examples:
```
feat: Add SMS parsing for BankX notifications
fix: Correct date parsing for email transactions
docs: Update Tasker setup guide
```

## Code Style

- **Python**: Formatted and linted with [Ruff](https://docs.astral.sh/ruff/) (line length 100)
- **TypeScript/React**: Formatted with [Prettier](https://prettier.io/) and linted with [ESLint](https://eslint.org/)

Run `make format` before committing to auto-format all code.

## Adding a Bank Adapter

One of the most valuable contributions is adding support for new banks. The adapter system is pluggable and designed to make this straightforward.

See the [Bank Adapter Guide](docs/add-bank-adapter.md) for detailed instructions on:
- Adapter structure and protocols
- Parser implementation
- Testing your adapter

## Database Migrations

If your changes require database schema modifications:

1. Make your model changes in `backend/app/db/models/`.
2. Generate a migration:
   ```bash
   make db-migrate
   ```
3. Review the generated migration in `backend/alembic/versions/`.
4. Include the migration file in your PR.

## Questions?

Open an issue if you have questions about contributing. We're happy to help you get started.
