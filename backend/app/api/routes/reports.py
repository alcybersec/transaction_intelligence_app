"""Report and Export API endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.analytics import ExportRequest
from app.schemas.report import (
    ReportDetailResponse,
    ReportGenerateRequest,
    ReportListResponse,
    ReportResponse,
)
from app.services.export import ExportService
from app.services.report import ReportService

router = APIRouter()


# ============== Reports ==============


@router.post("", response_model=ReportResponse, status_code=201)
async def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    """
    Generate a new financial report for a period.

    Creates both markdown and PDF versions of the report.
    Optionally includes AI-generated insights if include_ai_insights is True.
    """
    service = ReportService(db)
    report = service.generate_report(
        request,
        include_ai_insights=request.include_ai_insights,
    )

    return ReportResponse(
        id=report.id,
        wallet_id=report.wallet_id,
        wallet_name=report.wallet.name if report.wallet else None,
        period_start=report.period_start,
        period_end=report.period_end,
        has_markdown=report.report_markdown is not None,
        has_pdf=report.report_pdf_blob is not None,
        generated_by=report.generated_by.value,
        ai_model=report.ai_model,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=ReportListResponse)
async def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ReportListResponse:
    """
    List generated reports.
    """
    service = ReportService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    return service.list_reports(
        wallet_id=wallet_uuid,
        limit=limit,
        offset=offset,
    )


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportDetailResponse:
    """
    Get a report by ID with markdown content.
    """
    service = ReportService(db)
    report = service.get_report(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportDetailResponse(
        id=report.id,
        wallet_id=report.wallet_id,
        wallet_name=report.wallet.name if report.wallet else None,
        period_start=report.period_start,
        period_end=report.period_end,
        report_markdown=report.report_markdown,
        has_pdf=report.report_pdf_blob is not None,
        generated_by=report.generated_by.value,
        ai_model=report.ai_model,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("/{report_id}/pdf")
async def download_report_pdf(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Download a report as PDF.
    """
    service = ReportService(db)
    report = service.get_report(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.report_pdf_blob:
        raise HTTPException(status_code=404, detail="PDF not available for this report")

    # Format filename
    filename = f"report_{report.period_start.strftime('%Y%m')}.pdf"

    return Response(
        content=report.report_pdf_blob,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a report.
    """
    service = ReportService(db)
    deleted = service.delete_report(report_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")


# ============== Exports ==============


@router.get("/export/transactions.csv")
async def export_transactions_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    wallet_id: str | None = Query(None),
    category_id: str | None = Query(None),
    vendor_id: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    direction: str | None = Query(None, description="'debit' or 'credit'"),
) -> Response:
    """
    Export transactions to CSV.

    Filters are optional. Returns all transactions if no filters specified.
    """
    service = ExportService(db)

    request = ExportRequest(
        wallet_id=UUID(wallet_id) if wallet_id else None,
        category_id=UUID(category_id) if category_id else None,
        vendor_id=UUID(vendor_id) if vendor_id else None,
        start_date=start_date,
        end_date=end_date,
        direction=direction,
    )

    csv_content = service.export_transactions_csv(request)

    # Generate filename with date range if provided
    if start_date and end_date:
        filename = f"transactions_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv"
    else:
        filename = "transactions.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/export/categories.csv")
async def export_categories_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_start: date = Query(..., description="Start date"),
    period_end: date = Query(..., description="End date"),
    wallet_id: str | None = Query(None),
) -> Response:
    """
    Export category spending summary to CSV.
    """
    service = ExportService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    csv_content = service.export_category_summary_csv(
        period_start=period_start,
        period_end=period_end,
        wallet_id=wallet_uuid,
    )

    filename = f"category_summary_{period_start.strftime('%Y%m%d')}_{period_end.strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/export/vendors.csv")
async def export_vendors_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_start: date = Query(..., description="Start date"),
    period_end: date = Query(..., description="End date"),
    wallet_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
) -> Response:
    """
    Export vendor spending summary to CSV.
    """
    service = ExportService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    csv_content = service.export_vendor_summary_csv(
        period_start=period_start,
        period_end=period_end,
        wallet_id=wallet_uuid,
        limit=limit,
    )

    filename = f"vendor_summary_{period_start.strftime('%Y%m%d')}_{period_end.strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
