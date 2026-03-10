"""AI-related API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import Category, Institution, Message, ParseMode, User, Vendor
from app.schemas.ai import (
    AcceptSuggestionRequest,
    AISettingsResponse,
    BatchSuggestRequest,
    BatchSuggestResponse,
    CategorySuggestionListResponse,
    CategorySuggestionResponse,
    ChatRequest,
    ChatResponse,
    OllamaStatusResponse,
    ParseModeResponse,
    ParseModeUpdateRequest,
    RejectSuggestionRequest,
    ReparseRequest,
    ReparseResponse,
    SuggestCategoryRequest,
    SuggestionActionResponse,
)
from app.services.categorization import CategorizationService
from app.services.chat import ChatService
from app.services.ollama import get_ollama_service

router = APIRouter()


# === Ollama Status ===


@router.get("/status", response_model=OllamaStatusResponse)
def get_ollama_status(
    current_user: User = Depends(get_current_user),
):
    """Get Ollama connection status."""
    ollama = get_ollama_service()
    status_info = ollama.check_connection()

    return OllamaStatusResponse(
        connected=status_info.get("connected", False),
        configured=ollama.is_configured,
        base_url=ollama.base_url if ollama.is_configured else None,
        model=ollama.model,
        models_available=status_info.get("models", []),
        model_available=status_info.get("model_available", False),
        error=status_info.get("error"),
    )


@router.get("/settings", response_model=AISettingsResponse)
def get_ai_settings(
    current_user: User = Depends(get_current_user),
):
    """Get AI settings."""
    ollama = get_ollama_service()
    status_info = ollama.check_connection()

    return AISettingsResponse(
        ollama_configured=ollama.is_configured,
        ollama_base_url=ollama.base_url if ollama.is_configured else None,
        ollama_model=ollama.model,
        ollama_connected=status_info.get("connected", False),
        available_models=status_info.get("models", []),
    )


# === Category Suggestions ===


@router.get("/suggestions", response_model=CategorySuggestionListResponse)
def list_suggestions(
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List category suggestions."""
    service = CategorizationService(db)

    if status_filter == "pending":
        suggestions, total = service.get_pending_suggestions(limit=limit, offset=offset)
    else:
        from app.db.models import CategorySuggestion

        query = db.query(CategorySuggestion).order_by(CategorySuggestion.created_at.desc())
        if status_filter:
            query = query.filter(CategorySuggestion.status == status_filter)
        total = query.count()
        suggestions = query.offset(offset).limit(limit).all()

    # Build response with vendor and category names
    response_items = []
    for s in suggestions:
        vendor = db.query(Vendor).filter(Vendor.id == s.vendor_id).first()
        category = db.query(Category).filter(Category.id == s.suggested_category_id).first()

        response_items.append(
            CategorySuggestionResponse(
                id=s.id,
                vendor_id=s.vendor_id,
                vendor_name=vendor.canonical_name if vendor else None,
                suggested_category_id=s.suggested_category_id,
                suggested_category_name=category.name if category else None,
                model=s.model,
                confidence=s.confidence,
                rationale=s.rationale,
                status=s.status,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )

    return CategorySuggestionListResponse(suggestions=response_items, total=total)


@router.post("/suggestions/generate", response_model=CategorySuggestionResponse | None)
def generate_suggestion(
    request: SuggestCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a category suggestion for a vendor."""
    # Check vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == request.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    service = CategorizationService(db)
    suggestion = service.suggest_category(request.vendor_id, force=request.force)

    if not suggestion:
        raise HTTPException(
            status_code=503,
            detail="Could not generate suggestion. Check if Ollama is configured and available.",
        )

    category = db.query(Category).filter(Category.id == suggestion.suggested_category_id).first()

    return CategorySuggestionResponse(
        id=suggestion.id,
        vendor_id=suggestion.vendor_id,
        vendor_name=vendor.canonical_name,
        suggested_category_id=suggestion.suggested_category_id,
        suggested_category_name=category.name if category else None,
        model=suggestion.model,
        confidence=suggestion.confidence,
        rationale=suggestion.rationale,
        status=suggestion.status,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )


@router.post("/suggestions/batch", response_model=BatchSuggestResponse)
def batch_generate_suggestions(
    request: BatchSuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate category suggestions for multiple vendors."""
    service = CategorizationService(db)
    stats = service.batch_suggest_categories(
        vendor_ids=request.vendor_ids,
        max_vendors=request.max_vendors,
        process_all=request.process_all,
        concurrency=request.concurrency,
    )

    return BatchSuggestResponse(**stats)


@router.post("/suggestions/{suggestion_id}/accept", response_model=SuggestionActionResponse)
def accept_suggestion(
    suggestion_id: UUID,
    request: AcceptSuggestionRequest = AcceptSuggestionRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a category suggestion."""
    service = CategorizationService(db)
    rule = service.accept_suggestion(suggestion_id, create_rule=request.create_rule)

    if rule is None:
        # Check if suggestion exists
        from app.db.models import CategorySuggestion

        suggestion = (
            db.query(CategorySuggestion).filter(CategorySuggestion.id == suggestion_id).first()
        )
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Suggestion is already {suggestion.status}",
            )

    return SuggestionActionResponse(
        success=True,
        message="Suggestion accepted",
        rule_created=rule is not None and request.create_rule,
    )


@router.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionActionResponse)
def reject_suggestion(
    suggestion_id: UUID,
    request: RejectSuggestionRequest = RejectSuggestionRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a category suggestion."""
    # Validate alternative category if provided
    if request.alternative_category_id:
        category = db.query(Category).filter(Category.id == request.alternative_category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Alternative category not found")

    service = CategorizationService(db)
    success = service.reject_suggestion(
        suggestion_id,
        alternative_category_id=request.alternative_category_id,
    )

    if not success:
        from app.db.models import CategorySuggestion

        suggestion = (
            db.query(CategorySuggestion).filter(CategorySuggestion.id == suggestion_id).first()
        )
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Suggestion is already {suggestion.status}",
            )

    return SuggestionActionResponse(
        success=True,
        message="Suggestion rejected",
        rule_created=request.alternative_category_id is not None,
    )


# === AI Chat ===


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask a question about your spending."""
    service = ChatService(db)

    if not service.is_available():
        return ChatResponse(
            answer="AI chat is not available. Please configure Ollama to use this feature.",
            error="ollama_not_configured",
        )

    history = [
        {"role": m.role, "content": m.content}
        for m in request.conversation_history[-10:]  # Last 5 exchanges max
    ]
    result = service.ask(
        request.question,
        wallet_id=request.wallet_id,
        conversation_history=history if history else None,
    )

    return ChatResponse(
        answer=result.get("answer", ""),
        highlights=result.get("highlights", []),
        chart_type=result.get("chart_type", "none"),
        query_info=result.get("query_info"),
        data=result.get("data"),
        error=result.get("error"),
    )


# === AI Parsing ===


@router.post("/parse/reparse", response_model=ReparseResponse)
def reparse_message(
    request: ReparseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-parse a message using AI."""
    from app.core.encryption import decrypt_body
    from app.services.merge import MergeEngine
    from app.services.parsing import ParsingService
    from app.services.vendor import VendorService

    # Get message
    message = db.query(Message).filter(Message.id == request.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Validate parse mode
    try:
        mode = ParseMode(request.parse_mode)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parse mode: {request.parse_mode}. Must be regex, ollama, or hybrid",
        ) from None

    # Decrypt body
    try:
        body = decrypt_body(message.raw_body_encrypted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt message: {e}") from e

    # Parse
    parsing_service = ParsingService(db)
    parsed, error = parsing_service.parse_message(message, body, mode)

    if not parsed:
        message.parse_status = "failed"
        message.parse_mode = mode
        message.parse_error = error
        db.commit()

        return ReparseResponse(
            success=False,
            message_id=message.id,
            parse_status="failed",
            parse_mode=mode.value,
            error=error,
        )

    # Try to merge
    try:
        vendor_service = VendorService(db)
        merge_engine = MergeEngine(db, vendor_service)
        txn_group = merge_engine.process_parsed_transaction(message, parsed)

        message.parse_status = "success"
        message.parse_mode = mode
        message.parse_error = None
        db.commit()

        return ReparseResponse(
            success=True,
            message_id=message.id,
            parse_status="success",
            parse_mode=mode.value,
            transaction_group_id=txn_group.id if txn_group else None,
        )
    except Exception as e:
        message.parse_status = "needs_review"
        message.parse_mode = mode
        message.parse_error = f"Merge error: {str(e)}"
        db.commit()

        return ReparseResponse(
            success=False,
            message_id=message.id,
            parse_status="needs_review",
            parse_mode=mode.value,
            error=str(e),
        )


@router.post("/parse/mode", response_model=ParseModeResponse)
def update_parse_mode(
    request: ParseModeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update parse mode for an institution."""
    # Get institution
    institution = db.query(Institution).filter(Institution.id == request.institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Validate parse mode
    try:
        mode = ParseMode(request.parse_mode)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parse mode: {request.parse_mode}. Must be regex, ollama, or hybrid",
        ) from None

    # Update
    institution.parse_mode = mode.value
    db.commit()

    return ParseModeResponse(
        institution_id=institution.id,
        institution_name=institution.name,
        parse_mode=institution.parse_mode,
    )


@router.get("/parse/modes")
def list_institution_parse_modes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all institutions with their parse modes."""
    institutions = db.query(Institution).filter(Institution.is_active.is_(True)).all()

    return {
        "institutions": [
            {
                "id": str(i.id),
                "name": i.name,
                "parse_mode": i.parse_mode or "regex",
            }
            for i in institutions
        ]
    }


# === Vendor Categorization Helper ===


@router.post("/categorize/vendor/{vendor_id}", response_model=CategorySuggestionResponse | None)
def categorize_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate category suggestion for a specific vendor."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    service = CategorizationService(db)
    suggestion = service.suggest_category(vendor_id, force=True)

    if not suggestion:
        raise HTTPException(
            status_code=503,
            detail="Could not generate suggestion. Check if Ollama is configured and available.",
        )

    category = db.query(Category).filter(Category.id == suggestion.suggested_category_id).first()

    return CategorySuggestionResponse(
        id=suggestion.id,
        vendor_id=suggestion.vendor_id,
        vendor_name=vendor.canonical_name,
        suggested_category_id=suggestion.suggested_category_id,
        suggested_category_name=category.name if category else None,
        model=suggestion.model,
        confidence=suggestion.confidence,
        rationale=suggestion.rationale,
        status=suggestion.status,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )
