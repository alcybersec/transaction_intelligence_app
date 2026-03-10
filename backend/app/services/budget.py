"""Budget service for managing category spending limits."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Budget,
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
)
from app.schemas.budget import (
    BudgetCreateRequest,
    BudgetListResponse,
    BudgetProgressResponse,
    BudgetSummaryResponse,
    BudgetUpdateRequest,
)


class BudgetService:
    """Service for budget management."""

    def __init__(self, db: Session):
        self.db = db

    def create_budget(self, request: BudgetCreateRequest) -> Budget:
        """
        Create a new budget.

        Args:
            request: Budget creation request

        Returns:
            Created budget

        Raises:
            ValueError: If budget already exists for this category/month
        """
        # Normalize month to first day
        month_start = request.month.replace(day=1)

        # Check for existing budget
        existing = (
            self.db.query(Budget)
            .filter(
                Budget.wallet_id == request.wallet_id,
                Budget.category_id == request.category_id,
                Budget.month == month_start,
            )
            .first()
        )
        if existing:
            raise ValueError("Budget already exists for this category and month")

        budget = Budget(
            wallet_id=request.wallet_id,
            category_id=request.category_id,
            month=month_start,
            limit_amount=request.limit_amount,
            currency=request.currency,
        )
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def update_budget(self, budget_id: UUID, request: BudgetUpdateRequest) -> Budget | None:
        """Update a budget."""
        budget = self.db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            return None

        if request.limit_amount is not None:
            budget.limit_amount = request.limit_amount
        if request.currency is not None:
            budget.currency = request.currency

        budget.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def delete_budget(self, budget_id: UUID) -> bool:
        """Delete a budget."""
        budget = self.db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            return False

        self.db.delete(budget)
        self.db.commit()
        return True

    def get_budget(self, budget_id: UUID) -> Budget | None:
        """Get a budget by ID."""
        return (
            self.db.query(Budget)
            .options(joinedload(Budget.category), joinedload(Budget.wallet))
            .filter(Budget.id == budget_id)
            .first()
        )

    def get_budget_with_progress(self, budget_id: UUID) -> BudgetProgressResponse | None:
        """Get a budget with spending progress."""
        budget = self.get_budget(budget_id)
        if not budget:
            return None

        spent = self._calculate_spending(
            budget.category_id,
            budget.month,
            budget.wallet_id,
        )

        return self._build_progress_response(budget, spent)

    def list_budgets(
        self,
        month: date,
        wallet_id: UUID | None = None,
    ) -> BudgetListResponse:
        """
        List all budgets for a month with progress.

        Args:
            month: The month to get budgets for
            wallet_id: Optional wallet filter

        Returns:
            List of budgets with progress
        """
        month_start = month.replace(day=1)

        query = (
            self.db.query(Budget)
            .options(joinedload(Budget.category), joinedload(Budget.wallet))
            .filter(Budget.month == month_start)
        )

        if wallet_id:
            query = query.filter(Budget.wallet_id == wallet_id)

        budgets = query.order_by(Budget.created_at).all()

        # Calculate progress for each budget
        budget_responses = []
        for budget in budgets:
            spent = self._calculate_spending(
                budget.category_id,
                budget.month,
                budget.wallet_id,
            )
            budget_responses.append(self._build_progress_response(budget, spent))

        return BudgetListResponse(
            budgets=budget_responses,
            total=len(budget_responses),
            month=month_start,
        )

    def get_budget_summary(
        self,
        month: date,
        wallet_id: UUID | None = None,
    ) -> BudgetSummaryResponse:
        """
        Get summary of all budgets for a month.

        Args:
            month: The month
            wallet_id: Optional wallet filter

        Returns:
            Budget summary with totals
        """
        budgets_response = self.list_budgets(month, wallet_id)

        total_budgeted = Decimal("0")
        total_spent = Decimal("0")
        over_budget_count = 0

        for b in budgets_response.budgets:
            total_budgeted += b.limit_amount
            total_spent += b.spent_amount
            if b.is_over_budget:
                over_budget_count += 1

        return BudgetSummaryResponse(
            month=month.replace(day=1),
            total_budgeted=total_budgeted,
            total_spent=total_spent,
            total_remaining=total_budgeted - total_spent,
            budgets_count=budgets_response.total,
            over_budget_count=over_budget_count,
            currency="AED",
        )

    def copy_budgets_to_month(
        self,
        source_month: date,
        target_month: date,
        wallet_id: UUID | None = None,
    ) -> list[Budget]:
        """
        Copy budgets from one month to another.

        Args:
            source_month: Month to copy from
            target_month: Month to copy to
            wallet_id: Optional wallet filter

        Returns:
            List of created budgets
        """
        source_start = source_month.replace(day=1)
        target_start = target_month.replace(day=1)

        query = self.db.query(Budget).filter(Budget.month == source_start)
        if wallet_id:
            query = query.filter(Budget.wallet_id == wallet_id)

        source_budgets = query.all()
        created = []

        for source in source_budgets:
            # Check if already exists
            existing = (
                self.db.query(Budget)
                .filter(
                    Budget.wallet_id == source.wallet_id,
                    Budget.category_id == source.category_id,
                    Budget.month == target_start,
                )
                .first()
            )
            if existing:
                continue

            new_budget = Budget(
                wallet_id=source.wallet_id,
                category_id=source.category_id,
                month=target_start,
                limit_amount=source.limit_amount,
                currency=source.currency,
            )
            self.db.add(new_budget)
            created.append(new_budget)

        self.db.commit()
        for b in created:
            self.db.refresh(b)

        return created

    def _calculate_spending(
        self,
        category_id: UUID,
        month: date,
        wallet_id: UUID | None = None,
    ) -> Decimal:
        """Calculate total spending for a category in a month."""
        # Get month boundaries
        month_start = datetime.combine(month.replace(day=1), datetime.min.time())
        if month.month == 12:
            next_month = month.replace(year=month.year + 1, month=1, day=1)
        else:
            next_month = month.replace(month=month.month + 1, day=1)
        month_end = datetime.combine(next_month, datetime.min.time())

        query = self.db.query(func.sum(TransactionGroup.amount)).filter(
            TransactionGroup.category_id == category_id,
            TransactionGroup.direction == TransactionDirection.DEBIT,
            TransactionGroup.status == TransactionStatus.POSTED,
            TransactionGroup.occurred_at >= month_start,
            TransactionGroup.occurred_at < month_end,
        )

        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        return query.scalar() or Decimal("0")

    def _build_progress_response(
        self,
        budget: Budget,
        spent: Decimal,
    ) -> BudgetProgressResponse:
        """Build a budget progress response."""
        remaining = budget.limit_amount - spent
        percentage = float(spent / budget.limit_amount * 100) if budget.limit_amount > 0 else 0.0
        is_over = spent > budget.limit_amount

        return BudgetProgressResponse(
            id=budget.id,
            wallet_id=budget.wallet_id,
            wallet_name=budget.wallet.name if budget.wallet else None,
            category_id=budget.category_id,
            category_name=budget.category.name if budget.category else "Unknown",
            category_icon=budget.category.icon if budget.category else None,
            category_color=budget.category.color if budget.category else None,
            month=budget.month,
            limit_amount=budget.limit_amount,
            spent_amount=spent,
            remaining_amount=remaining,
            percentage_used=round(percentage, 1),
            is_over_budget=is_over,
            currency=budget.currency,
        )
