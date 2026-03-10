"""Merge engine for combining multiple message sources into transaction groups."""

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.db.models import (
    EvidenceRole,
    Instrument,
    Message,
    TransactionDirection,
    TransactionEvidence,
    TransactionGroup,
    TransactionStatus,
    Wallet,
    WalletInstrument,
)
from app.schemas.transaction import ParsedTransaction
from app.services.vendor import VendorService


class MergeEngine:
    """
    Engine for merging message evidence into canonical transaction groups.

    Merge rules:
    - Same amount + currency
    - Same normalized vendor
    - Same wallet/instrument context + direction
    - observed_at within ±10 minutes
    - reference_id (if present) is a strong key
    """

    # Time window for considering messages as same transaction
    MERGE_WINDOW_MINUTES = 10

    def __init__(self, db: Session, vendor_service: VendorService):
        self.db = db
        self.vendor_service = vendor_service

    def process_parsed_transaction(
        self, message: Message, parsed: ParsedTransaction
    ) -> TransactionGroup:
        """
        Process a parsed transaction and merge or create a transaction group.

        Args:
            message: The source message
            parsed: Parsed transaction data

        Returns:
            The created or merged TransactionGroup

        Raises:
            ValueError: If multiple candidate groups match (needs review)
        """
        # Resolve vendor
        vendor = None
        if parsed.vendor_raw:
            vendor, _ = self.vendor_service.get_or_create_vendor(parsed.vendor_raw)

        # Resolve instrument and wallet
        instrument = self._resolve_instrument(parsed)
        wallet = self._resolve_wallet(instrument) if instrument else None

        # Resolve category from vendor rules
        category = None
        if vendor:
            category = self.vendor_service.get_vendor_category(vendor.id)

        # Determine direction
        direction = TransactionDirection(parsed.direction)

        # Find matching transaction groups
        candidates = self._find_merge_candidates(
            amount=parsed.amount,
            currency=parsed.currency,
            direction=direction,
            vendor_id=vendor.id if vendor else None,
            observed_at=message.observed_at,
            reference_id=parsed.reference_id,
            wallet_id=wallet.id if wallet else None,
        )

        if len(candidates) > 1:
            # Ambiguous match - needs manual review
            raise ValueError(
                f"Multiple candidate transaction groups found ({len(candidates)}). Manual review required."
            )

        if len(candidates) == 1:
            # Merge into existing group
            txn_group = candidates[0]
            return self._merge_into_group(txn_group, message, parsed)

        # Create new transaction group
        return self._create_transaction_group(
            message=message,
            parsed=parsed,
            vendor=vendor,
            instrument=instrument,
            wallet=wallet,
            category=category,
            direction=direction,
        )

    def _resolve_instrument(self, parsed: ParsedTransaction) -> Instrument | None:
        """Find the instrument matching the parsed data."""
        if parsed.card_last4:
            instrument = (
                self.db.query(Instrument)
                .filter(
                    Instrument.last4 == parsed.card_last4,
                    Instrument.is_active.is_(True),
                )
                .first()
            )
            if instrument:
                return instrument

        if parsed.account_tail:
            instrument = (
                self.db.query(Instrument)
                .filter(
                    Instrument.account_tail == parsed.account_tail,
                    Instrument.is_active.is_(True),
                )
                .first()
            )
            if instrument:
                return instrument

        return None

    def _resolve_wallet(self, instrument: Instrument) -> Wallet | None:
        """Find the wallet containing this instrument."""
        wallet_instrument = (
            self.db.query(WalletInstrument)
            .filter(WalletInstrument.instrument_id == instrument.id)
            .first()
        )

        if wallet_instrument:
            return wallet_instrument.wallet

        return None

    def _find_merge_candidates(
        self,
        amount: Decimal,
        currency: str,
        direction: TransactionDirection,
        vendor_id,
        observed_at: datetime,
        reference_id: str | None,
        wallet_id,
    ) -> list[TransactionGroup]:
        """
        Find transaction groups that could be merged with this transaction.

        Merge criteria:
        - Same amount + currency
        - Same direction
        - Same vendor (if known)
        - observed_at within ±10 minutes
        - OR matching reference_id (strong match)
        """
        # Reference ID is a strong match
        if reference_id:
            strong_match = (
                self.db.query(TransactionGroup)
                .filter(TransactionGroup.reference_id == reference_id)
                .first()
            )
            if strong_match:
                return [strong_match]

        # Build time window
        time_min = observed_at - timedelta(minutes=self.MERGE_WINDOW_MINUTES)
        time_max = observed_at + timedelta(minutes=self.MERGE_WINDOW_MINUTES)

        # Build query for fuzzy match
        query = self.db.query(TransactionGroup).filter(
            TransactionGroup.amount == amount,
            TransactionGroup.currency == currency,
            TransactionGroup.direction == direction,
            # Check if observed_at window overlaps
            or_(
                and_(
                    TransactionGroup.observed_at_min <= time_max,
                    TransactionGroup.observed_at_max >= time_min,
                ),
                and_(
                    TransactionGroup.observed_at_min >= time_min,
                    TransactionGroup.observed_at_min <= time_max,
                ),
            ),
        )

        # Add vendor filter if available
        if vendor_id:
            query = query.filter(TransactionGroup.vendor_id == vendor_id)

        # Add wallet filter if available
        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        return query.all()

    def _merge_into_group(
        self, group: TransactionGroup, message: Message, parsed: ParsedTransaction
    ) -> TransactionGroup:
        """
        Merge a new message into an existing transaction group.

        Updates the time window and adds evidence link.
        """
        # Update observed_at window
        if message.observed_at < group.observed_at_min:
            group.observed_at_min = message.observed_at
        if message.observed_at > group.observed_at_max:
            group.observed_at_max = message.observed_at

        # Update balance if newer
        if parsed.available_balance is not None:
            if group.combined_balance_after is None or message.observed_at > group.observed_at_max:
                group.combined_balance_after = parsed.available_balance

        # Update reference_id if we now have one
        if parsed.reference_id and not group.reference_id:
            group.reference_id = parsed.reference_id

        group.updated_at = datetime.utcnow()

        # Add evidence link
        evidence = TransactionEvidence(
            transaction_group_id=group.id,
            message_id=message.id,
            role=EvidenceRole.SECONDARY,
        )
        self.db.add(evidence)

        # Update wallet balance if available
        if parsed.available_balance is not None and group.wallet_id:
            self._update_wallet_balance(group.wallet_id, parsed.available_balance)

        self.db.commit()
        return group

    def _create_transaction_group(
        self,
        message: Message,
        parsed: ParsedTransaction,
        vendor,
        instrument,
        wallet,
        category,
        direction: TransactionDirection,
    ) -> TransactionGroup:
        """Create a new transaction group."""
        occurred_at = parsed.occurred_at or message.observed_at

        group = TransactionGroup(
            wallet_id=wallet.id if wallet else None,
            instrument_id=instrument.id if instrument else None,
            direction=direction,
            amount=parsed.amount,
            currency=parsed.currency,
            occurred_at=occurred_at,
            observed_at_min=message.observed_at,
            observed_at_max=message.observed_at,
            vendor_id=vendor.id if vendor else None,
            vendor_raw=parsed.vendor_raw,
            category_id=category.id if category else None,
            reference_id=parsed.reference_id,
            combined_balance_after=parsed.available_balance,
            status=TransactionStatus.POSTED,
        )
        self.db.add(group)
        self.db.flush()

        # Add evidence link
        evidence = TransactionEvidence(
            transaction_group_id=group.id,
            message_id=message.id,
            role=EvidenceRole.PRIMARY,
        )
        self.db.add(evidence)

        # Update wallet balance if available
        if parsed.available_balance is not None and wallet:
            self._update_wallet_balance(wallet.id, parsed.available_balance)

        self.db.commit()
        return group

    def _update_wallet_balance(self, wallet_id, balance: Decimal) -> None:
        """Update the wallet's combined balance."""
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if wallet:
            wallet.combined_balance_last = balance
            wallet.updated_at = datetime.utcnow()

    def link_reversal(
        self, reversal_group: TransactionGroup, original_group: TransactionGroup
    ) -> None:
        """
        Link a reversal/refund transaction to its original.

        Args:
            reversal_group: The reversal transaction group
            original_group: The original transaction group
        """
        reversal_group.linked_transaction_id = original_group.id
        reversal_group.status = TransactionStatus.REFUNDED

        # Mark original as reversed/refunded
        original_group.status = TransactionStatus.REVERSED

        self.db.commit()

    def find_reversal_candidate(
        self, group: TransactionGroup, keywords: list[str] | None = None
    ) -> TransactionGroup | None:
        """
        Find a potential original transaction for a reversal.

        Args:
            group: The potential reversal transaction
            keywords: Optional keywords to look for in evidence

        Returns:
            Original transaction group if found
        """
        # Match by reference_id first
        if group.reference_id:
            original = (
                self.db.query(TransactionGroup)
                .filter(
                    TransactionGroup.reference_id == group.reference_id,
                    TransactionGroup.id != group.id,
                    TransactionGroup.status == TransactionStatus.POSTED,
                )
                .first()
            )
            if original:
                return original

        # Heuristic: same amount, opposite direction, same vendor, within 30 days
        time_window = timedelta(days=30)
        opposite_direction = (
            TransactionDirection.CREDIT
            if group.direction == TransactionDirection.DEBIT
            else TransactionDirection.DEBIT
        )

        candidates = (
            self.db.query(TransactionGroup)
            .filter(
                TransactionGroup.amount == group.amount,
                TransactionGroup.currency == group.currency,
                TransactionGroup.direction == opposite_direction,
                TransactionGroup.vendor_id == group.vendor_id,
                TransactionGroup.occurred_at >= group.occurred_at - time_window,
                TransactionGroup.occurred_at <= group.occurred_at,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            .order_by(TransactionGroup.occurred_at.desc())
            .first()
        )

        return candidates
