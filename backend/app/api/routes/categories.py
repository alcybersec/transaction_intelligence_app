"""Category API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import Category, User
from app.db.session import get_db
from app.schemas.category import (
    CategoryCreateRequest,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdateRequest,
)

router = APIRouter()


def _build_category_response(cat: Category) -> CategoryResponse:
    """Build category response from model."""
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        icon=cat.icon,
        color=cat.color,
        sort_order=cat.sort_order,
        is_system=cat.is_system,
        created_at=cat.created_at,
        updated_at=cat.updated_at,
    )


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryListResponse:
    """List all categories ordered by sort_order."""
    categories = db.query(Category).order_by(Category.sort_order, Category.name).all()

    return CategoryListResponse(
        categories=[_build_category_response(cat) for cat in categories],
        total=len(categories),
    )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Get a single category."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return _build_category_response(category)


@router.post("", response_model=CategoryResponse)
async def create_category(
    payload: CategoryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Create a new category."""
    # Check for duplicate name
    existing = db.query(Category).filter(Category.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{payload.name}' already exists",
        )

    category = Category(
        name=payload.name,
        icon=payload.icon,
        color=payload.color,
        sort_order=payload.sort_order,
        is_system=False,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    return _build_category_response(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    payload: CategoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Update a category."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for duplicate name if changing
    if payload.name and payload.name != category.name:
        existing = db.query(Category).filter(Category.name == payload.name).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{payload.name}' already exists",
            )

    # Update fields
    if payload.name is not None:
        category.name = payload.name
    if payload.icon is not None:
        category.icon = payload.icon
    if payload.color is not None:
        category.color = payload.color
    if payload.sort_order is not None:
        category.sort_order = payload.sort_order

    category.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(category)

    return _build_category_response(category)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a category."""
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if category.is_system:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete system category",
        )

    db.delete(category)
    db.commit()

    return {"message": "Category deleted successfully"}
