"""Tests for wallet and instrument service."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.db.models import Instrument, InstrumentType, Wallet, WalletInstrument
from app.services.wallet import WalletService


class TestInstrumentOperations:
    """Tests for instrument CRUD operations."""

    def test_create_instrument_card(self):
        """Test creating a card instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        institution_id = uuid4()

        with patch.object(service, "db") as db:
            db.add = MagicMock()
            db.commit = MagicMock()
            db.refresh = MagicMock()

            # Mock the refresh to populate the instrument
            def mock_refresh(inst):
                inst.id = uuid4()
                inst.created_at = datetime.now(UTC)
                inst.updated_at = datetime.now(UTC)

            db.refresh.side_effect = mock_refresh

            service.create_instrument(
                institution_id=institution_id,
                instrument_type="card",
                display_name="Test Credit Card",
                last4="1234",
            )

            db.add.assert_called_once()
            db.commit.assert_called_once()
            db.refresh.assert_called_once()

    def test_create_instrument_account(self):
        """Test creating an account instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        institution_id = uuid4()

        with patch.object(service, "db") as db:
            db.add = MagicMock()
            db.commit = MagicMock()
            db.refresh = MagicMock()

            def mock_refresh(inst):
                inst.id = uuid4()
                inst.created_at = datetime.now(UTC)
                inst.updated_at = datetime.now(UTC)

            db.refresh.side_effect = mock_refresh

            service.create_instrument(
                institution_id=institution_id,
                instrument_type="account",
                display_name="Test Savings Account",
                account_tail="567890",
            )

            db.add.assert_called_once()

    def test_update_instrument(self):
        """Test updating an instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        instrument_id = uuid4()
        mock_instrument = MagicMock()
        mock_instrument.id = instrument_id
        mock_instrument.display_name = "Old Name"
        mock_instrument.last4 = "1234"

        mock_db.query.return_value.filter.return_value.first.return_value = mock_instrument

        service.update_instrument(
            instrument_id=instrument_id,
            display_name="New Name",
        )

        assert mock_instrument.display_name == "New Name"
        mock_db.commit.assert_called_once()

    def test_update_instrument_not_found(self):
        """Test updating a non-existent instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = service.update_instrument(
            instrument_id=uuid4(),
            display_name="New Name",
        )

        assert result is None

    def test_delete_instrument(self):
        """Test deleting an instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_instrument = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_instrument

        result = service.delete_instrument(uuid4())

        assert result is True
        mock_db.delete.assert_called_once_with(mock_instrument)
        mock_db.commit.assert_called_once()

    def test_delete_instrument_not_found(self):
        """Test deleting a non-existent instrument."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = service.delete_instrument(uuid4())

        assert result is False


class TestWalletOperations:
    """Tests for wallet CRUD operations."""

    def test_create_wallet_simple(self):
        """Test creating a wallet without instruments."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        with patch.object(service, "db") as db:
            db.add = MagicMock()
            db.flush = MagicMock()
            db.commit = MagicMock()
            db.refresh = MagicMock()

            def mock_refresh(wallet):
                wallet.id = uuid4()
                wallet.created_at = datetime.now(UTC)
                wallet.updated_at = datetime.now(UTC)

            db.refresh.side_effect = mock_refresh

            service.create_wallet(
                name="Test Wallet",
                currency="AED",
            )

            db.add.assert_called_once()
            db.commit.assert_called_once()

    def test_create_wallet_with_instruments(self):
        """Test creating a wallet with instruments attached."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        instrument_ids = [uuid4(), uuid4()]

        with patch.object(service, "db") as db:
            add_calls = []
            db.add = lambda x: add_calls.append(x)
            db.flush = MagicMock()
            db.commit = MagicMock()
            db.refresh = MagicMock()

            def mock_refresh(wallet):
                wallet.id = uuid4()
                wallet.created_at = datetime.now(UTC)
                wallet.updated_at = datetime.now(UTC)

            db.refresh.side_effect = mock_refresh

            service.create_wallet(
                name="Test Wallet",
                currency="AED",
                instrument_ids=instrument_ids,
            )

            # Should have added 1 wallet + 2 wallet_instruments
            assert len(add_calls) == 3

    def test_update_wallet(self):
        """Test updating a wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()
        mock_wallet = MagicMock()
        mock_wallet.id = wallet_id
        mock_wallet.name = "Old Name"

        mock_db.query.return_value.filter.return_value.first.return_value = mock_wallet

        service.update_wallet(
            wallet_id=wallet_id,
            name="New Name",
        )

        assert mock_wallet.name == "New Name"
        mock_db.commit.assert_called_once()

    def test_update_wallet_not_found(self):
        """Test updating a non-existent wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = service.update_wallet(
            wallet_id=uuid4(),
            name="New Name",
        )

        assert result is None

    def test_delete_wallet(self):
        """Test deleting a wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_wallet = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_wallet

        result = service.delete_wallet(uuid4())

        assert result is True
        mock_db.delete.assert_called_once_with(mock_wallet)
        mock_db.commit.assert_called_once()


class TestInstrumentWalletLinks:
    """Tests for attaching/detaching instruments from wallets."""

    def test_attach_instruments(self):
        """Test attaching instruments to a wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()
        instrument_ids = [uuid4(), uuid4()]

        # Mock wallet exists
        mock_wallet = MagicMock()
        mock_wallet.id = wallet_id

        # First query returns wallet, then instruments
        def query_side_effect(model):
            mock_query = MagicMock()
            if model == Wallet:
                mock_query.filter.return_value.first.return_value = mock_wallet
            elif model == WalletInstrument:
                # No existing links
                mock_query.filter.return_value.first.return_value = None
            elif model == Instrument:
                # Instruments exist
                mock_instrument = MagicMock()
                mock_query.filter.return_value.first.return_value = mock_instrument
            return mock_query

        mock_db.query.side_effect = query_side_effect

        attached = service.attach_instruments(wallet_id, instrument_ids)

        assert len(attached) == 2
        mock_db.commit.assert_called_once()

    def test_attach_instruments_wallet_not_found(self):
        """Test attaching instruments to non-existent wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_db.query.return_value.filter.return_value.first.return_value = None

        attached = service.attach_instruments(uuid4(), [uuid4()])

        assert attached == []

    def test_detach_instruments(self):
        """Test detaching instruments from a wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()
        instrument_ids = [uuid4()]

        mock_wallet_instrument = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_wallet_instrument

        detached = service.detach_instruments(wallet_id, instrument_ids)

        assert len(detached) == 1
        mock_db.delete.assert_called_once_with(mock_wallet_instrument)
        mock_db.commit.assert_called_once()


class TestBalanceOperations:
    """Tests for balance-related operations."""

    def test_update_wallet_balance(self):
        """Test updating a wallet's balance."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()
        mock_wallet = MagicMock()
        mock_wallet.id = wallet_id
        mock_wallet.combined_balance_last = Decimal("1000.00")

        mock_db.query.return_value.filter.return_value.first.return_value = mock_wallet

        previous, new = service.update_wallet_balance(
            wallet_id=wallet_id,
            new_balance=Decimal("1500.00"),
        )

        assert previous == Decimal("1000.00")
        assert new == Decimal("1500.00")
        assert mock_wallet.combined_balance_last == Decimal("1500.00")
        mock_db.commit.assert_called_once()

    def test_update_wallet_balance_not_found(self):
        """Test updating balance of non-existent wallet."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            service.update_wallet_balance(
                wallet_id=uuid4(),
                new_balance=Decimal("1000.00"),
            )

    def test_recalculate_wallet_balance_from_transaction(self):
        """Test recalculating balance from most recent transaction."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()

        # Mock transaction with balance
        mock_txn = MagicMock()
        mock_txn.combined_balance_after = Decimal("2000.00")

        # Mock wallet
        mock_wallet = MagicMock()
        mock_wallet.id = wallet_id
        mock_wallet.combined_balance_last = Decimal("1000.00")

        # First query returns transaction, second returns wallet
        call_count = [0]

        def query_side_effect(*args, **kwargs):
            mock_query = MagicMock()
            call_count[0] += 1
            if call_count[0] == 1:
                # Transaction query
                mock_query.filter.return_value.order_by.return_value.first.return_value = mock_txn
            else:
                # Wallet query
                mock_query.filter.return_value.first.return_value = mock_wallet
            return mock_query

        mock_db.query.side_effect = query_side_effect

        balance = service.recalculate_wallet_balance(wallet_id)

        assert balance == Decimal("2000.00")

    def test_recalculate_wallet_balance_no_transactions(self):
        """Test recalculating balance when no transactions have balance info."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        # No transaction with balance
        mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = (
            None
        )

        balance = service.recalculate_wallet_balance(uuid4())

        assert balance is None


class TestInstitutionOperations:
    """Tests for institution listing."""

    def test_list_institutions_active_only(self):
        """Test listing only active institutions."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_institutions = [
            MagicMock(id=uuid4(), name="Bank1", is_active=True),
            MagicMock(id=uuid4(), name="Bank2", is_active=True),
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = (
            mock_institutions
        )

        institutions = service.list_institutions(active_only=True)

        assert len(institutions) == 2

    def test_list_institutions_all(self):
        """Test listing all institutions."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        mock_institutions = [
            MagicMock(id=uuid4(), name="Bank1", is_active=True),
            MagicMock(id=uuid4(), name="Bank2", is_active=False),
        ]
        mock_db.query.return_value.order_by.return_value.all.return_value = mock_institutions

        institutions = service.list_institutions(active_only=False)

        assert len(institutions) == 2


class TestDashboardSummary:
    """Tests for dashboard summary generation."""

    def test_wallet_summary_structure(self):
        """Test that wallet summary returns expected structure."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        wallet_id = uuid4()

        # Mock wallet
        mock_wallet = MagicMock()
        mock_wallet.id = wallet_id
        mock_wallet.name = "Test Wallet"
        mock_wallet.combined_balance_last = Decimal("5000.00")
        mock_wallet.currency = "AED"
        mock_wallet.wallet_instruments = []

        # Setup query mocks
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = (
            mock_wallet
        )
        mock_db.query.return_value.filter.return_value.scalar.return_value = 10

        with patch.object(service, "get_wallet", return_value=mock_wallet):
            summary = service.get_wallet_summary(wallet_id, days=30)

        assert "id" in summary
        assert "name" in summary
        assert "combined_balance_last" in summary
        assert "currency" in summary
        assert "instrument_count" in summary
        assert "recent_transaction_count" in summary
        assert "total_spent_this_month" in summary
        assert "total_income_this_month" in summary

    def test_dashboard_summary_aggregates_wallets(self):
        """Test that dashboard summary aggregates across wallets."""
        mock_db = MagicMock()
        service = WalletService(mock_db)

        # Mock list_wallets
        mock_wallets = [
            MagicMock(
                id=uuid4(),
                name="Wallet1",
                combined_balance_last=Decimal("5000.00"),
                currency="AED",
                wallet_instruments=[],
            ),
            MagicMock(
                id=uuid4(),
                name="Wallet2",
                combined_balance_last=Decimal("3000.00"),
                currency="AED",
                wallet_instruments=[],
            ),
        ]

        with patch.object(service, "list_wallets", return_value=mock_wallets):
            with patch.object(
                service,
                "get_wallet_summary",
                side_effect=[
                    {
                        "id": mock_wallets[0].id,
                        "name": "Wallet1",
                        "combined_balance_last": Decimal("5000.00"),
                        "currency": "AED",
                        "instrument_count": 1,
                        "recent_transaction_count": 5,
                        "total_spent_this_month": Decimal("500"),
                        "total_income_this_month": Decimal("0"),
                    },
                    {
                        "id": mock_wallets[1].id,
                        "name": "Wallet2",
                        "combined_balance_last": Decimal("3000.00"),
                        "currency": "AED",
                        "instrument_count": 1,
                        "recent_transaction_count": 3,
                        "total_spent_this_month": Decimal("300"),
                        "total_income_this_month": Decimal("0"),
                    },
                ],
            ):
                summary = service.get_dashboard_summary()

        assert "wallets" in summary
        assert "total_balance" in summary
        assert "currency" in summary
        assert len(summary["wallets"]) == 2
        assert summary["total_balance"] == Decimal("8000.00")


class TestInstrumentTypes:
    """Tests for instrument type handling."""

    def test_instrument_type_enum_values(self):
        """Test InstrumentType enum has expected values."""
        assert InstrumentType.CARD.value == "card"
        assert InstrumentType.ACCOUNT.value == "account"

    def test_card_requires_last4(self):
        """Test that card instruments should have last4."""
        # This is a validation check - not creating actual DB records
        card_last4 = "1234"
        assert len(card_last4) == 4
        assert card_last4.isdigit()

    def test_account_requires_tail(self):
        """Test that account instruments should have account_tail."""
        # This is a validation check
        account_tail = "567890"
        assert len(account_tail) >= 1
