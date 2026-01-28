"""Report service for generating monthly financial reports."""

import io
import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Category,
    Report,
    ReportGeneratedBy,
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
    Vendor,
    Wallet,
)
from app.schemas.report import (
    ReportDetailResponse,
    ReportGenerateRequest,
    ReportListResponse,
    ReportResponse,
)
from app.services.analytics import AnalyticsService

logger = logging.getLogger(__name__)


class ReportService:
    """Service for report generation and management."""

    def __init__(self, db: Session):
        self.db = db
        self.analytics = AnalyticsService(db)

    def generate_report(
        self,
        request: ReportGenerateRequest,
        generated_by: ReportGeneratedBy = ReportGeneratedBy.MANUAL,
        include_ai_insights: bool = False,
    ) -> Report:
        """
        Generate a new financial report.

        Args:
            request: Report generation request
            generated_by: How the report was triggered
            include_ai_insights: Whether to include AI-generated insights

        Returns:
            Generated report
        """
        # Get AI insights if requested
        ai_insights = None
        ai_model = None

        if include_ai_insights:
            ai_insights, ai_model = self._generate_ai_insights(
                request.wallet_id,
                request.period_start,
                request.period_end,
            )

        # Generate markdown content
        markdown_content = self._generate_markdown(
            request.wallet_id,
            request.period_start,
            request.period_end,
            ai_insights=ai_insights,
        )

        # Generate PDF
        pdf_blob = self._generate_pdf(markdown_content)

        # Create report record
        report = Report(
            wallet_id=request.wallet_id,
            period_start=request.period_start,
            period_end=request.period_end,
            report_markdown=markdown_content,
            report_pdf_blob=pdf_blob,
            generated_by=generated_by,
            ai_model=ai_model,
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report(self, report_id: UUID) -> Report | None:
        """Get a report by ID."""
        return (
            self.db.query(Report)
            .options(joinedload(Report.wallet))
            .filter(Report.id == report_id)
            .first()
        )

    def get_report_pdf(self, report_id: UUID) -> bytes | None:
        """Get the PDF blob for a report."""
        report = self.db.query(Report).filter(Report.id == report_id).first()
        if report and report.report_pdf_blob:
            return report.report_pdf_blob
        return None

    def list_reports(
        self,
        wallet_id: UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> ReportListResponse:
        """List reports with optional filtering."""
        query = self.db.query(Report).options(joinedload(Report.wallet))

        if wallet_id:
            query = query.filter(Report.wallet_id == wallet_id)

        total = query.count()
        reports = query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()

        report_responses = [
            ReportResponse(
                id=r.id,
                wallet_id=r.wallet_id,
                wallet_name=r.wallet.name if r.wallet else None,
                period_start=r.period_start,
                period_end=r.period_end,
                has_markdown=r.report_markdown is not None,
                has_pdf=r.report_pdf_blob is not None,
                generated_by=r.generated_by.value,
                ai_model=r.ai_model,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in reports
        ]

        return ReportListResponse(reports=report_responses, total=total)

    def delete_report(self, report_id: UUID) -> bool:
        """Delete a report."""
        report = self.db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return False

        self.db.delete(report)
        self.db.commit()
        return True

    def _generate_ai_insights(
        self,
        wallet_id: UUID | None,
        period_start: date,
        period_end: date,
    ) -> tuple[dict | None, str | None]:
        """
        Generate AI insights for the report.

        Returns:
            Tuple of (insights dict, model name) or (None, None) if unavailable
        """
        from app.services.ollama import OllamaError, get_ollama_service

        ollama = get_ollama_service()

        if not ollama.is_configured:
            logger.info("Ollama not configured, skipping AI insights")
            return None, None

        try:
            # Get analytics data for AI
            analytics = self.analytics.get_dashboard_analytics(
                wallet_id=wallet_id,
                period_start=period_start,
                period_end=period_end,
            )

            category_breakdown = self.analytics.get_category_breakdown(
                period_start=period_start,
                period_end=period_end,
                wallet_id=wallet_id,
            )

            top_vendors = self.analytics.get_top_vendors(
                period_start=period_start,
                period_end=period_end,
                wallet_id=wallet_id,
                limit=10,
            )

            # Prepare data for AI
            analytics_data = {
                "total_spending": float(analytics.total_spending),
                "total_income": float(analytics.total_income),
                "net_change": float(analytics.net_change),
                "transaction_count": analytics.transaction_count,
                "currency": analytics.currency,
                "categories": [
                    {
                        "name": c.category_name,
                        "amount": float(c.total_amount),
                        "percentage": c.percentage,
                        "count": c.transaction_count,
                    }
                    for c in category_breakdown.categories[:10]
                ],
                "top_vendors": [
                    {
                        "name": v.vendor_name,
                        "amount": float(v.total_amount),
                        "count": v.transaction_count,
                    }
                    for v in top_vendors.vendors[:5]
                ],
            }

            if analytics.monthly_comparison:
                analytics_data["monthly_comparison"] = {
                    "current": float(analytics.monthly_comparison.current_month_spending),
                    "previous": float(analytics.monthly_comparison.previous_month_spending),
                    "change_amount": float(analytics.monthly_comparison.change_amount),
                    "change_percentage": analytics.monthly_comparison.change_percentage,
                }

            period_desc = f"{period_start.strftime('%B %d, %Y')} to {period_end.strftime('%B %d, %Y')}"

            insights = ollama.generate_report_insights(analytics_data, period_desc)
            return insights, ollama.model

        except OllamaError as e:
            logger.warning(f"Failed to generate AI insights: {e}")
            return None, None
        except Exception as e:
            logger.exception(f"Error generating AI insights: {e}")
            return None, None

    def _generate_markdown(
        self,
        wallet_id: UUID | None,
        period_start: date,
        period_end: date,
        ai_insights: dict | None = None,
    ) -> str:
        """Generate markdown content for a report."""
        # Get analytics data
        analytics = self.analytics.get_dashboard_analytics(
            wallet_id=wallet_id,
            period_start=period_start,
            period_end=period_end,
        )

        category_breakdown = self.analytics.get_category_breakdown(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
        )

        top_vendors = self.analytics.get_top_vendors(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            limit=10,
        )

        # Get wallet name if applicable
        wallet_name = "All Wallets"
        if wallet_id:
            wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
            if wallet:
                wallet_name = wallet.name

        # Build markdown
        lines = []

        # Header
        lines.append(f"# Financial Report")
        lines.append("")
        lines.append(f"**Period:** {period_start.strftime('%B %d, %Y')} - {period_end.strftime('%B %d, %Y')}")
        lines.append(f"**Wallet:** {wallet_name}")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}")
        lines.append("")

        # Summary
        lines.append("## Summary")
        lines.append("")
        if analytics.total_balance is not None:
            lines.append(f"- **Current Balance:** {analytics.currency} {analytics.total_balance:,.2f}")
        lines.append(f"- **Total Spending:** {analytics.currency} {analytics.total_spending:,.2f}")
        lines.append(f"- **Total Income:** {analytics.currency} {analytics.total_income:,.2f}")
        lines.append(f"- **Net Change:** {analytics.currency} {analytics.net_change:,.2f}")
        lines.append(f"- **Transactions:** {analytics.transaction_count}")
        lines.append("")

        # Monthly comparison
        if analytics.monthly_comparison:
            mc = analytics.monthly_comparison
            lines.append("### Month-over-Month")
            lines.append("")
            lines.append(f"- Current month spending: {analytics.currency} {mc.current_month_spending:,.2f}")
            lines.append(f"- Previous month spending: {analytics.currency} {mc.previous_month_spending:,.2f}")
            change_sign = "+" if mc.change_amount >= 0 else ""
            lines.append(f"- Change: {change_sign}{analytics.currency} {mc.change_amount:,.2f}")
            if mc.change_percentage is not None:
                pct_sign = "+" if mc.change_percentage >= 0 else ""
                lines.append(f"- Percentage change: {pct_sign}{mc.change_percentage:.1f}%")
            lines.append("")

        # Category breakdown
        lines.append("## Spending by Category")
        lines.append("")
        if category_breakdown.categories:
            lines.append("| Category | Amount | % of Total | Transactions |")
            lines.append("|----------|--------|------------|--------------|")
            for cat in category_breakdown.categories:
                lines.append(
                    f"| {cat.category_name} | {analytics.currency} {cat.total_amount:,.2f} | "
                    f"{cat.percentage:.1f}% | {cat.transaction_count} |"
                )
            lines.append("")
            lines.append(f"**Total:** {analytics.currency} {category_breakdown.total_spending:,.2f}")
        else:
            lines.append("No transactions in this period.")
        lines.append("")

        # Top vendors
        lines.append("## Top Merchants")
        lines.append("")
        if top_vendors.vendors:
            lines.append("| Merchant | Category | Amount | Transactions |")
            lines.append("|----------|----------|--------|--------------|")
            for vendor in top_vendors.vendors:
                cat_name = vendor.category_name or "Uncategorized"
                lines.append(
                    f"| {vendor.vendor_name} | {cat_name} | "
                    f"{analytics.currency} {vendor.total_amount:,.2f} | {vendor.transaction_count} |"
                )
        else:
            lines.append("No vendor transactions in this period.")
        lines.append("")

        # AI Insights section (if available)
        if ai_insights:
            lines.append("## AI Insights")
            lines.append("")

            # Executive summary
            if ai_insights.get("summary"):
                lines.append(f"**Summary:** {ai_insights['summary']}")
                lines.append("")

            # Key insights
            if ai_insights.get("insights"):
                lines.append("### Key Observations")
                lines.append("")
                for insight in ai_insights["insights"]:
                    lines.append(f"- {insight}")
                lines.append("")

            # Notable changes
            if ai_insights.get("notable_changes"):
                lines.append("### Notable Changes")
                lines.append("")
                for change in ai_insights["notable_changes"]:
                    lines.append(f"- {change}")
                lines.append("")

            # Recommendations
            if ai_insights.get("recommendations"):
                lines.append("### Recommendations")
                lines.append("")
                for rec in ai_insights["recommendations"]:
                    lines.append(f"- {rec}")
                lines.append("")

        # Footer
        lines.append("---")
        ai_note = " with AI insights" if ai_insights else ""
        lines.append(f"*Report generated by Transaction Intelligence App{ai_note}*")

        return "\n".join(lines)

    def _generate_pdf(self, markdown_content: str) -> bytes | None:
        """Generate PDF from markdown content."""
        try:
            import markdown
            from weasyprint import HTML, CSS

            # Convert markdown to HTML
            html_content = markdown.markdown(
                markdown_content,
                extensions=["tables", "fenced_code"],
            )

            # Wrap in HTML document with styling
            full_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px;
                        color: #333;
                    }}
                    h1 {{
                        color: #1a1a1a;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }}
                    h2 {{
                        color: #2a2a2a;
                        margin-top: 30px;
                    }}
                    h3 {{
                        color: #3a3a3a;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }}
                    th, td {{
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }}
                    th {{
                        background-color: #f5f5f5;
                        font-weight: 600;
                    }}
                    tr:hover {{
                        background-color: #f9f9f9;
                    }}
                    ul {{
                        padding-left: 20px;
                    }}
                    li {{
                        margin: 8px 0;
                    }}
                    strong {{
                        color: #1a1a1a;
                    }}
                    hr {{
                        border: none;
                        border-top: 1px solid #ddd;
                        margin: 30px 0;
                    }}
                    em {{
                        color: #666;
                    }}
                </style>
            </head>
            <body>
                {html_content}
            </body>
            </html>
            """

            # Generate PDF
            pdf_buffer = io.BytesIO()
            HTML(string=full_html).write_pdf(pdf_buffer)
            return pdf_buffer.getvalue()

        except ImportError:
            # WeasyPrint not available, return None
            return None
        except Exception:
            # PDF generation failed, return None
            return None
