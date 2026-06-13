"""Savings goals CRUD + contribute."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.db.models.savings_goal import SavingsGoal
from app.schemas.savings_goal import (
    SavingsGoalContribute,
    SavingsGoalCreate,
    SavingsGoalResponse,
    SavingsGoalUpdate,
)

router = APIRouter()


@router.get("", response_model=list[SavingsGoalResponse])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.created_at.desc())
        .all()
    )


@router.post("", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = SavingsGoal(
        user_id=current_user.id,
        name=payload.name,
        target_amount=payload.target_amount,
        saved_amount=Decimal("0"),
        target_date=payload.target_date,
        color=payload.color,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


def _get_owned(db: Session, goal_id: UUID, user_id: UUID) -> SavingsGoal:
    g = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == user_id)
        .first()
    )
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    return g


@router.patch("/{goal_id}", response_model=SavingsGoalResponse)
def update_goal(
    goal_id: UUID,
    payload: SavingsGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    for field in ("name", "target_amount", "target_date", "color"):
        v = getattr(payload, field)
        if v is not None:
            setattr(g, field, v)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    db.delete(g)
    db.commit()


@router.post("/{goal_id}/contribute", response_model=SavingsGoalResponse)
def contribute_to_goal(
    goal_id: UUID,
    payload: SavingsGoalContribute,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = _get_owned(db, goal_id, current_user.id)
    new_saved = g.saved_amount + payload.amount
    if new_saved > g.target_amount:
        new_saved = g.target_amount
    g.saved_amount = new_saved
    db.commit()
    db.refresh(g)
    return g
