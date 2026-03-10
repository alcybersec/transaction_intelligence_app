"""Authentication service with Argon2 password hashing and JWT tokens."""

from datetime import datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import User

# Password hashing with Argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT settings
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Rate limiting settings
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


class AuthenticationError(Exception):
    """Raised when authentication fails."""

    pass


class AccountLockedError(Exception):
    """Raised when account is locked due to too many failed attempts."""

    def __init__(self, locked_until: datetime):
        self.locked_until = locked_until
        super().__init__(f"Account locked until {locked_until}")


def hash_password(password: str) -> str:
    """Hash a password using Argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: UUID, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> str:
    """Create a JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_user(
        self,
        username: str,
        password: str,
        display_name: str | None = None,
        is_admin: bool = False,
    ) -> User:
        """Create a new user."""
        # Check if username already exists
        existing = self.db.query(User).filter(User.username == username).first()
        if existing:
            raise ValueError(f"Username '{username}' already exists")

        user = User(
            username=username,
            password_hash=hash_password(password),
            display_name=display_name,
            is_admin=is_admin,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_user_by_id(self, user_id: UUID) -> User | None:
        """Get a user by ID."""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, username: str) -> User | None:
        """Get a user by username."""
        return self.db.query(User).filter(User.username == username).first()

    def _check_account_locked(self, user: User) -> None:
        """Check if account is locked and raise if so."""
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise AccountLockedError(user.locked_until)

    def _record_failed_attempt(self, user: User) -> None:
        """Record a failed login attempt."""
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        self.db.commit()

    def _reset_failed_attempts(self, user: User) -> None:
        """Reset failed login attempts after successful login."""
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.utcnow()
        self.db.commit()

    def authenticate(self, username: str, password: str) -> User:
        """
        Authenticate a user by username and password.

        Raises:
            AuthenticationError: If credentials are invalid
            AccountLockedError: If account is locked
        """
        user = self.get_user_by_username(username)
        if not user:
            raise AuthenticationError("Invalid username or password")

        # Check if account is locked
        self._check_account_locked(user)

        # Verify password
        if not verify_password(password, user.password_hash):
            self._record_failed_attempt(user)
            raise AuthenticationError("Invalid username or password")

        # Check if user is active
        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        # Reset failed attempts on successful login
        self._reset_failed_attempts(user)

        return user

    def login(self, username: str, password: str) -> dict:
        """
        Login a user and return tokens.

        Returns:
            dict with access_token, refresh_token, token_type, and user info
        """
        user = self.authenticate(username, password)

        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "display_name": user.display_name,
                "is_admin": user.is_admin,
            },
        }

    def refresh_tokens(self, refresh_token: str) -> dict:
        """
        Refresh access token using refresh token.

        Returns:
            dict with new access_token and refresh_token
        """
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise AuthenticationError("Invalid refresh token")

        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid refresh token")

        user = self.get_user_by_id(UUID(user_id))
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    def change_password(self, user_id: UUID, current_password: str, new_password: str) -> None:
        """Change user password."""
        user = self.get_user_by_id(user_id)
        if not user:
            raise AuthenticationError("User not found")

        if not verify_password(current_password, user.password_hash):
            raise AuthenticationError("Current password is incorrect")

        user.password_hash = hash_password(new_password)
        self.db.commit()

    def get_or_create_default_user(self) -> User:
        """Get or create a default admin user for initial setup."""
        user = self.get_user_by_username("admin")
        if not user:
            user = self.create_user(
                username="admin",
                password="changeme",
                display_name="Administrator",
                is_admin=True,
            )
        return user
