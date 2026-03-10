"""Vendor API endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.models import (
    Category,
    TransactionDirection,
    TransactionGroup,
    User,
    Vendor,
    VendorAlias,
    VendorCategoryRule,
)
from app.db.session import get_db
from app.schemas.vendor import (
    CategoryRuleResponse,
    VendorAliasResponse,
    VendorCategoryRuleRequest,
    VendorCreateRequest,
    VendorDetailResponse,
    VendorListResponse,
    VendorResponse,
    VendorStatsResponse,
    VendorUpdateRequest,
)
from app.services.vendor import VendorService

router = APIRouter()


def _get_vendor_stats(db: Session, vendor_id: UUID) -> dict:
    """Get transaction statistics for a vendor."""
    # Count transactions
    txn_count = (
        db.query(func.count(TransactionGroup.id))
        .filter(TransactionGroup.vendor_id == vendor_id)
        .scalar()
    )

    # Sum amounts by direction
    total_debit = (
        db.query(func.sum(TransactionGroup.amount))
        .filter(
            TransactionGroup.vendor_id == vendor_id,
            TransactionGroup.direction == TransactionDirection.DEBIT,
        )
        .scalar()
    ) or Decimal("0")

    total_credit = (
        db.query(func.sum(TransactionGroup.amount))
        .filter(
            TransactionGroup.vendor_id == vendor_id,
            TransactionGroup.direction == TransactionDirection.CREDIT,
        )
        .scalar()
    ) or Decimal("0")

    return {
        "transaction_count": txn_count or 0,
        "total_spent": total_debit,
        "total_received": total_credit,
    }


def _build_vendor_response(
    vendor: Vendor, db: Session, include_stats: bool = True
) -> VendorResponse:
    """Build vendor response from model."""
    # Get alias count
    alias_count = (
        db.query(func.count(VendorAlias.id)).filter(VendorAlias.vendor_id == vendor.id).scalar()
    )

    # Get category from rule
    category_id = None
    category_name = None
    rule = (
        db.query(VendorCategoryRule)
        .options(joinedload(VendorCategoryRule.category))
        .filter(
            VendorCategoryRule.vendor_id == vendor.id,
            VendorCategoryRule.enabled.is_(True),
        )
        .order_by(VendorCategoryRule.priority.desc())
        .first()
    )
    if rule and rule.category:
        category_id = rule.category_id
        category_name = rule.category.name

    response = VendorResponse(
        id=vendor.id,
        canonical_name=vendor.canonical_name,
        created_at=vendor.created_at,
        updated_at=vendor.updated_at,
        alias_count=alias_count,
        category_id=category_id,
        category_name=category_name,
    )

    if include_stats:
        stats = _get_vendor_stats(db, vendor.id)
        response.transaction_count = stats["transaction_count"]
        response.total_spent = stats["total_spent"]

    return response


@router.get("", response_model=VendorListResponse)
async def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str | None = Query(None, description="Search vendor names"),
    category_id: UUID | None = Query(None, description="Filter by category"),
    has_transactions: bool | None = Query(None, description="Filter by having transactions"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> VendorListResponse:
    """
    List vendors with optional filters.

    Includes transaction statistics and category assignment.
    """
    query = db.query(Vendor)

    # Search filter
    if search:
        query = query.filter(Vendor.canonical_name.ilike(f"%{search}%"))

    # Category filter
    if category_id:
        query = query.join(
            VendorCategoryRule,
            and_(
                VendorCategoryRule.vendor_id == Vendor.id,
                VendorCategoryRule.category_id == category_id,
                VendorCategoryRule.enabled.is_(True),
            ),
        )

    # Transaction filter
    if has_transactions is True:
        query = query.filter(
            db.query(TransactionGroup).filter(TransactionGroup.vendor_id == Vendor.id).exists()
        )
    elif has_transactions is False:
        query = query.filter(
            ~db.query(TransactionGroup).filter(TransactionGroup.vendor_id == Vendor.id).exists()
        )

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    offset = (page - 1) * page_size
    vendors = query.order_by(Vendor.canonical_name).offset(offset).limit(page_size).all()

    return VendorListResponse(
        vendors=[_build_vendor_response(v, db) for v in vendors],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(vendors)) < total,
    )


@router.get("/{vendor_id}", response_model=VendorDetailResponse)
async def get_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorDetailResponse:
    """Get vendor details including aliases and category rules."""
    vendor = (
        db.query(Vendor)
        .options(
            joinedload(Vendor.aliases),
            joinedload(Vendor.category_rules).joinedload(VendorCategoryRule.category),
        )
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Get stats
    stats = _get_vendor_stats(db, vendor.id)

    # Build aliases
    aliases = [
        VendorAliasResponse(
            id=a.id,
            alias_raw=a.alias_raw,
            alias_normalized=a.alias_normalized,
            created_at=a.created_at,
        )
        for a in vendor.aliases
    ]

    # Build category rules
    rules = [
        CategoryRuleResponse(
            id=r.id,
            vendor_id=r.vendor_id,
            category_id=r.category_id,
            category_name=r.category.name if r.category else "Unknown",
            priority=r.priority,
            enabled=r.enabled,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in vendor.category_rules
    ]

    # Get active category
    active_rule = next((r for r in vendor.category_rules if r.enabled), None)

    return VendorDetailResponse(
        id=vendor.id,
        canonical_name=vendor.canonical_name,
        created_at=vendor.created_at,
        updated_at=vendor.updated_at,
        alias_count=len(aliases),
        transaction_count=stats["transaction_count"],
        total_spent=stats["total_spent"],
        category_id=active_rule.category_id if active_rule else None,
        category_name=active_rule.category.name if active_rule and active_rule.category else None,
        aliases=aliases,
        category_rules=rules,
    )


@router.post("", response_model=VendorResponse)
async def create_vendor(
    payload: VendorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorResponse:
    """Create a new vendor manually."""
    vendor_service = VendorService(db)

    # Check if vendor already exists
    normalized = vendor_service.normalize(payload.canonical_name)
    existing = db.query(Vendor).filter(Vendor.canonical_name == normalized).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Vendor '{normalized}' already exists",
        )

    vendor = Vendor(canonical_name=normalized)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return _build_vendor_response(vendor, db, include_stats=False)


@router.patch("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorResponse:
    """Update a vendor."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if payload.canonical_name:
        vendor_service = VendorService(db)
        normalized = vendor_service.normalize(payload.canonical_name)

        # Check for duplicate
        existing = (
            db.query(Vendor)
            .filter(
                Vendor.canonical_name == normalized,
                Vendor.id != vendor_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor '{normalized}' already exists",
            )

        vendor.canonical_name = normalized

    vendor.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(vendor)

    return _build_vendor_response(vendor, db)


@router.post("/{vendor_id}/category-rule", response_model=CategoryRuleResponse)
async def set_vendor_category_rule(
    vendor_id: UUID,
    payload: VendorCategoryRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryRuleResponse:
    """Set or update a vendor's category rule."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    vendor_service = VendorService(db)
    rule = vendor_service.set_vendor_category(
        vendor_id=vendor_id,
        category_id=payload.category_id,
        priority=payload.priority,
    )

    # Apply category to existing uncategorized transactions
    db.query(TransactionGroup).filter(
        TransactionGroup.vendor_id == vendor_id,
        TransactionGroup.category_id.is_(None),
    ).update({"category_id": payload.category_id})
    db.commit()

    return CategoryRuleResponse(
        id=rule.id,
        vendor_id=rule.vendor_id,
        category_id=rule.category_id,
        category_name=category.name,
        priority=rule.priority,
        enabled=rule.enabled,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.delete("/{vendor_id}/category-rule")
async def delete_vendor_category_rule(
    vendor_id: UUID,
    category_id: UUID | None = Query(None, description="Specific category rule to delete"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete vendor category rule(s)."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    query = db.query(VendorCategoryRule).filter(VendorCategoryRule.vendor_id == vendor_id)

    if category_id:
        query = query.filter(VendorCategoryRule.category_id == category_id)

    deleted = query.delete()
    db.commit()

    return {"message": f"Deleted {deleted} category rule(s)"}


@router.get("/{vendor_id}/stats", response_model=VendorStatsResponse)
async def get_vendor_stats(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorStatsResponse:
    """Get detailed statistics for a vendor."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Get transaction count
    txn_count = (
        db.query(func.count(TransactionGroup.id))
        .filter(TransactionGroup.vendor_id == vendor_id)
        .scalar()
    ) or 0

    # Sum by direction
    total_debit = (
        db.query(func.sum(TransactionGroup.amount))
        .filter(
            TransactionGroup.vendor_id == vendor_id,
            TransactionGroup.direction == TransactionDirection.DEBIT,
        )
        .scalar()
    ) or Decimal("0")

    total_credit = (
        db.query(func.sum(TransactionGroup.amount))
        .filter(
            TransactionGroup.vendor_id == vendor_id,
            TransactionGroup.direction == TransactionDirection.CREDIT,
        )
        .scalar()
    ) or Decimal("0")

    # Get date range
    first_txn = (
        db.query(func.min(TransactionGroup.occurred_at))
        .filter(TransactionGroup.vendor_id == vendor_id)
        .scalar()
    )

    last_txn = (
        db.query(func.max(TransactionGroup.occurred_at))
        .filter(TransactionGroup.vendor_id == vendor_id)
        .scalar()
    )

    return VendorStatsResponse(
        vendor_id=vendor.id,
        canonical_name=vendor.canonical_name,
        transaction_count=txn_count,
        total_debit=total_debit,
        total_credit=total_credit,
        first_transaction=first_txn,
        last_transaction=last_txn,
    )
