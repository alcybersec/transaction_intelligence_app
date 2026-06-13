"""User model for authentication."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base


class User(Base):
    """
    User account for authentication.

    Supports username/password auth with Argon2 password hashing.
    """

    __tablename__ = "users"
    __table_args__ = (
        Index(
            "ix_users_email",
            "email",
            unique=True,
            postgresql_where="email IS NOT NULL",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)

    # Profile
    email = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    preferences = Column(JSONB, nullable=False, default=dict, server_default="{}")

    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)

    # Rate limiting
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Two-factor authentication
    two_factor_secret = Column(String(64), nullable=True)
    two_factor_verified = Column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username})>"
