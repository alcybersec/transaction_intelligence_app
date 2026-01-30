"""AI-powered categorization service for vendors."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.models import (
    Category,
    CategorySuggestion,
    TransactionDirection,
    TransactionGroup,
    Vendor,
    VendorCategoryRule,
)
from app.services.ollama import OllamaError, get_ollama_service

logger = get_logger(__name__)

# Number of concurrent Ollama requests for batch processing
BATCH_CONCURRENCY = 6


class CategorizationService:
    """
    Service for AI-powered vendor categorization.

    Provides methods for:
    - Generating category suggestions for vendors
    - Accepting/rejecting suggestions
    - Batch categorization of uncategorized vendors
    """

    def __init__(self, db: Session):
        self.db = db
        self.ollama = get_ollama_service()

    def get_categories_list(self) -> list[dict[str, str]]:
        """Get all categories formatted for AI prompts."""
        categories = (
            self.db.query(Category)
            .order_by(Category.sort_order, Category.name)
            .all()
        )
        return [{"id": str(c.id), "name": c.name} for c in categories]

    def get_vendor_transaction_history(
        self,
        vendor_id: UUID,
        limit: int = 5,
    ) -> list[dict]:
        """Get recent transactions for a vendor."""
        transactions = (
            self.db.query(TransactionGroup)
            .filter(TransactionGroup.vendor_id == vendor_id)
            .order_by(TransactionGroup.occurred_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "amount": float(t.amount),
                "currency": t.currency,
                "date": t.occurred_at.isoformat() if t.occurred_at else None,
                "direction": t.direction.value if t.direction else "debit",
            }
            for t in transactions
        ]

    def suggest_category(
        self,
        vendor_id: UUID,
        force: bool = False,
    ) -> CategorySuggestion | None:
        """
        Generate or retrieve a category suggestion for a vendor.

        Args:
            vendor_id: UUID of the vendor
            force: Force regeneration even if a pending suggestion exists

        Returns:
            CategorySuggestion or None if AI is not configured
        """
        # Check if vendor exists
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            logger.warning(f"Vendor {vendor_id} not found")
            return None

        # Check for existing pending suggestion
        if not force:
            existing = (
                self.db.query(CategorySuggestion)
                .filter(
                    CategorySuggestion.vendor_id == vendor_id,
                    CategorySuggestion.status == "pending",
                )
                .first()
            )
            if existing:
                return existing

        # Check if Ollama is configured
        if not self.ollama.is_configured:
            logger.warning("Ollama is not configured, cannot generate suggestion")
            return None

        # Get categories and transaction history
        categories = self.get_categories_list()
        if not categories:
            logger.warning("No categories available")
            return None

        history = self.get_vendor_transaction_history(vendor_id)

        try:
            # Generate suggestion from AI
            result = self.ollama.suggest_category(
                vendor_name=vendor.canonical_name,
                categories=categories,
                transaction_history=history if history else None,
            )

            # Validate category_id
            suggested_category_id = result.get("category_id")
            if not suggested_category_id:
                logger.warning("AI returned no category_id")
                return None

            # Verify category exists
            category = (
                self.db.query(Category)
                .filter(Category.id == suggested_category_id)
                .first()
            )
            if not category:
                logger.warning(f"AI suggested invalid category: {suggested_category_id}")
                return None

            # Create suggestion record
            suggestion = CategorySuggestion(
                vendor_id=vendor_id,
                suggested_category_id=category.id,
                model=self.ollama.model,
                confidence=result.get("confidence", 0.5),
                rationale=result.get("rationale", ""),
                status="pending",
            )

            # Mark any existing pending suggestions as superseded
            self.db.query(CategorySuggestion).filter(
                CategorySuggestion.vendor_id == vendor_id,
                CategorySuggestion.status == "pending",
            ).update({"status": "rejected", "updated_at": datetime.utcnow()})

            self.db.add(suggestion)
            self.db.commit()
            self.db.refresh(suggestion)

            logger.info(
                f"Generated category suggestion for vendor {vendor.canonical_name}: "
                f"{category.name} (confidence: {suggestion.confidence})"
            )

            return suggestion

        except OllamaError as e:
            logger.error(f"Ollama error generating suggestion: {e}")
            return None
        except Exception as e:
            logger.exception(f"Error generating suggestion: {e}")
            return None

    def accept_suggestion(
        self,
        suggestion_id: UUID,
        create_rule: bool = True,
    ) -> VendorCategoryRule | None:
        """
        Accept a category suggestion.

        Args:
            suggestion_id: UUID of the suggestion
            create_rule: Whether to create a manual rule

        Returns:
            VendorCategoryRule if created, None otherwise
        """
        suggestion = (
            self.db.query(CategorySuggestion)
            .filter(CategorySuggestion.id == suggestion_id)
            .first()
        )

        if not suggestion:
            logger.warning(f"Suggestion {suggestion_id} not found")
            return None

        if suggestion.status != "pending":
            logger.warning(f"Suggestion {suggestion_id} is not pending")
            return None

        # Update suggestion status
        suggestion.status = "accepted"
        suggestion.updated_at = datetime.utcnow()

        rule = None
        if create_rule:
            # Check for existing rule
            existing_rule = (
                self.db.query(VendorCategoryRule)
                .filter(
                    VendorCategoryRule.vendor_id == suggestion.vendor_id,
                    VendorCategoryRule.category_id == suggestion.suggested_category_id,
                )
                .first()
            )

            if existing_rule:
                existing_rule.enabled = True
                existing_rule.updated_at = datetime.utcnow()
                rule = existing_rule
            else:
                rule = VendorCategoryRule(
                    vendor_id=suggestion.vendor_id,
                    category_id=suggestion.suggested_category_id,
                    priority=0,
                    enabled=True,
                )
                self.db.add(rule)

        self.db.commit()
        if rule:
            self.db.refresh(rule)

        logger.info(f"Accepted suggestion {suggestion_id}")
        return rule

    def reject_suggestion(
        self,
        suggestion_id: UUID,
        alternative_category_id: UUID | None = None,
    ) -> bool:
        """
        Reject a category suggestion.

        Args:
            suggestion_id: UUID of the suggestion
            alternative_category_id: Optional alternative category to set

        Returns:
            True if successful
        """
        suggestion = (
            self.db.query(CategorySuggestion)
            .filter(CategorySuggestion.id == suggestion_id)
            .first()
        )

        if not suggestion:
            logger.warning(f"Suggestion {suggestion_id} not found")
            return False

        if suggestion.status != "pending":
            logger.warning(f"Suggestion {suggestion_id} is not pending")
            return False

        # Update suggestion status
        suggestion.status = "rejected"
        suggestion.updated_at = datetime.utcnow()

        # If alternative provided, create a manual rule
        if alternative_category_id:
            existing_rule = (
                self.db.query(VendorCategoryRule)
                .filter(
                    VendorCategoryRule.vendor_id == suggestion.vendor_id,
                    VendorCategoryRule.category_id == alternative_category_id,
                )
                .first()
            )

            if existing_rule:
                existing_rule.enabled = True
                existing_rule.updated_at = datetime.utcnow()
            else:
                rule = VendorCategoryRule(
                    vendor_id=suggestion.vendor_id,
                    category_id=alternative_category_id,
                    priority=0,
                    enabled=True,
                )
                self.db.add(rule)

        self.db.commit()
        logger.info(f"Rejected suggestion {suggestion_id}")
        return True

    def get_pending_suggestions(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[CategorySuggestion], int]:
        """
        Get all pending category suggestions.

        Returns:
            Tuple of (suggestions list, total count)
        """
        query = (
            self.db.query(CategorySuggestion)
            .filter(CategorySuggestion.status == "pending")
            .order_by(CategorySuggestion.created_at.desc())
        )

        total = query.count()
        suggestions = query.offset(offset).limit(limit).all()

        return suggestions, total

    def get_uncategorized_vendors(self, limit: int = 50) -> list[Vendor]:
        """Get vendors without category rules or pending suggestions."""
        # Subquery for vendors with rules
        vendors_with_rules = (
            self.db.query(VendorCategoryRule.vendor_id)
            .filter(VendorCategoryRule.enabled == True)
            .distinct()
        )

        # Subquery for vendors with pending suggestions
        vendors_with_pending = (
            self.db.query(CategorySuggestion.vendor_id)
            .filter(CategorySuggestion.status == "pending")
            .distinct()
        )

        return (
            self.db.query(Vendor)
            .filter(
                Vendor.id.not_in(vendors_with_rules),
                Vendor.id.not_in(vendors_with_pending),
            )
            .order_by(Vendor.created_at.desc())
            .limit(limit)
            .all()
        )

    def batch_suggest_categories(
        self,
        vendor_ids: list[UUID] | None = None,
        max_vendors: int = 10,
        process_all: bool = False,
        concurrency: int = BATCH_CONCURRENCY,
    ) -> dict[str, int]:
        """
        Generate suggestions for multiple vendors using parallel processing.

        Args:
            vendor_ids: Optional list of specific vendors
            max_vendors: Batch size (vendors per iteration)
            process_all: If True, iterate through ALL uncategorized vendors
            concurrency: Number of parallel Ollama requests (default: 6)

        Returns:
            Statistics dict with success/failure counts
        """
        stats = {"processed": 0, "success": 0, "failed": 0, "skipped": 0}

        if vendor_ids:
            vendors = (
                self.db.query(Vendor)
                .filter(Vendor.id.in_(vendor_ids))
                .all()
            )
            self._process_vendor_batch_parallel(vendors, stats, concurrency)
        elif process_all:
            # Process all uncategorized vendors in batches
            while True:
                vendors = self.get_uncategorized_vendors(limit=max_vendors)
                if not vendors:
                    break
                self._process_vendor_batch_parallel(vendors, stats, concurrency)
        else:
            vendors = self.get_uncategorized_vendors(limit=max_vendors)
            self._process_vendor_batch_parallel(vendors, stats, concurrency)

        return stats

    def _process_single_vendor(self, vendor_id: UUID, vendor_name: str) -> dict:
        """
        Process a single vendor in a thread-safe way.

        Returns dict with result status and any created suggestion.
        """
        from app.db.session import SessionLocal

        # Create a new session for this thread
        db = SessionLocal()
        try:
            # Check if already has a pending suggestion
            existing = (
                db.query(CategorySuggestion)
                .filter(
                    CategorySuggestion.vendor_id == vendor_id,
                    CategorySuggestion.status == "pending",
                )
                .first()
            )
            if existing:
                return {"status": "skipped", "vendor_id": vendor_id}

            # Get categories for AI prompt
            categories = (
                db.query(Category)
                .order_by(Category.sort_order, Category.name)
                .all()
            )
            categories_list = [{"id": str(c.id), "name": c.name} for c in categories]

            if not categories_list:
                return {"status": "failed", "vendor_id": vendor_id, "error": "No categories"}

            # Get transaction history
            transactions = (
                db.query(TransactionGroup)
                .filter(TransactionGroup.vendor_id == vendor_id)
                .order_by(TransactionGroup.occurred_at.desc())
                .limit(5)
                .all()
            )
            history = [
                {
                    "amount": float(t.amount),
                    "currency": t.currency,
                    "date": t.occurred_at.isoformat() if t.occurred_at else None,
                    "direction": t.direction.value if t.direction else "debit",
                }
                for t in transactions
            ]

            # Call Ollama with a fresh client for this thread
            from app.services.ollama import OllamaService
            ollama = OllamaService()  # Fresh instance with its own HTTP client
            try:
                result = ollama.suggest_category(
                    vendor_name=vendor_name,
                    categories=categories_list,
                    transaction_history=history if history else None,
                )
            finally:
                ollama.close()  # Clean up HTTP client

            # Validate result
            suggested_category_id = result.get("category_id")
            if not suggested_category_id:
                return {"status": "failed", "vendor_id": vendor_id, "error": "No category_id"}

            category = db.query(Category).filter(Category.id == suggested_category_id).first()
            if not category:
                return {"status": "failed", "vendor_id": vendor_id, "error": "Invalid category"}

            # Create suggestion record
            suggestion = CategorySuggestion(
                vendor_id=vendor_id,
                suggested_category_id=category.id,
                model=ollama.model,
                confidence=result.get("confidence", 0.5),
                rationale=result.get("rationale", ""),
                status="pending",
            )

            # Mark existing pending as superseded
            db.query(CategorySuggestion).filter(
                CategorySuggestion.vendor_id == vendor_id,
                CategorySuggestion.status == "pending",
            ).update({"status": "rejected", "updated_at": datetime.utcnow()})

            db.add(suggestion)
            db.commit()

            logger.info(f"Generated suggestion for {vendor_name}: {category.name}")
            return {"status": "success", "vendor_id": vendor_id}

        except OllamaError as e:
            logger.error(f"Ollama error for vendor {vendor_id}: {e}")
            return {"status": "failed", "vendor_id": vendor_id, "error": str(e)}
        except Exception as e:
            logger.exception(f"Error processing vendor {vendor_id}: {e}")
            return {"status": "failed", "vendor_id": vendor_id, "error": str(e)}
        finally:
            db.close()

    def _process_vendor_batch_parallel(
        self,
        vendors: list[Vendor],
        stats: dict[str, int],
        concurrency: int,
    ) -> None:
        """Process a batch of vendors using parallel workers."""
        # Extract vendor info before threading (avoid session issues)
        vendor_tasks = [(v.id, v.canonical_name) for v in vendors]

        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            # Submit all tasks
            futures = {
                executor.submit(self._process_single_vendor, vid, vname): vid
                for vid, vname in vendor_tasks
            }

            # Collect results as they complete
            for future in as_completed(futures):
                stats["processed"] += 1
                try:
                    result = future.result()
                    status = result.get("status", "failed")
                    if status == "success":
                        stats["success"] += 1
                    elif status == "skipped":
                        stats["skipped"] += 1
                    else:
                        stats["failed"] += 1
                except Exception as e:
                    logger.exception(f"Future failed: {e}")
                    stats["failed"] += 1
