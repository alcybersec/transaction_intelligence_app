"""Settings store — read/write JSON blobs keyed by name in app_settings."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models.app_setting import AppSetting


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    """Fetch a JSON value by key, returning *default* when absent."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


def put_setting(db: Session, key: str, value: Any) -> None:
    """Upsert a JSON value by key; commits the transaction."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is None:
        row = AppSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
