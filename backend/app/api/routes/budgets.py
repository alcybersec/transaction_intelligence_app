"""Budget API endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.budget import (
    BudgetCreateRequest,
    BudgetListResponse,
    BudgetProgressResponse,
    BudgetResponse,
    BudgetSummaryResponse,
    BudgetUpdateRequest,
)
from app.services.budget import BudgetService

router = APIRouter()


@router.post("", response_model=BudgetProgressResponse, status_code=201)
async def create_budget(
    request: BudgetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetProgressResponse:
    """
    Create a new budget for a category/month.

    Budget limits spending for a category in a specific month.
    Can be scoped to a wallet or apply to all wallets.
    """
    service = BudgetService(db)

    try:
        budget = service.create_budget(request)
        response = service.get_budget_with_progress(budget.id)
        if not response:
            raise HTTPException(status_code=500, detail="Failed to create budget")
        return response
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("", response_model=BudgetListResponse)
async def list_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    month: date = Query(..., description="Month to get budgets for (any day in month)"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
) -> BudgetListResponse:
    """
    List all budgets for a month with spending progress.
    """
    service = BudgetService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    return service.list_budgets(month=month, wallet_id=wallet_uuid)


@router.get("/summary", response_model=BudgetSummaryResponse)
async def get_budget_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    month: date = Query(..., description="Month to get summary for"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
) -> BudgetSummaryResponse:
    """
    Get budget summary for a month.

    Returns totals for all budgets including over-budget count.
    """
    service = BudgetService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    return service.get_budget_summary(month=month, wallet_id=wallet_uuid)


@router.get("/{budget_id}", response_model=BudgetProgressResponse)
async def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetProgressResponse:
    """
    Get a budget by ID with spending progress.
    """
    service = BudgetService(db)
    response = service.get_budget_with_progress(budget_id)

    if not response:
        raise HTTPException(status_code=404, detail="Budget not found")

    return response


@router.patch("/{budget_id}", response_model=BudgetProgressResponse)
async def update_budget(
    budget_id: UUID,
    request: BudgetUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BudgetProgressResponse:
    """
    Update a budget's limit amount.
    """
    service = BudgetService(db)
    budget = service.update_budget(budget_id, request)

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    response = service.get_budget_with_progress(budget_id)
    if not response:
        raise HTTPException(status_code=500, detail="Failed to get updated budget")

    return response


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a budget.
    """
    service = BudgetService(db)
    deleted = service.delete_budget(budget_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Budget not found")


@router.post("/copy", response_model=BudgetListResponse)
async def copy_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    source_month: date = Query(..., description="Month to copy from"),
    target_month: date = Query(..., description="Month to copy to"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
) -> BudgetListResponse:
    """
    Copy budgets from one month to another.

    Useful for setting up next month's budgets based on current month.
    Skips any budgets that already exist in the target month.
    """
    service = BudgetService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    service.copy_budgets_to_month(
        source_month=source_month,
        target_month=target_month,
        wallet_id=wallet_uuid,
    )

    # Return the new month's budgets
    return service.list_budgets(month=target_month, wallet_id=wallet_uuid)
