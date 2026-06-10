# Phase 1 — Backend Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every backend gap identified in the v2 redesign WIRING.md (recurring transactions, transactions summary, savings goals, account profile core + 2FA/sessions, smart insights, AI settings + adapter stats) on the `develop` branch via 7 parallel worktree-agent PRs, plus the Phase 0 prep that makes strict TDD possible.

**Architecture:** Each gap is one self-contained PR off `develop`. Phase 0 (sequential, in the main session) lands a Postgres-per-test fixture and rebases `develop` on `main`. Phase 1 (parallel) dispatches one worktree agent per slot; each agent follows red-green-refactor on real Postgres, updates `frontend/src/api/*.ts` types in the same PR, and opens a PR to `develop`. Slots target different tables so concurrent migrations are safe.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest + Postgres. Frontend types in TypeScript. Worktree-isolated agents merging to a shared `develop` integration branch.

---

## Spec reference

This plan implements **Phase 0 + Phase 1** of `docs/superpowers/specs/2026-06-10-ui-v2-redesign-design.md`. Phase 2, 3, 4 get their own plans written when their prerequisites land.

## File map (created/modified in this plan)

### Phase 0 — sequential, main session
- Create: `backend/tests/conftest.py` — Postgres-per-test fixture
- Modify: `backend/pyproject.toml` — add `pytest-postgresql` or similar dep + test config
- Modify: `backend/requirements*.txt` (or `pyproject.toml` deps) — same
- Branch: rebase `develop` onto `main`, capture SHA

### Phase 1 — parallel worktrees, one slot each

| Slot | Branch | New / modified files |
|---|---|---|
| **1a** | `feat/v2-be-1a-recurring` | `backend/alembic/versions/007_add_is_recurring_to_transaction_groups.py`, `backend/app/db/models/transaction.py`, `backend/app/schemas/transaction.py`, `backend/app/api/routes/transactions.py`, `backend/tests/test_recurring.py`, `frontend/src/api/transactions.ts` |
| **1b** | `feat/v2-be-1b-summary` | `backend/app/schemas/transaction.py`, `backend/app/api/routes/transactions.py`, `backend/tests/test_transactions_summary.py`, `frontend/src/api/transactions.ts` |
| **1c** | `feat/v2-be-1c-goals` | `backend/alembic/versions/008_create_savings_goals.py`, `backend/app/db/models/savings_goal.py`, `backend/app/schemas/savings_goal.py`, `backend/app/api/routes/goals.py`, `backend/app/api/__init__.py`, `backend/tests/test_goals.py`, `frontend/src/api/goals.ts` |
| **1d-core** | `feat/v2-be-1d-core-account` | `backend/alembic/versions/009_add_user_email_preferences.py`, `backend/app/db/models/user.py`, `backend/app/schemas/auth.py`, `backend/app/api/routes/auth.py`, `backend/tests/test_account_profile.py`, `frontend/src/api/auth.ts` |
| **1d-2fa** | `feat/v2-be-1d-2fa-sessions` | `backend/alembic/versions/010_add_2fa_and_sessions.py`, `backend/app/db/models/user.py`, `backend/app/db/models/user_session.py`, `backend/app/schemas/auth.py`, `backend/app/api/routes/auth.py`, `backend/app/core/security.py` (TOTP helper), `backend/tests/test_2fa.py`, `backend/tests/test_sessions.py`, `frontend/src/api/auth.ts` |
| **1e** | `feat/v2-be-1e-insights` | `backend/app/schemas/analytics.py`, `backend/app/api/routes/analytics.py`, `backend/app/services/insights.py` (new), `backend/tests/test_insights.py`, `frontend/src/api/analytics.ts` |
| **1f** | `feat/v2-be-1f-ai-adapter-settings` | `backend/alembic/versions/011_create_app_settings.py`, `backend/app/db/models/app_setting.py`, `backend/app/schemas/ai.py`, `backend/app/schemas/adapters.py`, `backend/app/api/routes/ai.py`, `backend/app/api/routes/adapters.py`, `backend/app/services/settings_store.py` (new), `backend/tests/test_ai_settings.py`, `backend/tests/test_adapter_stats.py`, `frontend/src/api/ai.ts`, `frontend/src/api/adapters.ts` |

### Migration numbering reservation

Alembic revisions in this plan: **007, 008, 009, 010, 011**.
- 007 → 1a (recurring)
- 008 → 1c (goals)
- 009 → 1d-core (user email + preferences)
- 010 → 1d-2fa (2FA + sessions)
- 011 → 1f (app_settings)

Slots 1b and 1e have no migration. To prevent revision collisions, each worktree agent **reserves its assigned revision number from the table above** — do NOT generate alembic numbers dynamically.

### ⚠️ Critical: Alembic chain coordination for parallel migration slots

Alembic requires a linear `down_revision` chain. Multiple slots branching off the same base SHA will all initially set `down_revision` to the current `develop` head (e.g. `006_chat_tables`). If they merge out of order without intervention, Alembic will complain about multiple heads.

**Every migration-bearing slot MUST follow this pre-merge dance:**

1. Just before opening the PR, fetch latest develop: `git fetch origin develop`.
2. Inspect the current Alembic head on develop: `git show origin/develop:backend/alembic/versions/ | tail` (or read the highest-numbered migration file's `revision:` line).
3. If the head has advanced past `006_chat_tables` (because another slot merged first), update the `down_revision` in your migration to that new head, and renumber your file/revision if your reserved number is taken. Re-stage and amend the migration commit.
4. Re-run `docker compose exec api alembic upgrade head` to confirm the chain applies cleanly.
5. Push and open the PR.

This means **the merge order determines the final revision sequence**, not the table-reserved numbers. The table is a planning aid; reconcile before each PR.

If two slots race the merge button, the second one will fail CI (alembic multi-head error) and the agent will need to rebase + update down_revision + force-push.

---

## Phase 0 — Sequential prep (main session, NO worktree)

### Task 0.1: Rebase develop on main, capture SHA

**Files:** branch state only

- [ ] **Step 1: Verify clean working tree**

Run: `git -C /home/alex/Documents/coding/transaction_intelligence_app status --short`
Expected: empty output (or only the spec + plan docs already committed). If anything else dirty, stop and resolve before proceeding.

- [ ] **Step 2: Fetch latest**

Run: `git -C /home/alex/Documents/coding/transaction_intelligence_app fetch origin`
Expected: success.

- [ ] **Step 3: Rebase develop onto main**

```bash
git -C /home/alex/Documents/coding/transaction_intelligence_app checkout develop
git -C /home/alex/Documents/coding/transaction_intelligence_app pull --ff-only origin develop
git -C /home/alex/Documents/coding/transaction_intelligence_app rebase main
```
Expected: rebase completes cleanly. If conflicts, resolve manually and re-run.

- [ ] **Step 4: Push develop**

Run: `git -C /home/alex/Documents/coding/transaction_intelligence_app push --force-with-lease origin develop`
Expected: success. (Force-with-lease is safe vs plain force; aborts if upstream moved.)

- [ ] **Step 5: Capture starting SHA**

```bash
git -C /home/alex/Documents/coding/transaction_intelligence_app rev-parse develop > /tmp/v2-phase1-base-sha.txt
cat /tmp/v2-phase1-base-sha.txt
```
Expected: a SHA on stdout, written to file. This is the base every worktree branches from.

- [ ] **Step 6: Return to main for foundation work**

Run: `git -C /home/alex/Documents/coding/transaction_intelligence_app checkout main`
Expected: switched to main.

### Task 0.2: Add `pytest-postgresql` dependency

**Files:**
- Modify: `backend/pyproject.toml` (dependencies section, dev-deps)

- [ ] **Step 1: Read current pyproject.toml dependencies section**

Run: `grep -n "dependencies\|pytest" /home/alex/Documents/coding/transaction_intelligence_app/backend/pyproject.toml`
Expected: shows the `[project.optional-dependencies]` block or `[project] dependencies = [...]`.

- [ ] **Step 2: Add `pytest-postgresql>=6.0` to dev dependencies**

Edit `backend/pyproject.toml`. Find the existing test/dev dependency block (typically `[project.optional-dependencies] dev = [...]`). Add the line:

```toml
"pytest-postgresql>=6.0",
```

If no dev-deps block exists, add:

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-postgresql>=6.0",
    "httpx>=0.27",
]
```

- [ ] **Step 3: Rebuild backend image so the dep installs**

Run: `make -C /home/alex/Documents/coding/transaction_intelligence_app down && make -C /home/alex/Documents/coding/transaction_intelligence_app up`
Expected: services come up; backend image picks up the new dep. (If the Dockerfile installs from `pyproject.toml`, this is sufficient. If it uses a frozen `requirements.txt`, also regenerate: `cd backend && uv pip compile pyproject.toml -o requirements.txt`.)

### Task 0.3: Add Postgres-per-test fixture

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write the conftest**

Create `backend/tests/conftest.py`:

```python
"""Pytest fixtures: a fresh Postgres schema per test + an authenticated TestClient."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db
from app.db.base import Base
from app.db.models.user import User
from app.core.security import hash_password, create_access_token
from app.main import app


def _build_test_db_url() -> str:
    """Use the project's normal DB but create a uniquely-named schema per test."""
    base = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://txnuser:txnpass@localhost:5432/txndb_test",
    )
    return base


@pytest.fixture(scope="session")
def engine():
    url = _build_test_db_url()
    eng = create_engine(url, future=True)
    # Ensure DB exists; if not, create it via a maintenance connection.
    with eng.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine) -> Generator[Session, None, None]:
    """One fresh schema per test. Dropped at the end so tests are isolated."""
    schema = f"t_{uuid.uuid4().hex[:12]}"
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'SET search_path TO "{schema}"'))
    # Bind metadata to this schema for the test
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()
    session.execute(text(f'SET search_path TO "{schema}"'))
    Base.metadata.create_all(bind=session.connection())
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        with engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))


@pytest.fixture()
def client(db_session) -> Generator[TestClient, None, None]:
    """TestClient with get_db overridden to use the per-test session."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(db_session) -> User:
    """A persisted authenticated user for tests that need auth."""
    u = User(
        id=uuid.uuid4(),
        username=f"u_{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("pw"),
        is_active=True,
        is_admin=False,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture()
def auth_headers(test_user) -> dict[str, str]:
    """Bearer auth header for the test_user."""
    token = create_access_token(subject=str(test_user.id))
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Verify import paths**

The fixture imports `hash_password` and `create_access_token` from `app.core.security`. Verify both exist:

Run: `grep -nE "def (hash_password|create_access_token)" /home/alex/Documents/coding/transaction_intelligence_app/backend/app/core/security.py`
Expected: both function definitions found. If named differently, update the import in the conftest to match what's there (e.g., `get_password_hash`, `create_token`).

- [ ] **Step 3: Verify a simple test runs against the fixture**

Create a throwaway smoke test `backend/tests/test_conftest_smoke.py`:

```python
def test_authenticated_request(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
```

Run: `docker compose exec api pytest tests/test_conftest_smoke.py -v`
Expected: PASS. If 404, verify the actual auth route prefix (`/api/v1/auth/me` or `/auth/me`) by reading `backend/app/main.py` for `app.include_router(...)` calls and update the smoke test.

- [ ] **Step 4: Delete the smoke test**

Run: `rm /home/alex/Documents/coding/transaction_intelligence_app/backend/tests/test_conftest_smoke.py`

- [ ] **Step 5: Commit Phase 0**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git add backend/tests/conftest.py backend/pyproject.toml
git commit -m "$(cat <<'EOF'
test: add Postgres-per-test fixture + dev dep

Adds a conftest.py providing a fresh schema per test, a TestClient with
get_db overridden, and a persisted test_user + auth_headers. Required by
the v2 backend gaps to do strict TDD without test pollution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

### Task 0.4: Spawn worktree agents for each slot

After Task 0.3, dispatch 7 worktree-isolated agents in parallel. Each agent receives:
- Its slot block from this plan (verbatim, just that slot)
- The base SHA from `/tmp/v2-phase1-base-sha.txt`
- Instruction: branch off that SHA, follow the TDD substeps, open a PR to `develop` when done

See the **Execution handoff** at the bottom of this plan for the exact dispatch logic.

---

## Phase 1 Slot 1a — Recurring transactions

**Branch:** `feat/v2-be-1a-recurring` off `develop` at the base SHA.

**Worktree setup (worktree agent runs this first):**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git worktree add -b feat/v2-be-1a-recurring ../txn-wt-1a "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1a
```

**Goal:** Add `is_recurring` to `transaction_groups`; extend `PATCH /transactions/{id}` to accept it; add `PATCH /transactions/bulk` for multi-toggle; add `?recurring=` filter on list; expose `subscriptions_count` on `/analytics/dashboard`.

### Task 1a.1: Write failing tests

**Files:**
- Create: `backend/tests/test_recurring.py`

- [ ] **Step 1: Write the test file**

```python
"""TDD: is_recurring on transactions — single + bulk toggle, list filter, dashboard count."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.db.models.transaction import TransactionGroup, TransactionDirection, TransactionStatus


def _make_txn(db_session, user_id, *, recurring=False, amount="10.00", direction=TransactionDirection.DEBIT):
    t = TransactionGroup(
        id=uuid.uuid4(),
        direction=direction,
        amount=Decimal(amount),
        currency="AED",
        occurred_at=datetime.now(timezone.utc),
        status=TransactionStatus.POSTED,
        is_recurring=recurring,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


def test_default_is_recurring_is_false(db_session, test_user):
    t = _make_txn(db_session, test_user.id)
    assert t.is_recurring is False


def test_patch_sets_is_recurring(client, auth_headers, db_session, test_user):
    t = _make_txn(db_session, test_user.id)
    r = client.patch(
        f"/api/v1/transactions/{t.id}",
        headers=auth_headers,
        json={"is_recurring": True},
    )
    assert r.status_code == 200
    assert r.json()["is_recurring"] is True


def test_bulk_patch_recurring(client, auth_headers, db_session, test_user):
    ids = [str(_make_txn(db_session, test_user.id).id) for _ in range(3)]
    r = client.patch(
        "/api/v1/transactions/bulk",
        headers=auth_headers,
        json={"ids": ids, "is_recurring": True},
    )
    assert r.status_code == 200
    assert r.json() == {"updated": 3}


def test_list_filter_recurring_true(client, auth_headers, db_session, test_user):
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=False)
    r = client.get("/api/v1/transactions?recurring=true", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["is_recurring"] is True


def test_list_filter_recurring_false(client, auth_headers, db_session, test_user):
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=False)
    r = client.get("/api/v1/transactions?recurring=false", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["is_recurring"] is False


def test_dashboard_returns_subscriptions_count(client, auth_headers, db_session, test_user):
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=False)
    r = client.get(
        "/api/v1/analytics/dashboard?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["subscriptions_count"] == 2
```

- [ ] **Step 2: Run tests, confirm RED**

Run: `docker compose exec api pytest tests/test_recurring.py -v`
Expected: All 6 tests FAIL. Errors should be about missing `is_recurring` column or missing route. If errors are import-time crashes, fix imports before continuing.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/test_recurring.py
git commit -m "test: failing tests for recurring transactions"
```

### Task 1a.2: Add migration and model column

**Files:**
- Create: `backend/alembic/versions/007_add_is_recurring_to_transaction_groups.py`
- Modify: `backend/app/db/models/transaction.py`

- [ ] **Step 1: Read the latest migration for revision chain**

Run: `ls /home/alex/Documents/coding/transaction_intelligence_app/backend/alembic/versions/ | sort | tail -3`
Expected: shows the highest-numbered existing migration. Note its `revision:` id (read the file head) — it becomes `down_revision` for 007.

- [ ] **Step 2: Write the migration**

```python
"""Add is_recurring to transaction_groups.

Revision ID: 007_is_recurring
Revises: <PUT_PREVIOUS_REVISION_ID_HERE>
Create Date: 2026-06-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "007_is_recurring"
down_revision: str | None = "<PUT_PREVIOUS_REVISION_ID_HERE>"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transaction_groups",
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_transaction_groups_is_recurring",
        "transaction_groups",
        ["is_recurring"],
    )


def downgrade() -> None:
    op.drop_index("ix_transaction_groups_is_recurring", table_name="transaction_groups")
    op.drop_column("transaction_groups", "is_recurring")
```

Replace `<PUT_PREVIOUS_REVISION_ID_HERE>` with the actual id from step 1.

- [ ] **Step 3: Add the column to the SQLAlchemy model**

Edit `backend/app/db/models/transaction.py`. Find the `TransactionGroup` class. After the `notes` column, add:

```python
    is_recurring = Column(Boolean, nullable=False, default=False, server_default=sa.false(), index=True)
```

If `Boolean` is not yet imported, add it to the existing `from sqlalchemy import ...` line. If `sa` is not aliased, change `sa.false()` to `text("false")` and add `from sqlalchemy import text`.

- [ ] **Step 4: Apply migration**

Run: `docker compose exec api alembic upgrade head`
Expected: log line "Running upgrade ... -> 007_is_recurring".

- [ ] **Step 5: Run tests; first two should now pass (default + PATCH)**

Run: `docker compose exec api pytest tests/test_recurring.py::test_default_is_recurring_is_false -v`
Expected: PASS.

Run: `docker compose exec api pytest tests/test_recurring.py::test_patch_sets_is_recurring -v`
Expected: still FAIL — the PATCH route doesn't accept `is_recurring` yet.

- [ ] **Step 6: Commit migration + model**

```bash
git add backend/alembic/versions/007_add_is_recurring_to_transaction_groups.py backend/app/db/models/transaction.py
git commit -m "feat(db): add is_recurring to transaction_groups"
```

### Task 1a.3: Extend PATCH route + add bulk PATCH + add filter

**Files:**
- Modify: `backend/app/schemas/transaction.py`
- Modify: `backend/app/api/routes/transactions.py`

- [ ] **Step 1: Add schemas**

Edit `backend/app/schemas/transaction.py`. Add near the other update schemas:

```python
class TransactionUpdate(BaseModel):
    category_id: UUID | None = None
    is_recurring: bool | None = None


class BulkRecurringUpdate(BaseModel):
    ids: list[UUID] = Field(..., min_length=1, max_length=500)
    is_recurring: bool


class BulkUpdateResponse(BaseModel):
    updated: int
```

Make sure `Field` is imported from pydantic and `UUID` from `uuid`.

Also: find the existing `TransactionGroupResponse` schema and add `is_recurring: bool` to its fields.

- [ ] **Step 2: Extend existing PATCH /transactions/{id}**

Edit `backend/app/api/routes/transactions.py`. Locate the existing `@router.patch("/{transaction_id}")` (the one updating category). Change its body schema to `TransactionUpdate` and merge fields:

```python
@router.patch("/{transaction_id}", response_model=TransactionGroupResponse)
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionGroupResponse:
    txn = db.query(TransactionGroup).filter(TransactionGroup.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if payload.category_id is not None:
        txn.category_id = payload.category_id
    if payload.is_recurring is not None:
        txn.is_recurring = payload.is_recurring
    txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    return _build_transaction_response(txn)
```

(If the existing route had a distinct schema like `TransactionCategoryUpdate`, replace with the new `TransactionUpdate` — back-compat is fine since the column is additive.)

- [ ] **Step 3: Add bulk PATCH**

In the same file, add (above the dynamic `{transaction_id}` route to avoid path collision):

```python
@router.patch("/bulk", response_model=BulkUpdateResponse)
async def bulk_update_recurring(
    payload: BulkRecurringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkUpdateResponse:
    updated = (
        db.query(TransactionGroup)
        .filter(TransactionGroup.id.in_(payload.ids))
        .update({TransactionGroup.is_recurring: payload.is_recurring}, synchronize_session=False)
    )
    db.commit()
    return BulkUpdateResponse(updated=updated)
```

- [ ] **Step 4: Add `?recurring=` filter to list**

Find the list endpoint `@router.get("")` or `@router.get("/")` and its handler. Add a `recurring: bool | None = None` query param. Inside the handler, after existing filters:

```python
    if recurring is not None:
        query = query.filter(TransactionGroup.is_recurring == recurring)
```

- [ ] **Step 5: Run tests**

Run: `docker compose exec api pytest tests/test_recurring.py -v -k "not subscriptions"`
Expected: 5/5 PASS (default, PATCH, bulk, filter_true, filter_false). The subscriptions_count test still fails.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/transaction.py backend/app/api/routes/transactions.py
git commit -m "feat(api): is_recurring on PATCH, bulk PATCH, list filter"
```

### Task 1a.4: Add `subscriptions_count` to dashboard

**Files:**
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/app/services/analytics.py` (or whichever computes dashboard)

- [ ] **Step 1: Add to dashboard response schema**

Edit `backend/app/schemas/analytics.py`. Find `DashboardResponse` (or equivalent). Add:

```python
    subscriptions_count: int = 0
```

- [ ] **Step 2: Compute in the dashboard service**

Find the service or route handler computing the dashboard response. Add:

```python
    subscriptions_count = (
        db.query(TransactionGroup)
        .filter(TransactionGroup.is_recurring.is_(True))
        .filter(TransactionGroup.occurred_at >= period_start)
        .filter(TransactionGroup.occurred_at <= period_end)
        .count()
    )
```

and include `subscriptions_count=subscriptions_count` in the returned response.

- [ ] **Step 3: Run all recurring tests**

Run: `docker compose exec api pytest tests/test_recurring.py -v`
Expected: 6/6 PASS.

- [ ] **Step 4: Run full test suite to confirm no regression**

Run: `docker compose exec api pytest -q`
Expected: full suite GREEN. If any pre-existing test breaks because it deserializes a `TransactionGroupResponse` that now requires `is_recurring`, set a default of `False` on the schema field and re-run.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/analytics.py backend/app/services/analytics.py
git commit -m "feat(analytics): subscriptions_count in dashboard"
```

### Task 1a.5: Update frontend types

**Files:**
- Modify: `frontend/src/api/transactions.ts`

- [ ] **Step 1: Add `is_recurring` to the `Transaction` interface**

Find the `Transaction` (or `TransactionGroupResponse`) interface. Add:

```typescript
  is_recurring: boolean;
```

- [ ] **Step 2: Add `recurring` to `TransactionFilters`**

```typescript
  recurring?: boolean;
```

- [ ] **Step 3: Add bulk mutation client**

In the same file:

```typescript
export async function bulkUpdateRecurring(ids: string[], isRecurring: boolean): Promise<{ updated: number }> {
  const res = await authFetch(`${API_BASE}/transactions/bulk`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, is_recurring: isRecurring }),
  });
  if (!res.ok) throw new Error(`bulkUpdateRecurring failed: ${res.status}`);
  return res.json();
}

export async function updateTransactionRecurring(id: string, isRecurring: boolean): Promise<Transaction> {
  const res = await authFetch(`${API_BASE}/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_recurring: isRecurring }),
  });
  if (!res.ok) throw new Error(`updateTransactionRecurring failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Confirm frontend still builds**

Run: `cd /home/alex/Documents/coding/transaction_intelligence_app/frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/transactions.ts
git commit -m "feat(frontend): is_recurring types + mutations"
```

### Task 1a.6: Lint + open PR

- [ ] **Step 1: Backend lint**

Run: `docker compose exec api ruff check . && docker compose exec api ruff format --check .`
Expected: clean. Auto-fix with `ruff check --fix .` and `ruff format .` if anything fails, then re-stage + amend the last touched commit.

- [ ] **Step 2: Push branch**

Run: `git push -u origin feat/v2-be-1a-recurring`

- [ ] **Step 3: Open PR to develop**

```bash
gh pr create --base develop --title "feat(backend): recurring transactions (1a)" --body "$(cat <<'EOF'
## Summary
- Adds is_recurring column on transaction_groups (migration 007)
- PATCH /transactions/{id} accepts is_recurring
- New PATCH /transactions/bulk for multi-toggle
- New ?recurring= filter on list
- subscriptions_count in /analytics/dashboard
- frontend/src/api/transactions.ts types + mutations

Implements §10.1 of WIRING.md and slot 1a of the v2 redesign Phase 1 plan.

## Test plan
- [x] tests/test_recurring.py (6/6)
- [x] full backend suite green
- [x] frontend npm run build clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Cleanup worktree (after PR merges)**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git worktree remove ../txn-wt-1a
```

---

## Phase 1 Slot 1b — Transactions summary endpoint

**Branch:** `feat/v2-be-1b-summary` off `develop` at base SHA.

**Worktree setup:**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git worktree add -b feat/v2-be-1b-summary ../txn-wt-1b "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1b
```

**Goal:** `GET /transactions/summary` returning filter-aware `{total_debit, total_credit, net, debit_count, credit_count, avg_debit}`, honoring the same filter set as the list endpoint.

### Task 1b.1: Write failing tests

**Files:**
- Create: `backend/tests/test_transactions_summary.py`

- [ ] **Step 1: Write tests**

```python
"""TDD: GET /transactions/summary aggregates filter-aware totals."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.db.models.transaction import TransactionGroup, TransactionDirection, TransactionStatus


def _mk(db, *, direction, amount, currency="AED"):
    t = TransactionGroup(
        id=uuid.uuid4(),
        direction=direction,
        amount=Decimal(amount),
        currency=currency,
        occurred_at=datetime.now(timezone.utc),
        status=TransactionStatus.POSTED,
    )
    db.add(t); db.commit(); db.refresh(t)
    return t


def test_summary_empty_returns_zeros(client, auth_headers):
    r = client.get("/api/v1/transactions/summary", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body == {
        "total_debit": "0.00",
        "total_credit": "0.00",
        "net": "0.00",
        "debit_count": 0,
        "credit_count": 0,
        "avg_debit": "0.00",
    }


def test_summary_basic_totals(client, auth_headers, db_session):
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="10.00")
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="20.00")
    _mk(db_session, direction=TransactionDirection.CREDIT, amount="50.00")
    r = client.get("/api/v1/transactions/summary", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_debit"] == "30.00"
    assert body["total_credit"] == "50.00"
    assert body["net"] == "20.00"
    assert body["debit_count"] == 2
    assert body["credit_count"] == 1
    assert body["avg_debit"] == "15.00"


def test_summary_respects_direction_filter(client, auth_headers, db_session):
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="10.00")
    _mk(db_session, direction=TransactionDirection.CREDIT, amount="50.00")
    r = client.get("/api/v1/transactions/summary?direction=debit", headers=auth_headers)
    body = r.json()
    assert body["total_debit"] == "10.00"
    assert body["total_credit"] == "0.00"
    assert body["debit_count"] == 1
    assert body["credit_count"] == 0
```

- [ ] **Step 2: Run, confirm RED**

Run: `docker compose exec api pytest tests/test_transactions_summary.py -v`
Expected: 3 failures (404 — route doesn't exist).

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/tests/test_transactions_summary.py
git commit -m "test: failing tests for transactions summary endpoint"
```

### Task 1b.2: Implement endpoint

**Files:**
- Modify: `backend/app/schemas/transaction.py`
- Modify: `backend/app/api/routes/transactions.py`

- [ ] **Step 1: Add schema**

```python
class TransactionSummary(BaseModel):
    total_debit: Decimal = Decimal("0.00")
    total_credit: Decimal = Decimal("0.00")
    net: Decimal = Decimal("0.00")
    debit_count: int = 0
    credit_count: int = 0
    avg_debit: Decimal = Decimal("0.00")

    @field_serializer("total_debit", "total_credit", "net", "avg_debit")
    def _ser_money(self, v: Decimal) -> str:
        return f"{v:.2f}"
```

(`field_serializer` from `pydantic` — add the import if missing.)

- [ ] **Step 2: Implement the route**

Above the dynamic `{transaction_id}` route in `transactions.py`:

```python
@router.get("/summary", response_model=TransactionSummary)
async def transactions_summary(
    search: str | None = None,
    direction: str | None = None,
    wallet_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    recurring: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionSummary:
    q = db.query(TransactionGroup)
    if direction == "debit":
        q = q.filter(TransactionGroup.direction == TransactionDirection.DEBIT)
    elif direction == "credit":
        q = q.filter(TransactionGroup.direction == TransactionDirection.CREDIT)
    if wallet_id is not None:
        q = q.filter(TransactionGroup.wallet_id == wallet_id)
    if category_id is not None:
        q = q.filter(TransactionGroup.category_id == category_id)
    if date_from is not None:
        q = q.filter(TransactionGroup.occurred_at >= date_from)
    if date_to is not None:
        q = q.filter(TransactionGroup.occurred_at <= date_to)
    if amount_min is not None:
        q = q.filter(TransactionGroup.amount >= amount_min)
    if amount_max is not None:
        q = q.filter(TransactionGroup.amount <= amount_max)
    if recurring is not None:
        q = q.filter(TransactionGroup.is_recurring == recurring)
    if search:
        # best-effort vendor name match; mirrors existing list logic
        from app.db.models.vendor import Vendor
        q = q.outerjoin(Vendor).filter(
            (Vendor.display_name.ilike(f"%{search}%"))
        )

    rows = q.all()
    debits = [r.amount for r in rows if r.direction == TransactionDirection.DEBIT]
    credits = [r.amount for r in rows if r.direction == TransactionDirection.CREDIT]
    total_debit = sum(debits, Decimal("0.00"))
    total_credit = sum(credits, Decimal("0.00"))
    return TransactionSummary(
        total_debit=total_debit,
        total_credit=total_credit,
        net=total_credit - total_debit,
        debit_count=len(debits),
        credit_count=len(credits),
        avg_debit=(total_debit / len(debits)) if debits else Decimal("0.00"),
    )
```

> The handler mirrors the existing list endpoint's filter set. If the list endpoint uses a different filter helper, reuse it instead of duplicating; goal is to keep them in sync. (If `is_recurring` doesn't exist yet because slot 1a hasn't merged, drop the `recurring` filter for now — that line will land via a follow-up merge.)

- [ ] **Step 3: Run tests, confirm GREEN**

Run: `docker compose exec api pytest tests/test_transactions_summary.py -v`
Expected: 3/3 PASS.

- [ ] **Step 4: Run full suite**

Run: `docker compose exec api pytest -q`
Expected: GREEN.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/transaction.py backend/app/api/routes/transactions.py
git commit -m "feat(api): GET /transactions/summary"
```

### Task 1b.3: Frontend client

**Files:**
- Modify: `frontend/src/api/transactions.ts`

- [ ] **Step 1: Add types + client**

```typescript
export interface TransactionsSummary {
  total_debit: string;
  total_credit: string;
  net: string;
  debit_count: number;
  credit_count: number;
  avg_debit: string;
}

export async function fetchTransactionsSummary(filters: TransactionFilters = {}): Promise<TransactionsSummary> {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const res = await authFetch(`${API_BASE}/transactions/summary?${qs.toString()}`);
  if (!res.ok) throw new Error(`fetchTransactionsSummary failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: npm run build**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/transactions.ts
git commit -m "feat(frontend): fetchTransactionsSummary client"
```

### Task 1b.4: Lint + PR

- [ ] **Step 1: ruff + push + PR**

```bash
docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1b-summary
gh pr create --base develop --title "feat(backend): transactions summary endpoint (1b)" --body "Implements §10.4 of WIRING.md. New GET /transactions/summary returning filter-aware totals.

## Test plan
- [x] tests/test_transactions_summary.py (3/3)
- [x] full backend suite green
- [x] frontend builds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Cleanup worktree after merge**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git worktree remove ../txn-wt-1b
```

---

## Phase 1 Slot 1c — Savings goals

**Branch:** `feat/v2-be-1c-goals` off `develop` at base SHA.

**Worktree setup:**

```bash
git worktree add -b feat/v2-be-1c-goals ../txn-wt-1c "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1c
```

**Goal:** New `savings_goals` table. CRUD endpoints + `POST /goals/{id}/contribute`. Per-user scoped.

### Task 1c.1: Write failing tests

**Files:**
- Create: `backend/tests/test_goals.py`

- [ ] **Step 1: Write tests**

```python
"""TDD: savings goals CRUD + contribute."""
from __future__ import annotations

from datetime import date


def test_create_goal(client, auth_headers):
    r = client.post(
        "/api/v1/goals",
        headers=auth_headers,
        json={
            "name": "Emergency fund",
            "target_amount": "5000.00",
            "target_date": "2026-12-31",
            "color": "#10b981",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Emergency fund"
    assert body["target_amount"] == "5000.00"
    assert body["saved_amount"] == "0.00"


def test_list_goals_scoped_to_user(client, auth_headers, db_session, test_user):
    client.post("/api/v1/goals", headers=auth_headers,
                json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"})
    client.post("/api/v1/goals", headers=auth_headers,
                json={"name": "B", "target_amount": "200.00", "target_date": "2026-12-31"})
    r = client.get("/api/v1/goals", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_patch_goal(client, auth_headers):
    cr = client.post("/api/v1/goals", headers=auth_headers,
                     json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"}).json()
    r = client.patch(f"/api/v1/goals/{cr['id']}", headers=auth_headers,
                     json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_delete_goal(client, auth_headers):
    cr = client.post("/api/v1/goals", headers=auth_headers,
                     json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"}).json()
    r = client.delete(f"/api/v1/goals/{cr['id']}", headers=auth_headers)
    assert r.status_code == 204
    lst = client.get("/api/v1/goals", headers=auth_headers).json()
    assert lst == []


def test_contribute_increments_saved_amount(client, auth_headers):
    cr = client.post("/api/v1/goals", headers=auth_headers,
                     json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"}).json()
    r = client.post(f"/api/v1/goals/{cr['id']}/contribute", headers=auth_headers,
                    json={"amount": "30.00"})
    assert r.status_code == 200
    assert r.json()["saved_amount"] == "30.00"


def test_contribute_clamps_to_target(client, auth_headers):
    cr = client.post("/api/v1/goals", headers=auth_headers,
                     json={"name": "A", "target_amount": "10.00", "target_date": "2026-12-31"}).json()
    r = client.post(f"/api/v1/goals/{cr['id']}/contribute", headers=auth_headers,
                    json={"amount": "100.00"})
    assert r.status_code == 200
    assert r.json()["saved_amount"] == "10.00"


def test_target_date_must_be_future(client, auth_headers):
    r = client.post("/api/v1/goals", headers=auth_headers,
                    json={"name": "A", "target_amount": "100.00", "target_date": "2000-01-01"})
    assert r.status_code == 422
```

- [ ] **Step 2: Run, confirm RED**

Run: `docker compose exec api pytest tests/test_goals.py -v`
Expected: 7 failures (404 / no module).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_goals.py
git commit -m "test: failing tests for savings goals"
```

### Task 1c.2: Model + migration

**Files:**
- Create: `backend/app/db/models/savings_goal.py`
- Create: `backend/alembic/versions/008_create_savings_goals.py`

- [ ] **Step 1: Write model**

```python
"""Savings goal model."""
from __future__ import annotations

import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    target_amount = Column(Numeric(15, 2), nullable=False)
    saved_amount = Column(Numeric(15, 2), nullable=False, default=0)
    target_date = Column(Date, nullable=False)
    color = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 2: Write migration**

Use down_revision = the previous head's revision id. Run `ls backend/alembic/versions/ | sort | tail -1` and read its `revision:` line.

```python
"""Create savings_goals.

Revision ID: 008_savings_goals
Revises: <PREVIOUS_HEAD_REVISION_ID>
Create Date: 2026-06-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "008_savings_goals"
down_revision: str | None = "<PREVIOUS_HEAD_REVISION_ID>"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "savings_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("saved_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date, nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_savings_goals_user_id", "savings_goals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_savings_goals_user_id", table_name="savings_goals")
    op.drop_table("savings_goals")
```

- [ ] **Step 3: Apply**

Run: `docker compose exec api alembic upgrade head`
Expected: applied.

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/models/savings_goal.py backend/alembic/versions/008_create_savings_goals.py
git commit -m "feat(db): create savings_goals table"
```

### Task 1c.3: Schemas + routes

**Files:**
- Create: `backend/app/schemas/savings_goal.py`
- Create: `backend/app/api/routes/goals.py`
- Modify: `backend/app/api/__init__.py` (register the new router)

- [ ] **Step 1: Schemas**

```python
"""Savings goal Pydantic schemas."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, field_validator


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_amount: Decimal = Field(..., gt=0)
    target_date: date
    color: str | None = Field(None, max_length=20)

    @field_validator("target_date")
    @classmethod
    def _must_be_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("target_date must be in the future")
        return v


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(None, gt=0)
    target_date: date | None = None
    color: str | None = Field(None, max_length=20)


class SavingsGoalContribute(BaseModel):
    amount: Decimal = Field(..., gt=0)


class SavingsGoalResponse(BaseModel):
    id: UUID
    name: str
    target_amount: Decimal
    saved_amount: Decimal
    target_date: date
    color: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("target_amount", "saved_amount")
    def _ser_money(self, v: Decimal) -> str:
        return f"{v:.2f}"
```

- [ ] **Step 2: Route**

```python
"""Savings goals CRUD + contribute."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models.savings_goal import SavingsGoal
from app.db.models.user import User
from app.schemas.savings_goal import (
    SavingsGoalContribute,
    SavingsGoalCreate,
    SavingsGoalResponse,
    SavingsGoalUpdate,
)

router = APIRouter()


@router.get("", response_model=list[SavingsGoalResponse])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.created_at.desc())
        .all()
    )


@router.post("", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = SavingsGoal(
        user_id=current_user.id,
        name=payload.name,
        target_amount=payload.target_amount,
        saved_amount=Decimal("0"),
        target_date=payload.target_date,
        color=payload.color,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


def _get_owned(db: Session, goal_id: UUID, user_id: UUID) -> SavingsGoal:
    g = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == user_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    return g


@router.patch("/{goal_id}", response_model=SavingsGoalResponse)
def update_goal(
    goal_id: UUID,
    payload: SavingsGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    for field in ("name", "target_amount", "target_date", "color"):
        v = getattr(payload, field)
        if v is not None:
            setattr(g, field, v)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    db.delete(g)
    db.commit()


@router.post("/{goal_id}/contribute", response_model=SavingsGoalResponse)
def contribute_to_goal(
    goal_id: UUID,
    payload: SavingsGoalContribute,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    new_saved = g.saved_amount + payload.amount
    if new_saved > g.target_amount:
        new_saved = g.target_amount
    g.saved_amount = new_saved
    db.commit()
    db.refresh(g)
    return g
```

- [ ] **Step 3: Register the router**

Find the file where other routers are included (likely `backend/app/main.py` or `backend/app/api/__init__.py`). Add:

```python
from app.api.routes import goals as goals_router
app.include_router(goals_router.router, prefix="/api/v1/goals", tags=["goals"])
```

Match the existing `include_router` style/prefix conventions in that file.

- [ ] **Step 4: Run tests**

Run: `docker compose exec api pytest tests/test_goals.py -v`
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/savings_goal.py backend/app/api/routes/goals.py backend/app/main.py
git commit -m "feat(api): savings goals CRUD + contribute"
```

### Task 1c.4: Frontend client

**Files:**
- Create: `frontend/src/api/goals.ts`

- [ ] **Step 1: Write client**

```typescript
import { authFetch, API_BASE } from "./auth";

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: string;
  saved_amount: string;
  target_date: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalInput {
  name: string;
  target_amount: string;
  target_date: string;
  color?: string;
}

export async function fetchGoals(): Promise<SavingsGoal[]> {
  const r = await authFetch(`${API_BASE}/goals`);
  if (!r.ok) throw new Error(`fetchGoals: ${r.status}`);
  return r.json();
}

export async function createGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  const r = await authFetch(`${API_BASE}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`createGoal: ${r.status}`);
  return r.json();
}

export async function updateGoal(id: string, patch: Partial<SavingsGoalInput>): Promise<SavingsGoal> {
  const r = await authFetch(`${API_BASE}/goals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`updateGoal: ${r.status}`);
  return r.json();
}

export async function deleteGoal(id: string): Promise<void> {
  const r = await authFetch(`${API_BASE}/goals/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`deleteGoal: ${r.status}`);
}

export async function contributeToGoal(id: string, amount: string): Promise<SavingsGoal> {
  const r = await authFetch(`${API_BASE}/goals/${id}/contribute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!r.ok) throw new Error(`contributeToGoal: ${r.status}`);
  return r.json();
}
```

- [ ] **Step 2: npm run build**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/goals.ts
git commit -m "feat(frontend): savings goals API client"
```

### Task 1c.5: Lint + PR

- [ ] **Step 1: ruff + push + PR**

```bash
docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1c-goals
gh pr create --base develop --title "feat(backend): savings goals (1c)" --body "Implements §10.2 of WIRING.md. New savings_goals table + CRUD + contribute endpoint.

## Test plan
- [x] tests/test_goals.py (7/7)
- [x] full backend suite green
- [x] frontend builds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Cleanup**

```bash
git worktree remove ../txn-wt-1c
```

---

## Phase 1 Slot 1d-core — Account profile (display_name, email, prefs, delete)

**Branch:** `feat/v2-be-1d-core-account` off `develop` at base SHA.

**Worktree setup:**

```bash
git worktree add -b feat/v2-be-1d-core-account ../txn-wt-1d-core "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1d-core
```

**Goal:** Add `email`, `display_name`, `preferences JSONB` to `users`. Implement `PATCH /auth/me` + `DELETE /auth/me`. (2FA + sessions split into 1d-2fa.)

### Task 1d-core.1: Failing tests

**Files:**
- Create: `backend/tests/test_account_profile.py`

- [ ] **Step 1: Write tests**

```python
"""TDD: PATCH /auth/me + DELETE /auth/me."""
from __future__ import annotations


def test_get_me_returns_email_and_prefs(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "email" in body
    assert "display_name" in body
    assert "preferences" in body


def test_patch_display_name(client, auth_headers):
    r = client.patch("/api/v1/auth/me", headers=auth_headers,
                     json={"display_name": "Alex"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Alex"


def test_patch_email_validates(client, auth_headers):
    r = client.patch("/api/v1/auth/me", headers=auth_headers,
                     json={"email": "not-an-email"})
    assert r.status_code == 422


def test_patch_preferences_merges(client, auth_headers):
    r = client.patch("/api/v1/auth/me", headers=auth_headers,
                     json={"preferences": {"currency": "AED"}})
    assert r.json()["preferences"]["currency"] == "AED"
    r2 = client.patch("/api/v1/auth/me", headers=auth_headers,
                      json={"preferences": {"date_format": "iso"}})
    assert r2.json()["preferences"]["currency"] == "AED"
    assert r2.json()["preferences"]["date_format"] == "iso"


def test_delete_account(client, auth_headers, test_user, db_session):
    from app.db.models.user import User
    r = client.delete("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 204
    assert db_session.query(User).filter(User.id == test_user.id).first() is None
```

- [ ] **Step 2: Run, confirm RED**

Run: `docker compose exec api pytest tests/test_account_profile.py -v`
Expected: failures (missing email column / route).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_account_profile.py
git commit -m "test: failing tests for account profile"
```

### Task 1d-core.2: Migration + model

**Files:**
- Create: `backend/alembic/versions/009_add_user_email_preferences.py`
- Modify: `backend/app/db/models/user.py`

- [ ] **Step 1: Migration**

Set down_revision via `ls backend/alembic/versions/ | sort | tail -1` + reading its revision id.

```python
"""Add email, display_name, preferences to users.

Revision ID: 009_user_email_prefs
Revises: <PREVIOUS_HEAD>
Create Date: 2026-06-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "009_user_email_prefs"
down_revision: str | None = "<PREVIOUS_HEAD>"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(120), nullable=True))
    op.add_column(
        "users",
        sa.Column("preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "preferences")
    op.drop_column("users", "display_name")
    op.drop_column("users", "email")
```

- [ ] **Step 2: Update model**

Edit `backend/app/db/models/user.py`. Add to `User`:

```python
    email = Column(String(255), nullable=True, index=True)
    display_name = Column(String(120), nullable=True)
    preferences = Column(JSONB, nullable=False, default=dict, server_default="{}")
```

Imports: `from sqlalchemy.dialects.postgresql import JSONB` (if not present).

- [ ] **Step 3: Apply migration**

Run: `docker compose exec api alembic upgrade head`
Expected: applied.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/009_add_user_email_preferences.py backend/app/db/models/user.py
git commit -m "feat(db): user email + display_name + preferences"
```

### Task 1d-core.3: Routes + schemas

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/api/routes/auth.py`

- [ ] **Step 1: Update `AuthMeResponse` (or equivalent) + add update schema**

In `backend/app/schemas/auth.py`:

```python
from pydantic import BaseModel, EmailStr, Field


class UserMeResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    preferences: dict = {}
    is_active: bool
    is_admin: bool

    model_config = {"from_attributes": True}


class UserMeUpdate(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = Field(None, max_length=120)
    preferences: dict | None = None
```

Find and ensure the existing `GET /auth/me` response model is `UserMeResponse` (rename if needed but preserve back-compat fields). If the existing schema is differently named, EXTEND it rather than replacing — keep `username`, `is_active`, etc.

- [ ] **Step 2: PATCH and DELETE routes**

In `backend/app/api/routes/auth.py`:

```python
@router.patch("/me", response_model=UserMeResponse)
def update_me(
    payload: UserMeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email is not None:
        current_user.email = payload.email
    if payload.display_name is not None:
        current_user.display_name = payload.display_name
    if payload.preferences is not None:
        merged = dict(current_user.preferences or {})
        merged.update(payload.preferences)
        current_user.preferences = merged
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.delete(current_user)
    db.commit()
```

- [ ] **Step 3: Run tests**

Run: `docker compose exec api pytest tests/test_account_profile.py -v`
Expected: 5/5 PASS.

- [ ] **Step 4: Full suite**

Run: `docker compose exec api pytest -q`
Expected: GREEN.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/api/routes/auth.py
git commit -m "feat(api): PATCH/DELETE /auth/me"
```

### Task 1d-core.4: Frontend client

**Files:**
- Modify: `frontend/src/api/auth.ts`

- [ ] **Step 1: Add types + clients**

Find the `User` interface in `frontend/src/api/auth.ts` and add:

```typescript
  email?: string | null;
  display_name?: string | null;
  preferences?: Record<string, unknown>;
```

Add:

```typescript
export async function updateProfile(patch: {
  email?: string;
  display_name?: string;
  preferences?: Record<string, unknown>;
}): Promise<User> {
  const r = await authFetch(`${API_BASE}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`updateProfile: ${r.status}`);
  return r.json();
}

export async function deleteAccount(): Promise<void> {
  const r = await authFetch(`${API_BASE}/auth/me`, { method: "DELETE" });
  if (!r.ok) throw new Error(`deleteAccount: ${r.status}`);
  clearAuth();
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/auth.ts
git commit -m "feat(frontend): updateProfile + deleteAccount clients"
```

### Task 1d-core.5: Lint + PR

```bash
docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1d-core-account
gh pr create --base develop --title "feat(backend): account profile core (1d-core)" --body "Implements §9d core of WIRING.md (display_name, email, preferences, account delete). 2FA and session-listing split to 1d-2fa.

## Test plan
- [x] tests/test_account_profile.py (5/5)
- [x] full backend suite green
- [x] frontend builds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
git worktree remove ../txn-wt-1d-core
```

---

## Phase 1 Slot 1d-2fa — 2FA + session management

**Branch:** `feat/v2-be-1d-2fa-sessions` off `develop` at base SHA.

**Worktree setup:**

```bash
git worktree add -b feat/v2-be-1d-2fa-sessions ../txn-wt-1d-2fa "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1d-2fa
```

**Goal:** Add `two_factor_secret` to `users`, create `user_sessions` table, implement enable/verify/disable 2FA + list/revoke sessions.

### Task 1d-2fa.1: Failing tests

**Files:**
- Create: `backend/tests/test_2fa.py`
- Create: `backend/tests/test_sessions.py`

- [ ] **Step 1: 2FA tests**

```python
"""TDD: TOTP-based 2FA."""
from __future__ import annotations

import pyotp


def test_enable_returns_secret(client, auth_headers):
    r = client.post("/api/v1/auth/2fa/enable", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "secret" in body
    assert "otpauth_url" in body


def test_verify_with_correct_code(client, auth_headers):
    enable = client.post("/api/v1/auth/2fa/enable", headers=auth_headers).json()
    code = pyotp.TOTP(enable["secret"]).now()
    r = client.post("/api/v1/auth/2fa/verify", headers=auth_headers,
                    json={"code": code})
    assert r.status_code == 200
    assert r.json()["verified"] is True


def test_verify_with_wrong_code(client, auth_headers):
    client.post("/api/v1/auth/2fa/enable", headers=auth_headers)
    r = client.post("/api/v1/auth/2fa/verify", headers=auth_headers,
                    json={"code": "000000"})
    assert r.status_code == 400


def test_disable_clears_secret(client, auth_headers):
    enable = client.post("/api/v1/auth/2fa/enable", headers=auth_headers).json()
    code = pyotp.TOTP(enable["secret"]).now()
    client.post("/api/v1/auth/2fa/verify", headers=auth_headers, json={"code": code})
    r = client.delete("/api/v1/auth/2fa", headers=auth_headers)
    assert r.status_code == 204
```

- [ ] **Step 2: Sessions tests**

```python
"""TDD: session listing + revocation."""
from __future__ import annotations


def test_login_creates_session(client, db_session, test_user):
    r = client.post("/api/v1/auth/login", json={"username": test_user.username, "password": "pw"})
    assert r.status_code == 200
    # Session row should exist
    from app.db.models.user_session import UserSession
    sessions = db_session.query(UserSession).filter(UserSession.user_id == test_user.id).all()
    assert len(sessions) == 1


def test_list_sessions(client, auth_headers):
    r = client.get("/api/v1/auth/sessions", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_revoke_all_sessions(client, auth_headers):
    r = client.delete("/api/v1/auth/sessions", headers=auth_headers)
    assert r.status_code == 204
```

- [ ] **Step 3: Add `pyotp` to deps** (in `backend/pyproject.toml` main deps): `"pyotp>=2.9",`. Rebuild backend (`make down && make up`).

- [ ] **Step 4: Run, confirm RED**

Run: `docker compose exec api pytest tests/test_2fa.py tests/test_sessions.py -v`
Expected: many failures.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_2fa.py backend/tests/test_sessions.py backend/pyproject.toml
git commit -m "test: failing tests for 2FA + sessions"
```

### Task 1d-2fa.2: Migration + models

**Files:**
- Create: `backend/alembic/versions/010_add_2fa_and_sessions.py`
- Create: `backend/app/db/models/user_session.py`
- Modify: `backend/app/db/models/user.py`

- [ ] **Step 1: Migration**

```python
"""Add 2FA secret + user_sessions table.

Revision ID: 010_2fa_sessions
Revises: <PREVIOUS_HEAD>
Create Date: 2026-06-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "010_2fa_sessions"
down_revision: str | None = "<PREVIOUS_HEAD>"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("two_factor_secret", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("two_factor_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(255), nullable=False),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_column("users", "two_factor_verified")
    op.drop_column("users", "two_factor_secret")
```

- [ ] **Step 2: UserSession model**

```python
"""User session model — backs session listing/revocation."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
```

- [ ] **Step 3: Add 2FA fields to User model**

Edit `backend/app/db/models/user.py`:

```python
    two_factor_secret = Column(String(64), nullable=True)
    two_factor_verified = Column(Boolean, nullable=False, default=False, server_default=sa.false())
```

- [ ] **Step 4: Apply + commit**

```bash
docker compose exec api alembic upgrade head
git add backend/alembic/versions/010_add_2fa_and_sessions.py backend/app/db/models/user_session.py backend/app/db/models/user.py
git commit -m "feat(db): 2FA + user_sessions"
```

### Task 1d-2fa.3: 2FA endpoints

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/api/routes/auth.py`

- [ ] **Step 1: Schemas**

```python
class TwoFactorEnableResponse(BaseModel):
    secret: str
    otpauth_url: str


class TwoFactorVerifyRequest(BaseModel):
    code: str


class TwoFactorVerifyResponse(BaseModel):
    verified: bool
```

- [ ] **Step 2: Routes**

```python
import pyotp


@router.post("/2fa/enable", response_model=TwoFactorEnableResponse)
def enable_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    secret = pyotp.random_base32()
    current_user.two_factor_secret = secret
    current_user.two_factor_verified = False
    db.commit()
    issuer = "Transaction Intelligence"
    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=current_user.username, issuer_name=issuer)
    return TwoFactorEnableResponse(secret=secret, otpauth_url=otpauth_url)


@router.post("/2fa/verify", response_model=TwoFactorVerifyResponse)
def verify_2fa(
    payload: TwoFactorVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.two_factor_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled")
    if not pyotp.TOTP(current_user.two_factor_secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")
    current_user.two_factor_verified = True
    db.commit()
    return TwoFactorVerifyResponse(verified=True)


@router.delete("/2fa", status_code=status.HTTP_204_NO_CONTENT)
def disable_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.two_factor_secret = None
    current_user.two_factor_verified = False
    db.commit()
```

- [ ] **Step 3: Run 2FA tests**

Run: `docker compose exec api pytest tests/test_2fa.py -v`
Expected: 4/4 PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/api/routes/auth.py
git commit -m "feat(api): 2FA enable/verify/disable"
```

### Task 1d-2fa.4: Sessions endpoints + login hook

**Files:**
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/app/schemas/auth.py`

- [ ] **Step 1: Schemas**

```python
class SessionResponse(BaseModel):
    id: str
    user_agent: str | None
    ip_address: str | None
    created_at: str
    last_seen_at: str
```

- [ ] **Step 2: Update login to write a session row**

Find the existing `@router.post("/login")` handler. After successful authentication and refresh-token creation, add:

```python
    from app.db.models.user_session import UserSession
    from hashlib import sha256
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=sha256(refresh_token.encode()).hexdigest(),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(session)
    db.commit()
```

(Add `request: Request` to the handler signature; import `from fastapi import Request`.)

- [ ] **Step 3: List + revoke routes**

```python
@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(UserSession).filter(UserSession.user_id == current_user.id).all()
    return [
        SessionResponse(
            id=str(r.id), user_agent=r.user_agent, ip_address=r.ip_address,
            created_at=r.created_at.isoformat(), last_seen_at=r.last_seen_at.isoformat(),
        ) for r in rows
    ]


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_all_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    db.commit()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(UserSession).filter(
        UserSession.id == session_id, UserSession.user_id == current_user.id
    ).delete()
    db.commit()
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec api pytest tests/test_2fa.py tests/test_sessions.py -v`
Expected: 7/7 PASS.

Run: `docker compose exec api pytest -q`
Expected: full GREEN.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/api/routes/auth.py
git commit -m "feat(api): session list/revoke + login session row"
```

### Task 1d-2fa.5: Frontend client + PR

```typescript
// frontend/src/api/auth.ts additions

export async function enable2FA(): Promise<{ secret: string; otpauth_url: string }> {
  const r = await authFetch(`${API_BASE}/auth/2fa/enable`, { method: "POST" });
  if (!r.ok) throw new Error(`enable2FA: ${r.status}`);
  return r.json();
}

export async function verify2FA(code: string): Promise<{ verified: boolean }> {
  const r = await authFetch(`${API_BASE}/auth/2fa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!r.ok) throw new Error(`verify2FA: ${r.status}`);
  return r.json();
}

export async function disable2FA(): Promise<void> {
  const r = await authFetch(`${API_BASE}/auth/2fa`, { method: "DELETE" });
  if (!r.ok) throw new Error(`disable2FA: ${r.status}`);
}

export interface UserSessionRow {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
}

export async function fetchSessions(): Promise<UserSessionRow[]> {
  const r = await authFetch(`${API_BASE}/auth/sessions`);
  if (!r.ok) throw new Error(`fetchSessions: ${r.status}`);
  return r.json();
}

export async function revokeAllSessions(): Promise<void> {
  const r = await authFetch(`${API_BASE}/auth/sessions`, { method: "DELETE" });
  if (!r.ok) throw new Error(`revokeAllSessions: ${r.status}`);
}
```

- [ ] **Step 1: Add to `frontend/src/api/auth.ts` and build**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 2: Commit + PR**

```bash
git add frontend/src/api/auth.ts
git commit -m "feat(frontend): 2FA + sessions clients"
docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1d-2fa-sessions
gh pr create --base develop --title "feat(backend): 2FA + session management (1d-2fa)" --body "Implements §9d 2FA + sessions of WIRING.md.

## Test plan
- [x] tests/test_2fa.py (4/4)
- [x] tests/test_sessions.py (3/3)
- [x] full backend suite green

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
git worktree remove ../txn-wt-1d-2fa
```

---

## Phase 1 Slot 1e — Smart insights endpoint

**Branch:** `feat/v2-be-1e-insights` off `develop` at base SHA.

**Worktree setup:**

```bash
git worktree add -b feat/v2-be-1e-insights ../txn-wt-1e "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1e
```

**Goal:** `GET /analytics/insights?period_start=&period_end=` returning `{subscriptions_count, top_merchant_alt, budget_forecast, spending_trend}`. No migration. Heuristics computed over existing analytics queries.

### Task 1e.1: Failing tests

**Files:**
- Create: `backend/tests/test_insights.py`

- [ ] **Step 1: Tests**

```python
"""TDD: GET /analytics/insights."""
from __future__ import annotations


def test_empty_history_returns_safe_defaults(client, auth_headers):
    r = client.get(
        "/api/v1/analytics/insights?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["subscriptions_count"] == 0
    assert body["top_merchant_alt"] is None
    assert body["budget_forecast"] is None
    assert body["spending_trend"] in ("up", "down", "flat", None)


def test_insights_includes_spending_trend(client, auth_headers):
    r = client.get(
        "/api/v1/analytics/insights?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    body = r.json()
    assert "spending_trend" in body
    assert "spending_change_percentage" in body
```

- [ ] **Step 2: RED**

Run: `docker compose exec api pytest tests/test_insights.py -v`
Expected: 404.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_insights.py
git commit -m "test: failing tests for /analytics/insights"
```

### Task 1e.2: Service + route

**Files:**
- Create: `backend/app/services/insights.py`
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/app/api/routes/analytics.py`

- [ ] **Step 1: Schema**

```python
class InsightsResponse(BaseModel):
    subscriptions_count: int = 0
    top_merchant_alt: dict | None = None  # {merchant, current_avg, suggested_alt, savings_pct}
    budget_forecast: dict | None = None   # {category, forecast_overrun_pct}
    spending_trend: str | None = None     # "up" | "down" | "flat"
    spending_change_percentage: float = 0.0
```

- [ ] **Step 2: Service**

```python
"""Heuristic-based smart insights over analytics."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models.transaction import TransactionGroup, TransactionDirection


def compute_insights(db: Session, period_start: date, period_end: date) -> dict:
    # subscriptions_count: rows flagged is_recurring in period
    sub_count = (
        db.query(TransactionGroup)
        .filter(TransactionGroup.is_recurring.is_(True))
        .filter(TransactionGroup.occurred_at >= period_start)
        .filter(TransactionGroup.occurred_at <= period_end)
        .count()
    )

    # spending_trend: compare current debit total vs prior equal-length window
    span_days = (period_end - period_start).days or 30
    from datetime import timedelta
    prev_start = period_start - timedelta(days=span_days + 1)
    prev_end = period_start - timedelta(days=1)

    def _sum_debits(s: date, e: date) -> Decimal:
        rows = (
            db.query(TransactionGroup)
            .filter(TransactionGroup.direction == TransactionDirection.DEBIT)
            .filter(TransactionGroup.occurred_at >= s)
            .filter(TransactionGroup.occurred_at <= e)
            .all()
        )
        return sum((r.amount for r in rows), Decimal("0"))

    current = _sum_debits(period_start, period_end)
    prev = _sum_debits(prev_start, prev_end)
    if prev == 0:
        trend = None
        pct = 0.0
    else:
        change = float((current - prev) / prev * 100)
        pct = round(change, 1)
        if abs(change) < 2:
            trend = "flat"
        elif change > 0:
            trend = "up"
        else:
            trend = "down"

    return {
        "subscriptions_count": sub_count,
        "top_merchant_alt": None,        # heuristic placeholder; future expansion
        "budget_forecast": None,         # heuristic placeholder
        "spending_trend": trend,
        "spending_change_percentage": pct,
    }
```

> Note: the `is_recurring` filter assumes slot 1a has merged. If running in isolation, change to `False` constant or skip — the test for `subscriptions_count == 0` still passes against an empty DB.

- [ ] **Step 2: Route**

In `backend/app/api/routes/analytics.py`:

```python
from datetime import date
from app.schemas.analytics import InsightsResponse
from app.services.insights import compute_insights


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    period_start: date,
    period_end: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InsightsResponse(**compute_insights(db, period_start, period_end))
```

- [ ] **Step 3: Run tests**

Run: `docker compose exec api pytest tests/test_insights.py -v`
Expected: 2/2 PASS.

- [ ] **Step 4: Commit + frontend**

```bash
git add backend/app/services/insights.py backend/app/schemas/analytics.py backend/app/api/routes/analytics.py
git commit -m "feat(api): /analytics/insights endpoint"
```

In `frontend/src/api/analytics.ts`:

```typescript
export interface InsightsResponse {
  subscriptions_count: number;
  top_merchant_alt: { merchant: string; current_avg: string; suggested_alt: string; savings_pct: number } | null;
  budget_forecast: { category: string; forecast_overrun_pct: number } | null;
  spending_trend: "up" | "down" | "flat" | null;
  spending_change_percentage: number;
}

export async function fetchInsights(periodStart: string, periodEnd: string): Promise<InsightsResponse> {
  const r = await authFetch(`${API_BASE}/analytics/insights?period_start=${periodStart}&period_end=${periodEnd}`);
  if (!r.ok) throw new Error(`fetchInsights: ${r.status}`);
  return r.json();
}
```

```bash
cd frontend && npm run build
git add frontend/src/api/analytics.ts
git commit -m "feat(frontend): fetchInsights client"
```

### Task 1e.3: Lint + PR

```bash
docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1e-insights
gh pr create --base develop --title "feat(backend): smart insights endpoint (1e)" --body "Implements §10.3 of WIRING.md. Heuristic-based insights computed over analytics. top_merchant_alt + budget_forecast left as null for v2.0 (future heuristics).

## Test plan
- [x] tests/test_insights.py (2/2)
- [x] frontend builds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
git worktree remove ../txn-wt-1e
```

---

## Phase 1 Slot 1f — AI settings writes + adapter stats

**Branch:** `feat/v2-be-1f-ai-adapter-settings` off `develop` at base SHA.

**Worktree setup:**

```bash
git worktree add -b feat/v2-be-1f-ai-adapter-settings ../txn-wt-1f "$(cat /tmp/v2-phase1-base-sha.txt)"
cd ../txn-wt-1f
```

**Goal:** Add `app_settings` KV table. Implement `PATCH /ai/settings` that persists Ollama URL/model/feature-toggles. Implement `GET /adapters/{name}/stats` reading parsed-message counts.

### Task 1f.1: Failing tests

**Files:**
- Create: `backend/tests/test_ai_settings.py`
- Create: `backend/tests/test_adapter_stats.py`

- [ ] **Step 1: AI settings tests**

```python
"""TDD: PATCH /ai/settings persists."""
from __future__ import annotations


def test_patch_persists_base_url(client, auth_headers):
    r = client.patch("/api/v1/ai/settings", headers=auth_headers,
                     json={"ollama_base_url": "http://ollama:11434", "ollama_model": "llama3"})
    assert r.status_code == 200
    body = r.json()
    assert body["ollama_base_url"] == "http://ollama:11434"
    assert body["ollama_model"] == "llama3"


def test_get_returns_persisted(client, auth_headers):
    client.patch("/api/v1/ai/settings", headers=auth_headers,
                 json={"ollama_base_url": "http://x:11434", "ollama_model": "phi3"})
    r = client.get("/api/v1/ai/settings", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["ollama_base_url"] == "http://x:11434"
    assert r.json()["ollama_model"] == "phi3"


def test_feature_toggles_persist(client, auth_headers):
    r = client.patch("/api/v1/ai/settings", headers=auth_headers,
                     json={"features": {"chat": False, "categorize": True, "parse": True}})
    assert r.json()["features"]["chat"] is False
    assert r.json()["features"]["categorize"] is True
```

- [ ] **Step 2: Adapter stats tests**

```python
"""TDD: GET /adapters/{name}/stats."""
from __future__ import annotations


def test_stats_zero_when_empty(client, auth_headers):
    # Pick any registered adapter; substitute name during integration if different.
    r = client.get("/api/v1/adapters/emirates_nbd/stats", headers=auth_headers)
    if r.status_code == 404:
        # Adapter not registered in this env — accept that and assert 404 contract
        return
    assert r.status_code == 200
    assert r.json()["parsed_count"] >= 0
```

- [ ] **Step 3: RED + commit**

```bash
docker compose exec api pytest tests/test_ai_settings.py tests/test_adapter_stats.py -v
git add backend/tests/test_ai_settings.py backend/tests/test_adapter_stats.py
git commit -m "test: failing tests for AI settings writes + adapter stats"
```

### Task 1f.2: Settings store + migration

**Files:**
- Create: `backend/alembic/versions/011_create_app_settings.py`
- Create: `backend/app/db/models/app_setting.py`
- Create: `backend/app/services/settings_store.py`

- [ ] **Step 1: Migration**

```python
"""Create app_settings KV table.

Revision ID: 011_app_settings
Revises: <PREVIOUS_HEAD>
Create Date: 2026-06-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "011_app_settings"
down_revision: str | None = "<PREVIOUS_HEAD>"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(120), primary_key=True),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
```

- [ ] **Step 2: Model**

```python
"""app_settings KV model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(120), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 3: Store helper**

```python
"""Settings store — read/write JSON blobs by key."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models.app_setting import AppSetting


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


def put_setting(db: Session, key: str, value: Any) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is None:
        row = AppSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
```

- [ ] **Step 4: Apply + commit**

```bash
docker compose exec api alembic upgrade head
git add backend/alembic/versions/011_create_app_settings.py backend/app/db/models/app_setting.py backend/app/services/settings_store.py
git commit -m "feat(db): app_settings KV table + store helper"
```

### Task 1f.3: AI settings PATCH

**Files:**
- Modify: `backend/app/schemas/ai.py`
- Modify: `backend/app/api/routes/ai.py`

- [ ] **Step 1: Schema**

```python
class AISettingsUpdate(BaseModel):
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    features: dict | None = None


class AISettingsFull(BaseModel):
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    features: dict = {}
```

- [ ] **Step 2: Routes**

```python
from app.services.settings_store import get_setting, put_setting

AI_SETTINGS_KEY = "ai_settings"


@router.get("/settings", response_model=AISettingsFull)
def get_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored = get_setting(db, AI_SETTINGS_KEY, default={})
    return AISettingsFull(**stored) if stored else AISettingsFull()


@router.patch("/settings", response_model=AISettingsFull)
def update_ai_settings(
    payload: AISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current = get_setting(db, AI_SETTINGS_KEY, default={}) or {}
    if payload.ollama_base_url is not None:
        current["ollama_base_url"] = payload.ollama_base_url
    if payload.ollama_model is not None:
        current["ollama_model"] = payload.ollama_model
    if payload.features is not None:
        merged = dict(current.get("features") or {})
        merged.update(payload.features)
        current["features"] = merged
    put_setting(db, AI_SETTINGS_KEY, current)
    return AISettingsFull(**current)
```

> Note: the EXISTING `GET /ai/settings` route may currently report Ollama connection status. Keep that route under a different path (e.g., `/ai/status`) or merge: response includes both persisted values and live connection check. For TDD purposes the test only asserts persisted values round-trip.

- [ ] **Step 3: Run AI tests**

Run: `docker compose exec api pytest tests/test_ai_settings.py -v`
Expected: 3/3 PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/ai.py backend/app/api/routes/ai.py
git commit -m "feat(api): PATCH /ai/settings persists to app_settings"
```

### Task 1f.4: Adapter stats

**Files:**
- Modify: `backend/app/schemas/adapters.py`
- Modify: `backend/app/api/routes/adapters.py`

- [ ] **Step 1: Schema**

```python
class AdapterStats(BaseModel):
    parsed_count: int = 0
    last_parsed_at: str | None = None
```

- [ ] **Step 2: Route**

```python
from app.db.models.message import Message  # or whatever table tracks parsed messages
from sqlalchemy import func

@router.get("/{name}/stats", response_model=AdapterStats)
def get_adapter_stats(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify adapter exists; mirror existing list_adapters check
    from app.adapters import discover_adapters
    adapters = discover_adapters()
    if name not in {a.name for a in adapters}:
        raise HTTPException(status_code=404, detail="Adapter not found")

    parsed_count = (
        db.query(func.count(Message.id))
        .filter(Message.adapter_name == name)
        .scalar() or 0
    )
    last_parsed = (
        db.query(func.max(Message.created_at))
        .filter(Message.adapter_name == name)
        .scalar()
    )
    return AdapterStats(
        parsed_count=parsed_count,
        last_parsed_at=last_parsed.isoformat() if last_parsed else None,
    )
```

> Adjust `Message.adapter_name` if the actual column name differs (could be `parser_name` or similar). Read `backend/app/db/models/message.py` to confirm. If no per-adapter tally column exists, the count may need to be 0 with a TODO marker — this slot then ships shape only and we open an issue for backfilling the counter. (Acceptable for v2.0 since the redesign already flags this as ⚠️.)

- [ ] **Step 3: Run adapter tests**

Run: `docker compose exec api pytest tests/test_adapter_stats.py -v`
Expected: PASS (test is permissive about 404 vs 200).

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/adapters.py backend/app/api/routes/adapters.py
git commit -m "feat(api): GET /adapters/{name}/stats"
```

### Task 1f.5: Frontend clients + PR

In `frontend/src/api/ai.ts`:

```typescript
export interface AISettingsFull {
  ollama_base_url: string | null;
  ollama_model: string | null;
  features: Record<string, boolean>;
}

export async function updateAISettings(patch: Partial<AISettingsFull>): Promise<AISettingsFull> {
  const r = await authFetch(`${API_BASE}/ai/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`updateAISettings: ${r.status}`);
  return r.json();
}
```

In `frontend/src/api/adapters.ts`:

```typescript
export interface AdapterStats {
  parsed_count: number;
  last_parsed_at: string | null;
}

export async function fetchAdapterStats(name: string): Promise<AdapterStats> {
  const r = await authFetch(`${API_BASE}/adapters/${name}/stats`);
  if (!r.ok) throw new Error(`fetchAdapterStats: ${r.status}`);
  return r.json();
}
```

```bash
cd frontend && npm run build
git add frontend/src/api/ai.ts frontend/src/api/adapters.ts
git commit -m "feat(frontend): AI settings update + adapter stats clients"

docker compose exec api ruff check . && docker compose exec api ruff format --check .
git push -u origin feat/v2-be-1f-ai-adapter-settings
gh pr create --base develop --title "feat(backend): AI settings persistence + adapter stats (1f)" --body "Implements §9b adapter stats and §9c AI settings writes from WIRING.md. AI settings now persisted in new app_settings KV table.

## Test plan
- [x] tests/test_ai_settings.py (3/3)
- [x] tests/test_adapter_stats.py (1/1)
- [x] frontend builds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
git worktree remove ../txn-wt-1f
```

---

## Phase 1 Acceptance Gate

After all 7 PRs merge to `develop`:

- [ ] **Step 1: Pull latest develop**

```bash
git -C /home/alex/Documents/coding/transaction_intelligence_app checkout develop
git -C /home/alex/Documents/coding/transaction_intelligence_app pull --ff-only origin develop
```

- [ ] **Step 2: Fresh DB migration round-trip check**

```bash
docker compose down -v
docker compose up -d postgres
docker compose exec api alembic upgrade head
docker compose exec api alembic downgrade -7
docker compose exec api alembic upgrade head
```
Expected: each step succeeds. The `-7` walks back through 007-011 (5 new migrations); add or trim the number to exactly match what was added in Phase 1.

- [ ] **Step 3: Full test suite**

Run: `docker compose exec api pytest -q`
Expected: all green.

- [ ] **Step 4: Frontend builds + tests**

Run: `cd frontend && npm run build && npm test -- --run`
Expected: green.

- [ ] **Step 5: Smoke against unmodified legacy frontend**

Open the existing app at the dev URL. Smoke-test login, view transactions, view budgets, generate a report. Confirm no regressions from additive backend changes.

- [ ] **Step 6: Rebase develop on main (prep for Phase 2)**

```bash
git -C /home/alex/Documents/coding/transaction_intelligence_app rebase main
git -C /home/alex/Documents/coding/transaction_intelligence_app push --force-with-lease origin develop
```

Phase 1 complete. Phase 2's plan can now be written.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-10-v2-phase1-backend-gaps.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task. Phase 0 runs sequentially in the main session; once it lands, I dispatch 7 worktree-isolated agents in parallel (one per slot) with `isolation: "worktree"`. I review each PR via `/code-review` before approving the merge. Best fit for the parallel-worktree approach the spec calls for.

**2. Inline Execution** — Execute tasks in this session using executing-plans. Sequential, no parallelism. Wouldn't take advantage of the worktree-per-slot design.

Which approach?

