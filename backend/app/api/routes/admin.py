"""Admin endpoints for data repair and maintenance operations."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.db.models import ParseMode
from app.db.session import get_db
from app.services.admin import AdminService

router = APIRouter()


# Request/Response schemas
class ReparseRequest(BaseModel):
    since: datetime = Field(..., description="Reparse messages from this datetime")
    institution_name: Optional[str] = Field(
        None, description="Filter by institution name"
    )
    parse_mode: Optional[str] = Field(
        None, description="Override parse mode (regex/ollama/hybrid)"
    )
    include_successful: bool = Field(
        False, description="Also reparse already successful messages"
    )
    dry_run: bool = Field(True, description="Preview without making changes")


class ReparseResponse(BaseModel):
    total_found: int
    reparsed: int
    success: int
    failed: int
    needs_review: int
    skipped: int
    dry_run: bool


class RemergeRequest(BaseModel):
    start_date: datetime = Field(..., description="Start of date range")
    end_date: datetime = Field(..., description="End of date range")
    wallet_id: Optional[UUID] = Field(None, description="Filter by wallet")
    dry_run: bool = Field(True, description="Preview without making changes")


class RemergeResponse(BaseModel):
    messages_found: int
    groups_affected: int
    groups_deleted: int
    evidence_deleted: int
    new_groups_created: int
    messages_merged: int
    errors: int
    dry_run: bool


class VendorMergeRequest(BaseModel):
    source_vendor_id: UUID = Field(..., description="Vendor to merge from (will be deleted)")
    target_vendor_id: UUID = Field(..., description="Vendor to merge into (will be kept)")
    dry_run: bool = Field(True, description="Preview without making changes")


class VendorMergeResponse(BaseModel):
    source_vendor: str
    target_vendor: str
    transactions_updated: int
    aliases_moved: int
    rules_merged: int
    rules_deleted: int
    source_deleted: bool
    dry_run: bool


class VendorInfo(BaseModel):
    id: str
    name: str
    transaction_count: int
    total_amount: float
    aliases: list[str]


class VendorMergePreview(BaseModel):
    source: VendorInfo
    target: VendorInfo
    after_merge: VendorInfo


class DataHealthReport(BaseModel):
    messages: dict
    total_messages: int
    transaction_groups: int
    vendors: dict
    integrity_issues: dict


@router.post("/reparse", response_model=ReparseResponse)
async def reparse_messages(
    request: ReparseRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> ReparseResponse:
    """
    Re-parse messages from a specific date.

    This endpoint allows administrators to re-parse messages that may have
    failed parsing or need to be re-processed with a different parse mode.

    Requires admin privileges.
    """
    admin_service = AdminService(db)

    # Convert parse mode string to enum
    parse_mode = None
    if request.parse_mode:
        try:
            parse_mode = ParseMode(request.parse_mode.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid parse mode: {request.parse_mode}. Must be one of: regex, ollama, hybrid",
            )

    stats = admin_service.reparse_messages_since(
        since=request.since,
        institution_name=request.institution_name,
        parse_mode=parse_mode,
        include_successful=request.include_successful,
        dry_run=request.dry_run,
    )

    return ReparseResponse(**stats)


@router.post("/remerge", response_model=RemergeResponse)
async def remerge_transactions(
    request: RemergeRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> RemergeResponse:
    """
    Re-run merge logic for transactions in a date range.

    This endpoint clears existing transaction groups and re-processes
    all successfully parsed messages in the specified date range.

    WARNING: This is a destructive operation. Transaction notes and
    manual categorizations may be lost.

    Requires admin privileges.
    """
    if request.start_date > request.end_date:
        raise HTTPException(
            status_code=400, detail="start_date must be before end_date"
        )

    admin_service = AdminService(db)

    stats = admin_service.remerge_date_range(
        start_date=request.start_date,
        end_date=request.end_date,
        wallet_id=request.wallet_id,
        dry_run=request.dry_run,
    )

    return RemergeResponse(**stats)


@router.get("/vendors/merge-preview", response_model=VendorMergePreview)
async def preview_vendor_merge(
    source_vendor_id: UUID = Query(..., description="Vendor to merge from"),
    target_vendor_id: UUID = Query(..., description="Vendor to merge into"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> VendorMergePreview:
    """
    Preview what would happen if two vendors were merged.

    Returns details about both vendors and the expected result after merge.

    Requires admin privileges.
    """
    admin_service = AdminService(db)

    try:
        preview = admin_service.get_vendor_merge_preview(
            source_vendor_id=source_vendor_id,
            target_vendor_id=target_vendor_id,
        )
        return VendorMergePreview(**preview)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/vendors/merge", response_model=VendorMergeResponse)
async def merge_vendors(
    request: VendorMergeRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> VendorMergeResponse:
    """
    Merge one vendor into another.

    All transactions, aliases, and category rules from the source vendor
    will be transferred to the target vendor. The source vendor will be deleted.

    Requires admin privileges.
    """
    admin_service = AdminService(db)

    try:
        stats = admin_service.merge_vendors(
            source_vendor_id=request.source_vendor_id,
            target_vendor_id=request.target_vendor_id,
            dry_run=request.dry_run,
        )
        return VendorMergeResponse(**stats)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health-report", response_model=DataHealthReport)
async def get_data_health_report(
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> DataHealthReport:
    """
    Generate a data health and integrity report.

    Returns counts of messages by status, transaction groups,
    vendors, and any data integrity issues.

    Requires admin privileges.
    """
    admin_service = AdminService(db)
    report = admin_service.get_data_health_report()
    return DataHealthReport(**report)


@router.post("/cleanup/orphaned-evidence")
async def cleanup_orphaned_evidence(
    dry_run: bool = Query(True, description="Preview without making changes"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> dict:
    """
    Clean up orphaned transaction evidence records.

    Removes evidence records that reference non-existent messages.

    Requires admin privileges.
    """
    from app.db.models import Message, TransactionEvidence

    # Find orphaned evidence
    orphaned = (
        db.query(TransactionEvidence)
        .outerjoin(Message, TransactionEvidence.message_id == Message.id)
        .filter(Message.id.is_(None))
        .all()
    )

    count = len(orphaned)

    if not dry_run and count > 0:
        for evidence in orphaned:
            db.delete(evidence)
        db.commit()

    return {
        "orphaned_evidence_found": count,
        "deleted": count if not dry_run else 0,
        "dry_run": dry_run,
    }


@router.post("/cleanup/empty-groups")
async def cleanup_empty_groups(
    dry_run: bool = Query(True, description="Preview without making changes"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_admin_user),
) -> dict:
    """
    Clean up transaction groups without any evidence.

    Removes groups that have no linked message evidence.

    Requires admin privileges.
    """
    from app.db.models import TransactionEvidence, TransactionGroup

    # Find groups without evidence
    empty_groups = (
        db.query(TransactionGroup)
        .outerjoin(
            TransactionEvidence,
            TransactionGroup.id == TransactionEvidence.transaction_group_id,
        )
        .filter(TransactionEvidence.id.is_(None))
        .all()
    )

    count = len(empty_groups)

    if not dry_run and count > 0:
        for group in empty_groups:
            db.delete(group)
        db.commit()

    return {
        "empty_groups_found": count,
        "deleted": count if not dry_run else 0,
        "dry_run": dry_run,
    }
