"""app_settings KV model — JSON blobs keyed by name."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class AppSetting(Base):
    """Persistent key-value store for app-wide settings (AI, etc.)."""

    __tablename__ = "app_settings"

    key = Column(String(120), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<AppSetting(key={self.key!r})>"
