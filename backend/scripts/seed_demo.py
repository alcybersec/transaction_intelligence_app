"""Seed the dev database with demo data so the v2 UI looks populated.

Run inside the api container:
    docker compose exec api python -m scripts.seed_demo

Idempotent for known names — re-running won't duplicate vendors/categories.
Transactions are timestamped, so re-running adds more rows.
"""

from __future__ import annotations

import random
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.db.models import (
    Category,
    EvidenceRole,
    Institution,
    Instrument,
    InstrumentType,
    Message,
    MessageSource,
    ParseMode,
    ParseStatus,
    TransactionDirection,
    TransactionEvidence,
    TransactionGroup,
    TransactionStatus,
    User,
    Vendor,
    Wallet,
    WalletInstrument,
)
from app.db.models.budget import Budget
from app.db.models.savings_goal import SavingsGoal
from app.db.session import SessionLocal
from app.services.auth import hash_password

CATEGORIES = [
    ("Groceries", "shopping-cart", "#10b981"),
    ("Dining", "utensils", "#f59e0b"),
    ("Transport", "car", "#3b82f6"),
    ("Subscriptions", "repeat", "#a855f7"),
    ("Utilities", "bolt", "#6366f1"),
    ("Shopping", "shopping-bag", "#ec4899"),
    ("Health", "heart", "#ef4444"),
    ("Travel", "plane", "#06b6d4"),
    ("Income", "trending-up", "#22c55e"),
    ("Other", "tag", "#94a3b8"),
]


VENDORS = [
    # (name, category, recurring, base_amount_aed)
    ("Spinneys", "Groceries", False, 180),
    ("Carrefour", "Groceries", False, 230),
    ("Waitrose", "Groceries", False, 145),
    ("Talabat", "Dining", False, 78),
    ("Deliveroo", "Dining", False, 62),
    ("Starbucks", "Dining", False, 28),
    ("Pret a Manger", "Dining", False, 45),
    ("Careem", "Transport", False, 35),
    ("Uber", "Transport", False, 42),
    ("ADNOC", "Transport", False, 220),
    ("ENOC", "Transport", False, 180),
    ("Netflix", "Subscriptions", True, 56),
    ("Spotify", "Subscriptions", True, 21),
    ("ChatGPT Plus", "Subscriptions", True, 75),
    ("iCloud+", "Subscriptions", True, 12),
    ("DEWA", "Utilities", True, 380),
    ("du Internet", "Utilities", True, 299),
    ("Etisalat Mobile", "Utilities", True, 165),
    ("IKEA", "Shopping", False, 410),
    ("Amazon.ae", "Shopping", False, 175),
    ("Sharaf DG", "Shopping", False, 850),
    ("Aster Pharmacy", "Health", False, 95),
    ("Emirates Hospital", "Health", False, 480),
    ("Emirates", "Travel", False, 2100),
    ("Booking.com", "Travel", False, 1250),
    ("Salary (Acme)", "Income", True, 18500),
]


SMS_SENDERS = {
    "Spinneys": "ENBD",
    "Carrefour": "ENBD",
    "Waitrose": "Mashreq",
    "Talabat": "ENBD",
    "Deliveroo": "Mashreq",
    "Starbucks": "ENBD",
    "Pret a Manger": "ENBD",
    "Careem": "Mashreq",
    "Uber": "ENBD",
    "ADNOC": "ENBD",
    "ENOC": "Mashreq",
    "Netflix": "Mashreq",
    "Spotify": "Mashreq",
    "ChatGPT Plus": "Mashreq",
    "iCloud+": "Mashreq",
    "DEWA": "ENBD",
    "du Internet": "ENBD",
    "Etisalat Mobile": "Mashreq",
    "IKEA": "ENBD",
    "Amazon.ae": "Mashreq",
    "Sharaf DG": "ENBD",
    "Aster Pharmacy": "ENBD",
    "Emirates Hospital": "Mashreq",
    "Emirates": "ENBD",
    "Booking.com": "Mashreq",
    "Salary (Acme)": "ENBD",
}


def now_utc() -> datetime:
    return datetime.now(UTC)


def get_or_create_user(db) -> User:
    user = db.scalar(select(User).where(User.username == "demo"))
    if user is None:
        user = User(
            id=uuid.uuid4(),
            username="demo",
            password_hash=hash_password("demo1234"),
            display_name="Demo User",
            email="demo@example.com",
            preferences={"currency": "AED", "date_format": "iso"},
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print("Created demo user (username=demo, password=demo1234)")
    else:
        print("Demo user already exists")
    return user


def seed_categories(db) -> dict[str, Category]:
    cat_by_name: dict[str, Category] = {}
    for sort_order, (name, icon, color) in enumerate(CATEGORIES):
        existing = db.scalar(select(Category).where(Category.name == name))
        if existing:
            cat_by_name[name] = existing
            continue
        c = Category(
            id=uuid.uuid4(),
            name=name,
            icon=icon,
            color=color,
            sort_order=sort_order,
            is_system=(name in {"Income", "Other"}),
        )
        db.add(c)
        cat_by_name[name] = c
    db.commit()
    for c in cat_by_name.values():
        db.refresh(c)
    print(f"Seeded {len(cat_by_name)} categories")
    return cat_by_name


def seed_institutions(db) -> dict[str, Institution]:
    insts: dict[str, Institution] = {}
    for code, display_name in [("enbd", "Emirates NBD"), ("mashreq", "Mashreq Bank")]:
        existing = db.scalar(select(Institution).where(Institution.name == code))
        if existing:
            insts[code] = existing
            continue
        inst = Institution(
            id=uuid.uuid4(),
            name=code,
            display_name=display_name,
        )
        db.add(inst)
        insts[code] = inst
    db.commit()
    for i in insts.values():
        db.refresh(i)
    return insts


def seed_wallets_and_instruments(
    db, insts: dict[str, Institution]
) -> tuple[Wallet, list[Instrument]]:
    wallet = db.scalar(select(Wallet).where(Wallet.name == "Personal"))
    if wallet is None:
        wallet = Wallet(
            id=uuid.uuid4(),
            name="Personal",
            currency="AED",
            combined_balance_last=Decimal("12450.00"),
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        print("Created Personal wallet")

    instruments: list[Instrument] = []
    for inst_code, type_, display_name, last4 in [
        ("enbd", InstrumentType.CARD, "ENBD Visa Debit", "1234"),
        ("enbd", InstrumentType.ACCOUNT, "ENBD Current", "5678"),
        ("mashreq", InstrumentType.CARD, "Mashreq Mastercard", "9876"),
    ]:
        existing = db.scalar(
            select(Instrument).where(
                Instrument.institution_id == insts[inst_code].id,
                Instrument.display_name == display_name,
            )
        )
        if existing:
            instruments.append(existing)
            continue
        instr = Instrument(
            id=uuid.uuid4(),
            institution_id=insts[inst_code].id,
            type=type_,
            display_name=display_name,
            last4=last4 if type_ == InstrumentType.CARD else None,
            account_tail=last4 if type_ == InstrumentType.ACCOUNT else None,
        )
        db.add(instr)
        instruments.append(instr)
    db.commit()
    for i in instruments:
        db.refresh(i)
        # Link to wallet
        link = db.scalar(
            select(WalletInstrument).where(
                WalletInstrument.wallet_id == wallet.id,
                WalletInstrument.instrument_id == i.id,
            )
        )
        if link is None:
            db.add(WalletInstrument(wallet_id=wallet.id, instrument_id=i.id))
    db.commit()
    print(f"Seeded wallet + {len(instruments)} instruments")
    return wallet, instruments


def seed_vendors(db, cats: dict[str, Category]) -> dict[str, Vendor]:
    vendor_by_name: dict[str, Vendor] = {}
    for name, _cat, recurring, _amount in VENDORS:
        existing = db.scalar(select(Vendor).where(Vendor.canonical_name == name))
        if existing:
            if existing.is_recurring != recurring:
                existing.is_recurring = recurring
            vendor_by_name[name] = existing
            continue
        v = Vendor(
            id=uuid.uuid4(),
            canonical_name=name,
            is_recurring=recurring,
        )
        db.add(v)
        vendor_by_name[name] = v
    db.commit()
    for v in vendor_by_name.values():
        db.refresh(v)
    print(f"Seeded {len(vendor_by_name)} vendors")
    return vendor_by_name


def seed_transactions(
    db,
    user: User,
    wallet: Wallet,
    instruments: list[Instrument],
    cats: dict[str, Category],
    vendors: dict[str, Vendor],
):
    """Create ~90 days of transactions backwards from today."""
    today = now_utc()
    txn_count = 0

    # First: clear out anything from previous demo runs to keep dashboards consistent.
    # (Optional — if you want incremental seeds, comment this out.)
    db.query(TransactionEvidence).delete()
    db.query(TransactionGroup).delete()
    db.query(Message).delete()
    db.commit()

    for vendor_name, cat_name, recurring, base_amount in VENDORS:
        vendor = vendors[vendor_name]
        category = cats[cat_name]
        direction = (
            TransactionDirection.CREDIT if cat_name == "Income" else TransactionDirection.DEBIT
        )

        # Choose cadence
        if recurring:
            # Monthly: 3 occurrences over 3 months
            cadence_days = 30
            n = 3
        elif vendor_name in {"Salary (Acme)"}:
            cadence_days = 30
            n = 3
        else:
            # Sporadic: 5-12 transactions over 90 days
            cadence_days = random.randint(7, 18)
            n = random.randint(5, 12)

        for i in range(n):
            day_offset = i * cadence_days + random.randint(0, 4)
            ts = today - timedelta(
                days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59)
            )
            if ts > today:
                continue

            amount_variance = random.uniform(-0.15, 0.20)
            amount = Decimal(str(round(base_amount * (1 + amount_variance), 2)))
            if amount <= 0:
                amount = Decimal("1.00")

            instr = instruments[i % len(instruments)]

            # Create the Message (evidence source) for this txn
            ms_source = MessageSource.SMS
            ms_sender = SMS_SENDERS.get(vendor_name, "ENBD")
            msg = Message(
                id=uuid.uuid4(),
                source=ms_source,
                source_uid=f"demo-{uuid.uuid4().hex[:12]}",
                sender=ms_sender,
                observed_at=ts,
                raw_body_encrypted=b"",  # encrypted body left empty; we don't surface raw_body in demo
                raw_body_hash=uuid.uuid4().hex,
                parse_status=ParseStatus.SUCCESS,
                parse_mode=ParseMode.REGEX,
            )
            db.add(msg)

            txn = TransactionGroup(
                id=uuid.uuid4(),
                wallet_id=wallet.id,
                instrument_id=instr.id,
                direction=direction,
                amount=amount,
                currency="AED",
                occurred_at=ts,
                observed_at_min=ts,
                observed_at_max=ts,
                vendor_id=vendor.id,
                vendor_raw=vendor_name,
                category_id=category.id,
                reference_id=f"REF-{uuid.uuid4().hex[:8].upper()}",
                combined_balance_after=Decimal("12000.00") - amount,
                status=TransactionStatus.POSTED,
                is_recurring=recurring,
            )
            db.add(txn)
            db.flush()

            ev = TransactionEvidence(
                id=uuid.uuid4(),
                transaction_group_id=txn.id,
                message_id=msg.id,
                role=EvidenceRole.PRIMARY,
            )
            db.add(ev)
            txn_count += 1

    db.commit()
    print(f"Seeded {txn_count} transactions across ~90 days")


def seed_budgets(db, cats: dict[str, Category]):
    today = now_utc()
    this_month = today.replace(day=1).date()
    last_month = (this_month - timedelta(days=1)).replace(day=1)

    plan = {
        "Groceries": 1500,
        "Dining": 800,
        "Transport": 700,
        "Subscriptions": 250,
        "Utilities": 1000,
        "Shopping": 600,
        "Health": 400,
    }

    db.query(Budget).delete()
    db.commit()

    n = 0
    for month in [last_month, this_month]:
        for cat_name, limit in plan.items():
            cat = cats[cat_name]
            b = Budget(
                id=uuid.uuid4(),
                category_id=cat.id,
                month=month,
                limit_amount=Decimal(str(limit)),
                currency="AED",
            )
            db.add(b)
            n += 1
    db.commit()
    print(f"Seeded {n} budgets across 2 months")


def seed_goals(db, user: User):
    today = now_utc().date()
    plan = [
        ("Emergency fund", 30000, 12500, today + timedelta(days=240), "#10b981"),
        ("Japan trip", 18000, 7200, today + timedelta(days=180), "#ef4444"),
        ("MacBook Pro", 12000, 9400, today + timedelta(days=90), "#3b82f6"),
        ("Course fund", 5000, 1100, today + timedelta(days=120), "#a855f7"),
    ]

    db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id).delete()
    db.commit()

    for name, target, saved, target_date, color in plan:
        g = SavingsGoal(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            target_amount=Decimal(str(target)),
            saved_amount=Decimal(str(saved)),
            target_date=target_date,
            color=color,
        )
        db.add(g)
    db.commit()
    print(f"Seeded {len(plan)} savings goals")


def main():
    random.seed(42)  # deterministic-ish
    db = SessionLocal()
    try:
        user = get_or_create_user(db)
        cats = seed_categories(db)
        insts = seed_institutions(db)
        wallet, instruments = seed_wallets_and_instruments(db, insts)
        vendors = seed_vendors(db, cats)
        seed_transactions(db, user, wallet, instruments, cats, vendors)
        seed_budgets(db, cats)
        seed_goals(db, user)
        print()
        print("=" * 50)
        print("Demo data seeded successfully.")
        print("Login at http://localhost:5174 with:")
        print("  username: demo")
        print("  password: demo1234")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    main()
