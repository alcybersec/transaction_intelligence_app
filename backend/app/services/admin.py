"""Admin service for data repair and maintenance operations."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, update
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_body
from app.core.logging import get_logger
from app.core.metrics import admin_remerge_total, admin_reparse_total
from app.db.models import (
    EvidenceRole,
    Message,
    ParseMode,
    ParseStatus,
    TransactionEvidence,
    TransactionGroup,
    Vendor,
    VendorAlias,
    VendorCategoryRule,
)
from app.services.merge import MergeEngine
from app.services.parsing import ParsingService
from app.services.vendor import VendorService

logger = get_logger(__name__)


class AdminService:
    """Service for administrative data repair operations."""

    def __init__(self, db: Session):
        self.db = db
        self._parsing_service = None
        self._merge_engine = None
        self._vendor_service = None

    @property
    def parsing_service(self) -> ParsingService:
        if self._parsing_service is None:
            self._parsing_service = ParsingService(self.db)
        return self._parsing_service

    @property
    def vendor_service(self) -> VendorService:
        if self._vendor_service is None:
            self._vendor_service = VendorService(self.db)
        return self._vendor_service

    @property
    def merge_engine(self) -> MergeEngine:
        if self._merge_engine is None:
            self._merge_engine = MergeEngine(self.db, self.vendor_service)
        return self._merge_engine

    def reparse_messages_since(
        self,
        since: datetime,
        institution_name: Optional[str] = None,
        parse_mode: Optional[ParseMode] = None,
        include_successful: bool = False,
        dry_run: bool = False,
    ) -> dict:
        """
        Re-parse messages from a specific date.

        Args:
            since: Reparse messages observed_at >= this datetime
            institution_name: Optional filter by institution
            parse_mode: Override parse mode (regex/ollama/hybrid)
            include_successful: Also reparse already successful messages
            dry_run: If True, don't actually modify data, just count

        Returns:
            Statistics dict with counts
        """
        # Build query
        query = self.db.query(Message).filter(Message.observed_at >= since)

        if not include_successful:
            query = query.filter(
                or_(
                    Message.parse_status == ParseStatus.PENDING,
                    Message.parse_status == ParseStatus.FAILED,
                    Message.parse_status == ParseStatus.NEEDS_REVIEW,
                )
            )

        messages = query.order_by(Message.observed_at).all()

        stats = {
            "total_found": len(messages),
            "reparsed": 0,
            "success": 0,
            "failed": 0,
            "needs_review": 0,
            "skipped": 0,
            "dry_run": dry_run,
        }

        if dry_run:
            return stats

        for message in messages:
            try:
                # Decrypt body
                body = decrypt_body(message.raw_body_encrypted)

                # Detect institution
                institution = self.parsing_service.detect_institution(
                    message.sender, body, message.source
                )

                # Filter by institution if specified
                if institution_name:
                    if not institution or institution.name != institution_name:
                        stats["skipped"] += 1
                        continue

                # Determine parse mode
                mode = parse_mode
                if mode is None:
                    mode = (
                        ParseMode(institution.parse_mode)
                        if institution and institution.parse_mode
                        else ParseMode.REGEX
                    )

                # Clear existing transaction evidence if re-parsing successful message
                if message.parse_status == ParseStatus.SUCCESS:
                    self._clear_message_transactions(message.id)

                # Parse
                parsed, error = self.parsing_service.parse_message(
                    message,
                    body,
                    mode,
                    institution.name if institution else None,
                )

                stats["reparsed"] += 1

                if parsed:
                    try:
                        self.merge_engine.process_parsed_transaction(message, parsed)
                        message.parse_status = ParseStatus.SUCCESS
                        message.parse_mode = mode
                        message.parse_error = None
                        stats["success"] += 1
                        admin_reparse_total.labels(status="success").inc()
                    except Exception as e:
                        message.parse_status = ParseStatus.NEEDS_REVIEW
                        message.parse_mode = mode
                        message.parse_error = f"Merge error: {str(e)}"
                        stats["needs_review"] += 1
                        admin_reparse_total.labels(status="needs_review").inc()
                else:
                    message.parse_status = ParseStatus.FAILED
                    message.parse_mode = mode
                    message.parse_error = error
                    stats["failed"] += 1
                    admin_reparse_total.labels(status="failed").inc()

                self.db.commit()

            except Exception as e:
                logger.exception(f"Error reparsing message {message.id}: {e}")
                message.parse_status = ParseStatus.FAILED
                message.parse_error = f"Reparse error: {str(e)}"
                stats["failed"] += 1
                self.db.commit()

        return stats

    def remerge_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        wallet_id: Optional[UUID] = None,
        dry_run: bool = False,
    ) -> dict:
        """
        Re-run merge logic for transactions in a date range.

        This clears existing transaction groups and re-processes all
        successfully parsed messages in the date range.

        Args:
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)
            wallet_id: Optional filter by wallet
            dry_run: If True, don't modify data

        Returns:
            Statistics dict
        """
        # Find messages in range that were successfully parsed
        query = self.db.query(Message).filter(
            and_(
                Message.observed_at >= start_date,
                Message.observed_at <= end_date,
                Message.parse_status == ParseStatus.SUCCESS,
            )
        )

        messages = query.order_by(Message.observed_at).all()

        # Get message IDs
        message_ids = [m.id for m in messages]

        # Find affected transaction groups
        affected_groups = (
            self.db.query(TransactionGroup)
            .join(TransactionEvidence)
            .filter(TransactionEvidence.message_id.in_(message_ids))
        )

        if wallet_id:
            affected_groups = affected_groups.filter(
                TransactionGroup.wallet_id == wallet_id
            )

        affected_group_ids = [g.id for g in affected_groups.all()]

        stats = {
            "messages_found": len(messages),
            "groups_affected": len(affected_group_ids),
            "groups_deleted": 0,
            "evidence_deleted": 0,
            "new_groups_created": 0,
            "messages_merged": 0,
            "errors": 0,
            "dry_run": dry_run,
        }

        if dry_run:
            return stats

        # Delete existing evidence and groups for these messages
        if affected_group_ids:
            # Delete evidence first
            evidence_deleted = (
                self.db.query(TransactionEvidence)
                .filter(TransactionEvidence.transaction_group_id.in_(affected_group_ids))
                .delete(synchronize_session=False)
            )
            stats["evidence_deleted"] = evidence_deleted

            # Delete groups
            groups_deleted = (
                self.db.query(TransactionGroup)
                .filter(TransactionGroup.id.in_(affected_group_ids))
                .delete(synchronize_session=False)
            )
            stats["groups_deleted"] = groups_deleted

            self.db.commit()

        # Re-process each message
        created_groups = set()

        for message in messages:
            try:
                body = decrypt_body(message.raw_body_encrypted)

                institution = self.parsing_service.detect_institution(
                    message.sender, body, message.source
                )

                mode = (
                    ParseMode(institution.parse_mode)
                    if institution and institution.parse_mode
                    else ParseMode.REGEX
                )

                parsed, error = self.parsing_service.parse_message(
                    message,
                    body,
                    mode,
                    institution.name if institution else None,
                )

                if parsed:
                    group = self.merge_engine.process_parsed_transaction(message, parsed)

                    if group.id not in created_groups:
                        stats["new_groups_created"] += 1
                        created_groups.add(group.id)
                    else:
                        stats["messages_merged"] += 1

                    admin_remerge_total.labels(status="success").inc()
                else:
                    # Mark as needs review since it was previously successful
                    message.parse_status = ParseStatus.NEEDS_REVIEW
                    message.parse_error = f"Remerge parse failed: {error}"
                    stats["errors"] += 1
                    admin_remerge_total.labels(status="failed").inc()

                self.db.commit()

            except Exception as e:
                logger.exception(f"Error remerging message {message.id}: {e}")
                message.parse_status = ParseStatus.NEEDS_REVIEW
                message.parse_error = f"Remerge error: {str(e)}"
                stats["errors"] += 1
                self.db.commit()

        return stats

    def merge_vendors(
        self,
        source_vendor_id: UUID,
        target_vendor_id: UUID,
        dry_run: bool = False,
    ) -> dict:
        """
        Merge one vendor into another.

        All transactions, aliases, and category rules from the source
        vendor will be transferred to the target vendor.

        Args:
            source_vendor_id: Vendor to merge from (will be deleted)
            target_vendor_id: Vendor to merge into (will be kept)
            dry_run: If True, don't modify data

        Returns:
            Statistics dict
        """
        source = self.db.query(Vendor).filter(Vendor.id == source_vendor_id).first()
        target = self.db.query(Vendor).filter(Vendor.id == target_vendor_id).first()

        if not source:
            raise ValueError(f"Source vendor not found: {source_vendor_id}")
        if not target:
            raise ValueError(f"Target vendor not found: {target_vendor_id}")
        if source.id == target.id:
            raise ValueError("Source and target vendors must be different")

        # Count affected records
        transaction_count = (
            self.db.query(TransactionGroup)
            .filter(TransactionGroup.vendor_id == source.id)
            .count()
        )

        alias_count = (
            self.db.query(VendorAlias)
            .filter(VendorAlias.vendor_id == source.id)
            .count()
        )

        rule_count = (
            self.db.query(VendorCategoryRule)
            .filter(VendorCategoryRule.vendor_id == source.id)
            .count()
        )

        stats = {
            "source_vendor": source.canonical_name,
            "target_vendor": target.canonical_name,
            "transactions_updated": transaction_count,
            "aliases_moved": alias_count,
            "rules_merged": 0,
            "rules_deleted": rule_count,  # Rules from source are typically deleted
            "source_deleted": True,
            "dry_run": dry_run,
        }

        if dry_run:
            return stats

        # Update all transactions
        self.db.execute(
            update(TransactionGroup)
            .where(TransactionGroup.vendor_id == source.id)
            .values(vendor_id=target.id)
        )

        # Move aliases to target vendor
        self.db.execute(
            update(VendorAlias)
            .where(VendorAlias.vendor_id == source.id)
            .values(vendor_id=target.id)
        )

        # Add source's canonical name as an alias of target
        existing_alias = (
            self.db.query(VendorAlias)
            .filter(
                VendorAlias.vendor_id == target.id,
                VendorAlias.alias_normalized == source.canonical_name.upper(),
            )
            .first()
        )
        if not existing_alias:
            new_alias = VendorAlias(
                vendor_id=target.id,
                alias_raw=source.canonical_name,
                alias_normalized=source.canonical_name.upper(),
            )
            self.db.add(new_alias)
            stats["aliases_moved"] += 1

        # Delete source vendor's category rules (target keeps its rules)
        self.db.execute(
            delete(VendorCategoryRule).where(VendorCategoryRule.vendor_id == source.id)
        )

        # Delete source vendor
        self.db.delete(source)

        self.db.commit()

        return stats

    def get_vendor_merge_preview(
        self, source_vendor_id: UUID, target_vendor_id: UUID
    ) -> dict:
        """
        Preview what would happen if two vendors were merged.

        Args:
            source_vendor_id: Vendor to merge from
            target_vendor_id: Vendor to merge into

        Returns:
            Preview information
        """
        source = self.db.query(Vendor).filter(Vendor.id == source_vendor_id).first()
        target = self.db.query(Vendor).filter(Vendor.id == target_vendor_id).first()

        if not source or not target:
            raise ValueError("One or both vendors not found")

        # Get source vendor details
        source_txn_count = (
            self.db.query(TransactionGroup)
            .filter(TransactionGroup.vendor_id == source.id)
            .count()
        )

        source_total = (
            self.db.query(func.sum(TransactionGroup.amount))
            .filter(TransactionGroup.vendor_id == source.id)
            .scalar()
            or 0
        )

        source_aliases = (
            self.db.query(VendorAlias)
            .filter(VendorAlias.vendor_id == source.id)
            .all()
        )

        # Get target vendor details
        target_txn_count = (
            self.db.query(TransactionGroup)
            .filter(TransactionGroup.vendor_id == target.id)
            .count()
        )

        target_total = (
            self.db.query(func.sum(TransactionGroup.amount))
            .filter(TransactionGroup.vendor_id == target.id)
            .scalar()
            or 0
        )

        target_aliases = (
            self.db.query(VendorAlias)
            .filter(VendorAlias.vendor_id == target.id)
            .all()
        )

        return {
            "source": {
                "id": str(source.id),
                "name": source.canonical_name,
                "transaction_count": source_txn_count,
                "total_amount": float(source_total),
                "aliases": [a.alias_raw for a in source_aliases],
            },
            "target": {
                "id": str(target.id),
                "name": target.canonical_name,
                "transaction_count": target_txn_count,
                "total_amount": float(target_total),
                "aliases": [a.alias_raw for a in target_aliases],
            },
            "after_merge": {
                "name": target.canonical_name,
                "transaction_count": source_txn_count + target_txn_count,
                "total_amount": float(source_total) + float(target_total),
                "aliases": [a.alias_raw for a in source_aliases]
                + [a.alias_raw for a in target_aliases]
                + [source.canonical_name],
            },
        }

    def _clear_message_transactions(self, message_id: UUID) -> None:
        """
        Clear transaction evidence for a message before re-parsing.

        If the message is the only evidence for a transaction group,
        the group is also deleted.
        """
        # Find evidence records for this message
        evidence_records = (
            self.db.query(TransactionEvidence)
            .filter(TransactionEvidence.message_id == message_id)
            .all()
        )

        for evidence in evidence_records:
            group_id = evidence.transaction_group_id

            # Count other evidence for this group
            other_evidence_count = (
                self.db.query(TransactionEvidence)
                .filter(
                    TransactionEvidence.transaction_group_id == group_id,
                    TransactionEvidence.message_id != message_id,
                )
                .count()
            )

            # Delete this evidence record
            self.db.delete(evidence)

            # If no other evidence, delete the group too
            if other_evidence_count == 0:
                group = (
                    self.db.query(TransactionGroup)
                    .filter(TransactionGroup.id == group_id)
                    .first()
                )
                if group:
                    self.db.delete(group)

        self.db.flush()

    def get_data_health_report(self) -> dict:
        """
        Generate a report on data health and integrity.

        Returns:
            Health report with counts and potential issues
        """
        # Message counts by status
        message_stats = (
            self.db.query(Message.parse_status, func.count(Message.id))
            .group_by(Message.parse_status)
            .all()
        )

        # Orphaned evidence (evidence without valid message)
        orphaned_evidence = (
            self.db.query(TransactionEvidence)
            .outerjoin(Message, TransactionEvidence.message_id == Message.id)
            .filter(Message.id.is_(None))
            .count()
        )

        # Transaction groups without evidence
        groups_without_evidence = (
            self.db.query(TransactionGroup)
            .outerjoin(
                TransactionEvidence,
                TransactionGroup.id == TransactionEvidence.transaction_group_id,
            )
            .filter(TransactionEvidence.id.is_(None))
            .count()
        )

        # Vendors without transactions
        vendors_without_txns = (
            self.db.query(Vendor)
            .outerjoin(TransactionGroup, Vendor.id == TransactionGroup.vendor_id)
            .filter(TransactionGroup.id.is_(None))
            .count()
        )

        # Total vendors
        total_vendors = self.db.query(Vendor).count()

        return {
            "messages": {
                status.value: count for status, count in message_stats
            },
            "total_messages": sum(count for _, count in message_stats),
            "transaction_groups": self.db.query(TransactionGroup).count(),
            "vendors": {
                "total": total_vendors,
                "without_transactions": vendors_without_txns,
            },
            "integrity_issues": {
                "orphaned_evidence": orphaned_evidence,
                "groups_without_evidence": groups_without_evidence,
            },
        }
