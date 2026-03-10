"""AI-powered chat service for spending Q&A."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.models import (
    Category,
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
    Vendor,
    Wallet,
)
from app.services.ollama import OllamaError, get_ollama_service

logger = get_logger(__name__)


# Allowlist of query types with their parameters and descriptions
ALLOWED_QUERIES = [
    {
        "type": "total_spending",
        "description": "Get total spending for a period",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "category_id": "Optional category UUID",
            "wallet_id": "Optional wallet UUID",
        },
    },
    {
        "type": "total_income",
        "description": "Get total income for a period",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "wallet_id": "Optional wallet UUID",
        },
    },
    {
        "type": "category_breakdown",
        "description": "Get spending breakdown by category",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "wallet_id": "Optional wallet UUID",
            "limit": "Number of categories to return (default 10)",
        },
    },
    {
        "type": "top_vendors",
        "description": "Get top vendors by spending",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "category_id": "Optional category UUID",
            "wallet_id": "Optional wallet UUID",
            "limit": "Number of vendors to return (default 10)",
        },
    },
    {
        "type": "vendor_spending",
        "description": "Get spending at a specific vendor",
        "parameters": {
            "vendor_name": "Vendor name to search for",
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
        },
    },
    {
        "type": "spending_trend",
        "description": "Get daily/weekly/monthly spending trend, optionally filtered by vendor",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "granularity": "day, week, or month",
            "category_id": "Optional category UUID",
            "vendor_name": "Optional vendor name to filter by",
        },
    },
    {
        "type": "transaction_count",
        "description": "Count transactions for a period",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "direction": "debit or credit (optional)",
            "category_id": "Optional category UUID",
        },
    },
    {
        "type": "average_transaction",
        "description": "Get average transaction amount",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "direction": "debit or credit (optional)",
            "category_id": "Optional category UUID",
        },
    },
    {
        "type": "largest_transactions",
        "description": "Get largest transactions",
        "parameters": {
            "period_start": "ISO date (YYYY-MM-DD)",
            "period_end": "ISO date (YYYY-MM-DD)",
            "direction": "debit or credit (optional)",
            "limit": "Number of transactions to return (default 5)",
        },
    },
    {
        "type": "balance_check",
        "description": "Get current wallet balance",
        "parameters": {
            "wallet_id": "Optional wallet UUID (defaults to all wallets)",
        },
    },
]


class ChatService:
    """
    AI-powered chat service for spending Q&A.

    Uses a two-stage approach:
    1. LLM generates a structured query plan from natural language
    2. Backend validates and executes safe parameterized queries
    3. LLM summarizes results in natural language
    """

    def __init__(self, db: Session):
        self.db = db
        self.ollama = get_ollama_service()

    def is_available(self) -> bool:
        """Check if chat service is available."""
        return self.ollama.is_configured

    def ask(
        self,
        question: str,
        wallet_id: UUID | None = None,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """
        Answer a user question about their spending.

        Args:
            question: Natural language question
            wallet_id: Optional wallet context
            conversation_history: Recent conversation history for follow-up context

        Returns:
            Dict with answer, highlights, chart suggestion, and query metadata
        """
        if not self.ollama.is_configured:
            return {
                "answer": "AI chat is not available. Please configure Ollama to use this feature.",
                "error": "ollama_not_configured",
            }

        try:
            # Step 1: Generate query plan from question
            query_plan = self._generate_query_plan(question, conversation_history)

            if not query_plan:
                return {
                    "answer": "I couldn't understand your question. Please try rephrasing it.",
                    "error": "plan_generation_failed",
                }

            # Step 2: Validate query plan
            validation_error = self._validate_query_plan(query_plan)
            if validation_error:
                return {
                    "answer": f"I can't answer that type of question. {validation_error}",
                    "error": "invalid_query_type",
                }

            # Step 3: Execute query
            results = self._execute_query(query_plan, wallet_id)

            # Step 4: Generate summary
            summary = self._summarize_results(question, query_plan, results)

            return {
                "answer": summary.get("answer", "No results found."),
                "highlights": summary.get("highlights", []),
                "chart_type": summary.get("chart_type", "none"),
                "query_info": {
                    "type": query_plan.get("query_type"),
                    "explanation": query_plan.get("explanation"),
                },
                "data": results,
            }

        except OllamaError as e:
            logger.error(f"Ollama error in chat: {e}")
            return {
                "answer": "I encountered an error while processing your question. Please try again.",
                "error": str(e),
            }
        except Exception as e:
            logger.exception(f"Error in chat: {e}")
            return {
                "answer": "An unexpected error occurred. Please try again.",
                "error": str(e),
            }

    def _get_data_range(self) -> dict[str, str] | None:
        """Get the date range of available transaction data."""
        try:
            result = (
                self.db.query(
                    func.min(TransactionGroup.occurred_at),
                    func.max(TransactionGroup.occurred_at),
                )
                .filter(TransactionGroup.status == TransactionStatus.POSTED)
                .first()
            )

            if result and result[0] and result[1]:
                return {
                    "earliest": result[0].date().isoformat(),
                    "latest": result[1].date().isoformat(),
                }
        except Exception as e:
            logger.warning(f"Failed to get data range: {e}")
        return None

    def _generate_query_plan(
        self,
        question: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any] | None:
        """Generate a query plan from natural language."""
        try:
            data_range = self._get_data_range()
            return self.ollama.generate_query_plan(
                question, ALLOWED_QUERIES, data_range, conversation_history
            )
        except OllamaError as e:
            logger.warning(f"Failed to generate query plan: {e}")
            return None

    def _validate_query_plan(self, plan: dict[str, Any]) -> str | None:
        """
        Validate that the query plan is allowed.

        Returns error message if invalid, None if valid.
        """
        query_type = plan.get("query_type")

        # Check if query type is in allowlist
        allowed_types = [q["type"] for q in ALLOWED_QUERIES]
        if query_type not in allowed_types:
            return f"Query type '{query_type}' is not supported."

        # Validate parameters exist and are safe
        params = plan.get("parameters", {})

        # Check for any suspicious values (basic SQL injection prevention)
        for key, value in params.items():
            if isinstance(value, str):
                suspicious = ["'", '"', ";", "--", "/*", "*/", "DROP", "DELETE", "INSERT", "UPDATE"]
                if any(s in value.upper() for s in suspicious):
                    return f"Invalid characters in parameter '{key}'."

        return None

    def _execute_query(
        self,
        plan: dict[str, Any],
        wallet_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Execute a validated query plan."""
        query_type = plan.get("query_type")
        params = plan.get("parameters", {})

        # Override wallet_id if provided
        if wallet_id:
            params["wallet_id"] = str(wallet_id)

        # Parse common date parameters
        period_start = self._parse_date(params.get("period_start"))
        period_end = self._parse_date(params.get("period_end"))

        # Default to last 30 days if not specified
        if not period_end:
            period_end = date.today()
        if not period_start:
            period_start = period_end - timedelta(days=30)

        # Route to appropriate executor
        executors = {
            "total_spending": self._query_total_spending,
            "total_income": self._query_total_income,
            "category_breakdown": self._query_category_breakdown,
            "top_vendors": self._query_top_vendors,
            "vendor_spending": self._query_vendor_spending,
            "spending_trend": self._query_spending_trend,
            "transaction_count": self._query_transaction_count,
            "average_transaction": self._query_average_transaction,
            "largest_transactions": self._query_largest_transactions,
            "balance_check": self._query_balance,
        }

        executor = executors.get(query_type)
        if not executor:
            return {"error": f"Unknown query type: {query_type}"}

        return executor(period_start, period_end, params)

    def _parse_date(self, date_str: str | None) -> date | None:
        """Parse a date string safely."""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    def _parse_uuid(self, uuid_str: str | None) -> UUID | None:
        """Parse a UUID string safely."""
        if not uuid_str:
            return None
        try:
            return UUID(uuid_str)
        except (ValueError, TypeError):
            return None

    def _base_query(self, period_start: date, period_end: date):
        """Create base query with common filters."""
        return self.db.query(TransactionGroup).filter(
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.status == TransactionStatus.POSTED,
        )

    def _query_total_spending(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query total spending."""
        query = self.db.query(func.sum(TransactionGroup.amount)).filter(
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.direction == TransactionDirection.DEBIT,
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        wallet_id = self._parse_uuid(params.get("wallet_id"))
        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        category_id = self._parse_uuid(params.get("category_id"))
        if category_id:
            query = query.filter(TransactionGroup.category_id == category_id)

        total = query.scalar() or Decimal("0")

        return {
            "total_spending": float(total),
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_total_income(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query total income."""
        query = self.db.query(func.sum(TransactionGroup.amount)).filter(
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.direction == TransactionDirection.CREDIT,
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        wallet_id = self._parse_uuid(params.get("wallet_id"))
        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        total = query.scalar() or Decimal("0")

        return {
            "total_income": float(total),
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_category_breakdown(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query spending breakdown by category."""
        limit = min(int(params.get("limit", 10)), 20)

        query = (
            self.db.query(
                Category.name,
                func.sum(TransactionGroup.amount).label("total"),
                func.count(TransactionGroup.id).label("count"),
            )
            .outerjoin(Category, TransactionGroup.category_id == Category.id)
            .filter(
                TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
                TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
                TransactionGroup.direction == TransactionDirection.DEBIT,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            .group_by(Category.id, Category.name)
            .order_by(func.sum(TransactionGroup.amount).desc())
            .limit(limit)
        )

        wallet_id = self._parse_uuid(params.get("wallet_id"))
        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        results = query.all()

        categories = [
            {
                "category": r[0] or "Uncategorized",
                "total": float(r[1] or 0),
                "count": r[2],
            }
            for r in results
        ]

        total = sum(c["total"] for c in categories)

        return {
            "categories": categories,
            "total": total,
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_top_vendors(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query top vendors by spending."""
        limit = min(int(params.get("limit", 10)), 20)

        query = (
            self.db.query(
                Vendor.canonical_name,
                func.sum(TransactionGroup.amount).label("total"),
                func.count(TransactionGroup.id).label("count"),
            )
            .join(Vendor, TransactionGroup.vendor_id == Vendor.id)
            .filter(
                TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
                TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
                TransactionGroup.direction == TransactionDirection.DEBIT,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            .group_by(Vendor.id, Vendor.canonical_name)
            .order_by(func.sum(TransactionGroup.amount).desc())
            .limit(limit)
        )

        wallet_id = self._parse_uuid(params.get("wallet_id"))
        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        category_id = self._parse_uuid(params.get("category_id"))
        if category_id:
            query = query.filter(TransactionGroup.category_id == category_id)

        results = query.all()

        vendors = [
            {
                "vendor": r[0],
                "total": float(r[1] or 0),
                "count": r[2],
            }
            for r in results
        ]

        return {
            "vendors": vendors,
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_vendor_spending(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query spending at a specific vendor."""
        vendor_name = params.get("vendor_name", "")

        # Find matching vendors, ordered by transaction count (most active first)
        matching_vendors = (
            self.db.query(Vendor, func.count(TransactionGroup.id).label("txn_count"))
            .outerjoin(TransactionGroup, TransactionGroup.vendor_id == Vendor.id)
            .filter(Vendor.canonical_name.ilike(f"%{vendor_name}%"))
            .group_by(Vendor.id)
            .order_by(func.count(TransactionGroup.id).desc())
            .all()
        )

        vendor = matching_vendors[0][0] if matching_vendors else None

        if not vendor:
            return {
                "vendor": vendor_name,
                "total": 0,
                "count": 0,
                "message": f"No vendor found matching '{vendor_name}'",
            }

        query = self.db.query(
            func.sum(TransactionGroup.amount).label("total"),
            func.count(TransactionGroup.id).label("count"),
        ).filter(
            TransactionGroup.vendor_id == vendor.id,
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.direction == TransactionDirection.DEBIT,
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        result = query.first()

        return {
            "vendor": vendor.canonical_name,
            "total": float(result[0] or 0),
            "count": result[1] or 0,
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_spending_trend(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query spending trend over time."""
        granularity = params.get("granularity", "day")

        # Determine date truncation
        if granularity == "month":
            date_trunc = func.date_trunc("month", TransactionGroup.occurred_at)
        elif granularity == "week":
            date_trunc = func.date_trunc("week", TransactionGroup.occurred_at)
        else:
            date_trunc = func.date_trunc("day", TransactionGroup.occurred_at)

        query = (
            self.db.query(
                date_trunc.label("period"),
                func.sum(TransactionGroup.amount).label("total"),
                func.count(TransactionGroup.id).label("count"),
            )
            .filter(
                TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
                TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
                TransactionGroup.direction == TransactionDirection.DEBIT,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            .group_by(date_trunc)
            .order_by(date_trunc)
        )

        category_id = self._parse_uuid(params.get("category_id"))
        if category_id:
            query = query.filter(TransactionGroup.category_id == category_id)

        # Filter by vendor if specified
        vendor_name = params.get("vendor_name")
        if vendor_name:
            matching_vendors = (
                self.db.query(Vendor, func.count(TransactionGroup.id).label("txn_count"))
                .outerjoin(TransactionGroup, TransactionGroup.vendor_id == Vendor.id)
                .filter(Vendor.canonical_name.ilike(f"%{vendor_name}%"))
                .group_by(Vendor.id)
                .order_by(func.count(TransactionGroup.id).desc())
                .all()
            )
            vendor = matching_vendors[0][0] if matching_vendors else None
            if vendor:
                query = query.filter(TransactionGroup.vendor_id == vendor.id)

        results = query.all()

        trend = [
            {
                "period": r[0].isoformat() if r[0] else None,
                "total": float(r[1] or 0),
                "count": r[2],
            }
            for r in results
        ]

        result = {
            "trend": trend,
            "granularity": granularity,
            "currency": "AED",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }
        if vendor_name:
            result["vendor"] = (
                vendor.canonical_name if (matching_vendors and vendor) else vendor_name
            )
        return result

    def _query_transaction_count(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query transaction count."""
        query = self.db.query(func.count(TransactionGroup.id)).filter(
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        direction = params.get("direction")
        if direction == "debit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.DEBIT)
        elif direction == "credit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.CREDIT)

        category_id = self._parse_uuid(params.get("category_id"))
        if category_id:
            query = query.filter(TransactionGroup.category_id == category_id)

        count = query.scalar() or 0

        return {
            "count": count,
            "direction": direction or "all",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_average_transaction(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query average transaction amount."""
        query = self.db.query(
            func.avg(TransactionGroup.amount),
            func.count(TransactionGroup.id),
        ).filter(
            TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
            TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        direction = params.get("direction")
        if direction == "debit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.DEBIT)
        elif direction == "credit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.CREDIT)

        category_id = self._parse_uuid(params.get("category_id"))
        if category_id:
            query = query.filter(TransactionGroup.category_id == category_id)

        result = query.first()

        return {
            "average": float(result[0] or 0),
            "count": result[1] or 0,
            "currency": "AED",
            "direction": direction or "all",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_largest_transactions(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query largest transactions."""
        limit = min(int(params.get("limit", 5)), 10)

        query = (
            self.db.query(TransactionGroup)
            .outerjoin(Vendor, TransactionGroup.vendor_id == Vendor.id)
            .filter(
                TransactionGroup.occurred_at >= datetime.combine(period_start, datetime.min.time()),
                TransactionGroup.occurred_at <= datetime.combine(period_end, datetime.max.time()),
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            .order_by(TransactionGroup.amount.desc())
            .limit(limit)
        )

        direction = params.get("direction")
        if direction == "debit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.DEBIT)
        elif direction == "credit":
            query = query.filter(TransactionGroup.direction == TransactionDirection.CREDIT)

        transactions = query.all()

        return {
            "transactions": [
                {
                    "amount": float(t.amount),
                    "currency": t.currency,
                    "vendor": t.vendor.canonical_name if t.vendor else "Unknown",
                    "date": t.occurred_at.isoformat() if t.occurred_at else None,
                    "direction": t.direction.value if t.direction else "debit",
                }
                for t in transactions
            ],
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        }

    def _query_balance(
        self,
        period_start: date,
        period_end: date,
        params: dict,
    ) -> dict[str, Any]:
        """Query current wallet balance."""
        wallet_id = self._parse_uuid(params.get("wallet_id"))

        query = self.db.query(Wallet)
        if wallet_id:
            query = query.filter(Wallet.id == wallet_id)

        wallets = query.all()

        if not wallets:
            return {
                "wallets": [],
                "total_balance": 0,
                "currency": "AED",
            }

        wallet_data = [
            {
                "name": w.name,
                "balance": float(w.combined_balance_last or 0),
                "currency": w.currency,
                "updated_at": w.updated_at.isoformat() if w.updated_at else None,
            }
            for w in wallets
        ]

        total = sum(w["balance"] for w in wallet_data)

        return {
            "wallets": wallet_data,
            "total_balance": total,
            "currency": "AED",
        }

    def _summarize_results(
        self,
        question: str,
        query_plan: dict[str, Any],
        results: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate natural language summary of results."""
        try:
            return self.ollama.summarize_query_results(question, query_plan, results)
        except OllamaError as e:
            logger.warning(f"Failed to summarize results: {e}")
            # Return basic summary
            return {
                "answer": self._basic_summary(results),
                "highlights": [],
                "chart_type": "none",
            }

    def _basic_summary(self, results: dict[str, Any]) -> str:
        """Generate basic summary without AI."""
        if "total_spending" in results:
            return f"Total spending: AED {results['total_spending']:,.2f}"
        elif "total_income" in results:
            return f"Total income: AED {results['total_income']:,.2f}"
        elif "categories" in results:
            top = results["categories"][:3] if results["categories"] else []
            if top:
                items = ", ".join(f"{c['category']} (AED {c['total']:,.2f})" for c in top)
                return f"Top categories: {items}"
        elif "vendors" in results:
            top = results["vendors"][:3] if results["vendors"] else []
            if top:
                items = ", ".join(f"{v['vendor']} (AED {v['total']:,.2f})" for v in top)
                return f"Top vendors: {items}"
        elif "count" in results:
            return f"Transaction count: {results['count']}"
        elif "average" in results:
            return f"Average transaction: AED {results['average']:,.2f}"

        return "Query completed. See data for details."
