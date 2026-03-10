"""Vendor normalization and alias management service."""

import re
import unicodedata
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Category, Vendor, VendorAlias, VendorCategoryRule


class VendorService:
    """Service for vendor normalization and management."""

    # Common noise tokens to strip (country codes, city suffixes, etc.)
    NOISE_TOKENS = {
        "UAE",
        "AE",
        "DUBAI",
        "ABU DHABI",
        "SHARJAH",
        "AJMAN",
        "RAK",
        "FUJAIRAH",
        "AL AIN",
        "DXB",
        "AUH",
        "UNITED ARAB EMIRATES",
        "LLC",
        "FZE",
        "FZC",
        "FZCO",
        "CO",
        "INC",
        "LTD",
        "PVT",
        "PRIVATE",
        "LIMITED",
        "BRANCH",
        "BR",
        "STORE",
        "SHOP",
        "OUTLET",
    }

    # Patterns for location/branch identifiers at the end
    TRAILING_PATTERNS = [
        r"\s*-\s*\d+$",  # Branch numbers like "- 123"
        r"\s+\d{4,}$",  # Long numbers at end (store codes)
        r"\s+BR\s*\d+$",  # Branch BR 01
        r"\s+BRANCH\s*\d*$",
        r"\s+#\d+$",  # Store numbers like "#123"
    ]

    def __init__(self, db: Session):
        self.db = db

    def normalize(self, vendor_raw: str) -> str:
        """
        Normalize a vendor string deterministically.

        Steps:
        1. Convert to uppercase
        2. Normalize unicode (NFKC)
        3. Collapse whitespace
        4. Strip noise tokens
        5. Remove trailing patterns (branch numbers, etc.)
        6. Final cleanup

        Args:
            vendor_raw: Original vendor string from message

        Returns:
            Normalized vendor string
        """
        if not vendor_raw:
            return ""

        # Step 1: Uppercase
        normalized = vendor_raw.upper()

        # Step 2: Unicode normalization (NFKC)
        normalized = unicodedata.normalize("NFKC", normalized)

        # Step 3: Replace multiple whitespace with single space
        normalized = re.sub(r"\s+", " ", normalized)

        # Strip leading/trailing whitespace
        normalized = normalized.strip()

        # Step 4: Remove trailing patterns (branch numbers, etc.)
        for pattern in self.TRAILING_PATTERNS:
            normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE)

        # Step 5: Remove noise tokens (only if they appear as whole words)
        words = normalized.split()
        filtered_words = []
        for word in words:
            # Remove common noise but keep if it's the only word
            if word not in self.NOISE_TOKENS:
                filtered_words.append(word)

        # Don't leave it empty
        if filtered_words:
            normalized = " ".join(filtered_words)
        elif words:
            # If all words were noise, keep the first one
            normalized = words[0]

        # Step 6: Final whitespace cleanup
        normalized = re.sub(r"\s+", " ", normalized).strip()

        return normalized

    def get_or_create_vendor(self, vendor_raw: str) -> tuple[Vendor, bool]:
        """
        Get or create a vendor from a raw vendor string.

        Args:
            vendor_raw: Original vendor string from message

        Returns:
            Tuple of (Vendor, was_created)
        """
        normalized = self.normalize(vendor_raw)

        if not normalized:
            # Create a generic unknown vendor
            normalized = "UNKNOWN"

        # Check if we have an alias for this normalized form
        alias = (
            self.db.query(VendorAlias).filter(VendorAlias.alias_normalized == normalized).first()
        )

        if alias:
            return alias.vendor, False

        # Check if vendor with this canonical name exists
        vendor = self.db.query(Vendor).filter(Vendor.canonical_name == normalized).first()

        if vendor:
            # Create alias mapping
            new_alias = VendorAlias(
                vendor_id=vendor.id,
                alias_raw=vendor_raw,
                alias_normalized=normalized,
            )
            self.db.add(new_alias)
            self.db.commit()
            return vendor, False

        # Create new vendor
        vendor = Vendor(canonical_name=normalized)
        self.db.add(vendor)
        self.db.flush()

        # Create alias mapping
        alias = VendorAlias(
            vendor_id=vendor.id,
            alias_raw=vendor_raw,
            alias_normalized=normalized,
        )
        self.db.add(alias)
        self.db.commit()

        return vendor, True

    def get_vendor_category(self, vendor_id) -> Category | None:
        """
        Get the category for a vendor based on manual rules.

        Args:
            vendor_id: UUID of the vendor

        Returns:
            Category if a rule exists, None otherwise
        """
        rule = (
            self.db.query(VendorCategoryRule)
            .filter(
                VendorCategoryRule.vendor_id == vendor_id,
                VendorCategoryRule.enabled.is_(True),
            )
            .order_by(VendorCategoryRule.priority.desc())
            .first()
        )

        if rule:
            return rule.category

        return None

    def set_vendor_category(self, vendor_id, category_id, priority: int = 0) -> VendorCategoryRule:
        """
        Set or update a vendor's category rule.

        Args:
            vendor_id: UUID of the vendor
            category_id: UUID of the category
            priority: Rule priority (higher = more important)

        Returns:
            The created or updated rule
        """
        rule = (
            self.db.query(VendorCategoryRule)
            .filter(
                VendorCategoryRule.vendor_id == vendor_id,
                VendorCategoryRule.category_id == category_id,
            )
            .first()
        )

        if rule:
            rule.priority = priority
            rule.enabled = True
            rule.updated_at = datetime.utcnow()
        else:
            rule = VendorCategoryRule(
                vendor_id=vendor_id,
                category_id=category_id,
                priority=priority,
                enabled=True,
            )
            self.db.add(rule)

        self.db.commit()
        return rule
