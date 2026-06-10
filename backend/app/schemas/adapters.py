"""Pydantic schemas for adapter management."""

from datetime import datetime

from pydantic import BaseModel


class AdapterStats(BaseModel):
    """Per-adapter parsing stats returned by GET /adapters/{name}/stats."""

    parsed_count: int = 0
    last_parsed_at: datetime | None = None
