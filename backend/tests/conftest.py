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
from app.main import app
from app.services.auth import create_access_token, hash_password


def _build_test_db_url() -> str:
    base = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://txnuser:txnpass@postgres:5432/txndb_test",
    )
    return base


@pytest.fixture(scope="session")
def engine():
    url = _build_test_db_url()
    eng = create_engine(url, future=True)
    with eng.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine) -> Generator[Session, None, None]:
    schema = f"t_{uuid.uuid4().hex[:12]}"
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'SET search_path TO "{schema}"'))
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
    token = create_access_token(user_id=test_user.id)
    return {"Authorization": f"Bearer {token}"}
