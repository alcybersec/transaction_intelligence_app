"""Wallet and instrument management service."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Institution,
    Instrument,
    InstrumentType,
    TransactionDirection,
    TransactionGroup,
    Wallet,
    WalletInstrument,
)


class WalletService:
    """Service for wallet and instrument management."""

    def __init__(self, db: Session):
        self.db = db

    # ============== Institution Operations ==============

    def list_institutions(self, active_only: bool = True) -> list[Institution]:
        """List all institutions."""
        query = self.db.query(Institution)
        if active_only:
            query = query.filter(Institution.is_active == True)
        return query.order_by(Institution.display_name).all()

    def get_institution(self, institution_id: UUID) -> Institution | None:
        """Get an institution by ID."""
        return self.db.query(Institution).filter(Institution.id == institution_id).first()

    # ============== Instrument Operations ==============

    def create_instrument(
        self,
        institution_id: UUID,
        instrument_type: str,
        display_name: str,
        last4: str | None = None,
        account_tail: str | None = None,
    ) -> Instrument:
        """
        Create a new instrument.

        Args:
            institution_id: ID of the institution
            instrument_type: 'card' or 'account'
            display_name: User-friendly name
            last4: Last 4 digits of card (for cards)
            account_tail: Account identifier (for accounts)

        Returns:
            Created instrument
        """
        instrument = Instrument(
            institution_id=institution_id,
            type=InstrumentType(instrument_type),
            display_name=display_name,
            last4=last4,
            account_tail=account_tail,
            is_active=True,
        )
        self.db.add(instrument)
        self.db.commit()
        self.db.refresh(instrument)
        return instrument

    def update_instrument(
        self,
        instrument_id: UUID,
        display_name: str | None = None,
        last4: str | None = None,
        account_tail: str | None = None,
        is_active: bool | None = None,
    ) -> Instrument | None:
        """Update an instrument."""
        instrument = self.db.query(Instrument).filter(Instrument.id == instrument_id).first()
        if not instrument:
            return None

        if display_name is not None:
            instrument.display_name = display_name
        if last4 is not None:
            instrument.last4 = last4
        if account_tail is not None:
            instrument.account_tail = account_tail
        if is_active is not None:
            instrument.is_active = is_active

        instrument.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(instrument)
        return instrument

    def delete_instrument(self, instrument_id: UUID) -> bool:
        """Delete an instrument."""
        instrument = self.db.query(Instrument).filter(Instrument.id == instrument_id).first()
        if not instrument:
            return False

        self.db.delete(instrument)
        self.db.commit()
        return True

    def get_instrument(self, instrument_id: UUID) -> Instrument | None:
        """Get an instrument by ID."""
        return (
            self.db.query(Instrument)
            .options(joinedload(Instrument.institution))
            .filter(Instrument.id == instrument_id)
            .first()
        )

    def list_instruments(
        self,
        institution_id: UUID | None = None,
        active_only: bool = True,
        unassigned_only: bool = False,
    ) -> list[Instrument]:
        """
        List instruments.

        Args:
            institution_id: Filter by institution
            active_only: Only return active instruments
            unassigned_only: Only return instruments not assigned to any wallet
        """
        query = self.db.query(Instrument).options(joinedload(Instrument.institution))

        if institution_id:
            query = query.filter(Instrument.institution_id == institution_id)
        if active_only:
            query = query.filter(Instrument.is_active == True)
        if unassigned_only:
            # Subquery to find instruments already in wallets
            assigned_ids = self.db.query(WalletInstrument.instrument_id)
            query = query.filter(~Instrument.id.in_(assigned_ids))

        return query.order_by(Instrument.display_name).all()

    def get_instrument_wallet_ids(self, instrument_id: UUID) -> list[UUID]:
        """Get all wallet IDs that contain this instrument."""
        wallet_instruments = (
            self.db.query(WalletInstrument)
            .filter(WalletInstrument.instrument_id == instrument_id)
            .all()
        )
        return [wi.wallet_id for wi in wallet_instruments]

    # ============== Wallet Operations ==============

    def create_wallet(
        self,
        name: str,
        currency: str = "AED",
        instrument_ids: list[UUID] | None = None,
    ) -> Wallet:
        """
        Create a new wallet.

        Args:
            name: Wallet name
            currency: ISO currency code
            instrument_ids: Optional list of instruments to attach

        Returns:
            Created wallet
        """
        wallet = Wallet(
            name=name,
            currency=currency,
        )
        self.db.add(wallet)
        self.db.flush()

        # Attach instruments if provided
        if instrument_ids:
            for instrument_id in instrument_ids:
                wallet_instrument = WalletInstrument(
                    wallet_id=wallet.id,
                    instrument_id=instrument_id,
                )
                self.db.add(wallet_instrument)

        self.db.commit()
        self.db.refresh(wallet)
        return wallet

    def update_wallet(
        self,
        wallet_id: UUID,
        name: str | None = None,
        currency: str | None = None,
    ) -> Wallet | None:
        """Update a wallet."""
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if not wallet:
            return None

        if name is not None:
            wallet.name = name
        if currency is not None:
            wallet.currency = currency

        wallet.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(wallet)
        return wallet

    def delete_wallet(self, wallet_id: UUID) -> bool:
        """
        Delete a wallet.

        Note: This will cascade delete wallet_instruments but NOT the instruments themselves.
        """
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if not wallet:
            return False

        self.db.delete(wallet)
        self.db.commit()
        return True

    def get_wallet(self, wallet_id: UUID) -> Wallet | None:
        """Get a wallet by ID with its instruments."""
        return (
            self.db.query(Wallet)
            .options(
                joinedload(Wallet.wallet_instruments).joinedload(WalletInstrument.instrument)
            )
            .filter(Wallet.id == wallet_id)
            .first()
        )

    def list_wallets(self) -> list[Wallet]:
        """List all wallets with their instruments."""
        return (
            self.db.query(Wallet)
            .options(
                joinedload(Wallet.wallet_instruments).joinedload(WalletInstrument.instrument)
            )
            .order_by(Wallet.name)
            .all()
        )

    def get_wallet_transaction_count(self, wallet_id: UUID) -> int:
        """Get the number of transactions in a wallet."""
        return (
            self.db.query(func.count(TransactionGroup.id))
            .filter(TransactionGroup.wallet_id == wallet_id)
            .scalar()
            or 0
        )

    # ============== Instrument-Wallet Link Operations ==============

    def attach_instruments(self, wallet_id: UUID, instrument_ids: list[UUID]) -> list[UUID]:
        """
        Attach instruments to a wallet.

        Args:
            wallet_id: Wallet ID
            instrument_ids: List of instrument IDs to attach

        Returns:
            List of successfully attached instrument IDs
        """
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if not wallet:
            return []

        attached = []
        for instrument_id in instrument_ids:
            # Check if already attached
            existing = (
                self.db.query(WalletInstrument)
                .filter(
                    WalletInstrument.wallet_id == wallet_id,
                    WalletInstrument.instrument_id == instrument_id,
                )
                .first()
            )
            if existing:
                continue

            # Verify instrument exists
            instrument = self.db.query(Instrument).filter(Instrument.id == instrument_id).first()
            if not instrument:
                continue

            wallet_instrument = WalletInstrument(
                wallet_id=wallet_id,
                instrument_id=instrument_id,
            )
            self.db.add(wallet_instrument)
            attached.append(instrument_id)

        self.db.commit()
        return attached

    def detach_instruments(self, wallet_id: UUID, instrument_ids: list[UUID]) -> list[UUID]:
        """
        Detach instruments from a wallet.

        Args:
            wallet_id: Wallet ID
            instrument_ids: List of instrument IDs to detach

        Returns:
            List of successfully detached instrument IDs
        """
        detached = []
        for instrument_id in instrument_ids:
            wallet_instrument = (
                self.db.query(WalletInstrument)
                .filter(
                    WalletInstrument.wallet_id == wallet_id,
                    WalletInstrument.instrument_id == instrument_id,
                )
                .first()
            )
            if wallet_instrument:
                self.db.delete(wallet_instrument)
                detached.append(instrument_id)

        self.db.commit()
        return detached

    # ============== Balance Operations ==============

    def update_wallet_balance(
        self,
        wallet_id: UUID,
        new_balance: Decimal,
    ) -> tuple[Decimal | None, Decimal]:
        """
        Update a wallet's combined balance.

        Args:
            wallet_id: Wallet ID
            new_balance: New balance value

        Returns:
            Tuple of (previous_balance, new_balance)
        """
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if not wallet:
            raise ValueError(f"Wallet {wallet_id} not found")

        previous_balance = wallet.combined_balance_last
        wallet.combined_balance_last = new_balance
        wallet.updated_at = datetime.utcnow()

        self.db.commit()
        return previous_balance, new_balance

    def recalculate_wallet_balance(self, wallet_id: UUID) -> Decimal | None:
        """
        Recalculate wallet balance from the most recent transaction with balance info.

        Args:
            wallet_id: Wallet ID

        Returns:
            The calculated balance or None if no transactions with balance
        """
        # Get the most recent transaction with balance info
        latest_txn = (
            self.db.query(TransactionGroup)
            .filter(
                TransactionGroup.wallet_id == wallet_id,
                TransactionGroup.combined_balance_after.isnot(None),
            )
            .order_by(TransactionGroup.observed_at_max.desc())
            .first()
        )

        if not latest_txn:
            return None

        balance = latest_txn.combined_balance_after

        # Update wallet
        wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
        if wallet:
            wallet.combined_balance_last = balance
            wallet.updated_at = datetime.utcnow()
            self.db.commit()

        return balance

    # ============== Dashboard/Summary Operations ==============

    def get_wallet_summary(self, wallet_id: UUID, days: int = 30) -> dict:
        """
        Get wallet summary for dashboard.

        Args:
            wallet_id: Wallet ID
            days: Number of days for recent stats

        Returns:
            Summary dict with balance, transaction counts, spending totals
        """
        wallet = self.get_wallet(wallet_id)
        if not wallet:
            return {}

        cutoff_date = datetime.utcnow() - datetime.timedelta(days=days) if hasattr(datetime, 'timedelta') else None
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get current month boundaries
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Count recent transactions
        recent_count = (
            self.db.query(func.count(TransactionGroup.id))
            .filter(
                TransactionGroup.wallet_id == wallet_id,
                TransactionGroup.occurred_at >= cutoff_date,
            )
            .scalar()
            or 0
        )

        # Sum this month's debits (spending)
        spent_this_month = (
            self.db.query(func.sum(TransactionGroup.amount))
            .filter(
                TransactionGroup.wallet_id == wallet_id,
                TransactionGroup.direction == TransactionDirection.DEBIT,
                TransactionGroup.occurred_at >= month_start,
            )
            .scalar()
            or Decimal("0")
        )

        # Sum this month's credits (income)
        income_this_month = (
            self.db.query(func.sum(TransactionGroup.amount))
            .filter(
                TransactionGroup.wallet_id == wallet_id,
                TransactionGroup.direction == TransactionDirection.CREDIT,
                TransactionGroup.occurred_at >= month_start,
            )
            .scalar()
            or Decimal("0")
        )

        return {
            "id": wallet.id,
            "name": wallet.name,
            "combined_balance_last": wallet.combined_balance_last,
            "currency": wallet.currency,
            "instrument_count": len(wallet.wallet_instruments),
            "recent_transaction_count": recent_count,
            "total_spent_this_month": spent_this_month,
            "total_income_this_month": income_this_month,
        }

    def get_dashboard_summary(self) -> dict:
        """
        Get overall dashboard summary across all wallets.

        Returns:
            Summary with wallet list and totals
        """
        wallets = self.list_wallets()

        wallet_summaries = []
        total_balance = Decimal("0")
        primary_currency = "AED"

        for wallet in wallets:
            summary = self.get_wallet_summary(wallet.id)
            wallet_summaries.append(summary)

            if wallet.combined_balance_last is not None:
                if wallet.currency == primary_currency:
                    total_balance += wallet.combined_balance_last

        return {
            "wallets": wallet_summaries,
            "total_balance": total_balance if wallet_summaries else None,
            "currency": primary_currency,
        }
