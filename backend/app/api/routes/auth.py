"""Authentication API endpoints."""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user, get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.services.auth import (
    AccountLockedError,
    AuthenticationError,
    AuthService,
)

router = APIRouter()

# Simple in-memory rate limiter for login attempts
# In production, use Redis for distributed rate limiting
_login_attempts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_ATTEMPTS = 5


def _check_rate_limit(ip: str) -> None:
    """Check if IP has exceeded rate limit for login attempts."""
    now = time.time()
    # Clean old attempts
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]

    if len(_login_attempts[ip]) >= RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {RATE_LIMIT_WINDOW} seconds.",
        )


def _record_login_attempt(ip: str) -> None:
    """Record a login attempt for rate limiting."""
    _login_attempts[ip].append(time.time())


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Login with username and password.

    Returns JWT access and refresh tokens.
    Rate limited to prevent brute force attacks.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Check rate limit
    _check_rate_limit(client_ip)

    # Record attempt before authentication
    _record_login_attempt(client_ip)

    auth_service = AuthService(db)

    try:
        result = auth_service.login(payload.username, payload.password)

        # Get user for response
        user = auth_service.get_user_by_username(payload.username)

        return TokenResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
            user=UserResponse(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                is_admin=user.is_admin,
                is_active=user.is_active,
                created_at=user.created_at,
                last_login_at=user.last_login_at,
            ),
        )

    except AccountLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked until {e.locked_until.isoformat()}",
        ) from None
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from None


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
) -> RefreshResponse:
    """
    Refresh access token using refresh token.

    Returns new access and refresh tokens.
    """
    auth_service = AuthService(db)

    try:
        result = auth_service.refresh_tokens(payload.refresh_token)
        return RefreshResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
        )
    except AuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from None


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current authenticated user information."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        is_admin=current_user.is_admin,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
    )


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Change current user's password."""
    auth_service = AuthService(db)

    try:
        auth_service.change_password(
            current_user.id,
            payload.current_password,
            payload.new_password,
        )
        return {"message": "Password changed successfully"}
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from None


@router.post("/users", response_model=UserResponse)
async def create_user(
    payload: UserCreate,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Create a new user (admin only).
    """
    auth_service = AuthService(db)

    try:
        user = auth_service.create_user(
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
            is_admin=payload.is_admin,
        )
        return UserResponse(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from None


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    """List all users (admin only)."""
    users = db.query(User).order_by(User.username).all()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            is_admin=u.is_admin,
            is_active=u.is_active,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        )
        for u in users
    ]


@router.post("/setup")
async def initial_setup(
    db: Session = Depends(get_db),
) -> dict:
    """
    Create default admin user if no users exist.

    This endpoint is only available when no users exist in the system.
    Returns credentials for the default admin user.
    """
    # Check if any users exist
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed. Users already exist.",
        )

    auth_service = AuthService(db)
    auth_service.create_user(
        username="admin",
        password="changeme",
        display_name="Administrator",
        is_admin=True,
    )

    return {
        "message": "Setup completed. Default admin user created.",
        "username": "admin",
        "password": "changeme",
        "warning": "Please change the default password immediately!",
    }
