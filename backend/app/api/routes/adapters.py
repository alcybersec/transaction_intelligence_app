"""API routes for adapter management."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.adapters import get_adapter_registry
from app.api.deps import get_current_user, get_db
from app.db.models import Institution, User
from app.services.parsing import ParsingService

router = APIRouter()


class AdapterInfoResponse(BaseModel):
    """Response model for adapter info."""

    institution_name: str
    display_name: str
    country: str
    version: str
    supported_sources: list[str]
    sms_sender_patterns: list[str]
    email_sender_patterns: list[str]
    parser_count: int
    is_active: bool = True
    description: str = ""


class AdapterListResponse(BaseModel):
    """Response model for adapter list."""

    adapters: list[AdapterInfoResponse]
    total: int


class ParserMetadataResponse(BaseModel):
    """Response model for parser metadata."""

    name: str
    description: str
    message_types: list[str] = []
    version: str = "1.0.0"


class AdapterDetailResponse(AdapterInfoResponse):
    """Detailed adapter response including parser info."""

    parsers: list[ParserMetadataResponse] = []
    ai_parse_prompt_available: bool = False
    ai_categorize_prompt_available: bool = False


class TestPatternRequest(BaseModel):
    """Request model for pattern testing."""

    sender: str = Field(..., description="Sample message sender")
    body: str = Field(..., description="Sample message body")
    source: str = Field(default="sms", description="Message source (sms or email)")


class TestPatternResponse(BaseModel):
    """Response model for pattern test results."""

    adapter_detected: str | None
    institution_name: str | None
    parsers_matched: list[str]
    parse_result: dict[str, Any] | None
    parse_error: str | None


class InstitutionConfigUpdate(BaseModel):
    """Request model for updating institution config."""

    parse_mode: str | None = Field(None, description="Default parsing mode: regex, ollama, hybrid")
    sms_parse_mode: str | None = Field(
        None, description="SMS-specific parsing mode (overrides default)"
    )
    email_parse_mode: str | None = Field(
        None, description="Email-specific parsing mode (overrides default)"
    )
    is_active: bool | None = Field(None, description="Whether institution is active")
    sms_sender_patterns: list[str] | None = Field(None, description="SMS sender patterns")
    email_sender_patterns: list[str] | None = Field(None, description="Email sender patterns")


@router.get("/", response_model=AdapterListResponse)
def list_adapters(
    current_user: User = Depends(get_current_user),
) -> AdapterListResponse:
    """
    List all available bank adapters.

    Returns adapters registered with the system, including both
    active adapters and stub adapters still in development.
    """
    registry = get_adapter_registry()
    adapters = registry.get_all_adapter_info()

    return AdapterListResponse(
        adapters=[AdapterInfoResponse(**adapter.to_dict()) for adapter in adapters],
        total=len(adapters),
    )


@router.get("/{institution_name}", response_model=AdapterDetailResponse)
def get_adapter(
    institution_name: str,
    current_user: User = Depends(get_current_user),
) -> AdapterDetailResponse:
    """
    Get detailed information about a specific adapter.

    Includes parser metadata and configuration options.
    """
    registry = get_adapter_registry()
    adapter = registry.get_adapter(institution_name)

    if not adapter:
        raise HTTPException(
            status_code=404,
            detail=f"Adapter '{institution_name}' not found",
        )

    info = adapter.get_info()
    parser_metadata = adapter.get_parser_metadata()

    return AdapterDetailResponse(
        **info.to_dict(),
        parsers=[
            ParserMetadataResponse(
                name=pm.name,
                description=pm.description,
                message_types=pm.message_types,
                version=pm.version,
            )
            for pm in parser_metadata
        ],
        ai_parse_prompt_available=adapter.ai_parse_prompt_template is not None,
        ai_categorize_prompt_available=adapter.ai_categorize_prompt_template is not None,
    )


@router.get("/{institution_name}/config")
def get_adapter_config(
    institution_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get the current configuration for an adapter from the database.

    Returns the institution record with current settings.
    """
    registry = get_adapter_registry()
    adapter = registry.get_adapter(institution_name)

    if not adapter:
        raise HTTPException(
            status_code=404,
            detail=f"Adapter '{institution_name}' not found",
        )

    # Get institution from database
    institution = db.query(Institution).filter(Institution.name == institution_name).first()

    # Return defaults from adapter if no DB record
    if not institution:
        return {
            "institution_name": institution_name,
            "display_name": adapter.display_name,
            "parse_mode": "regex",
            "sms_parse_mode": None,
            "email_parse_mode": None,
            "is_active": True,
            "sms_sender_patterns": adapter.sms_sender_patterns,
            "email_sender_patterns": adapter.email_sender_patterns,
            "has_db_record": False,
        }

    import json

    return {
        "institution_name": institution.name,
        "display_name": institution.display_name,
        "parse_mode": institution.parse_mode,
        "sms_parse_mode": institution.sms_parse_mode,
        "email_parse_mode": institution.email_parse_mode,
        "is_active": institution.is_active,
        "sms_sender_patterns": (
            json.loads(institution.sms_sender_patterns) if institution.sms_sender_patterns else []
        ),
        "email_sender_patterns": (
            json.loads(institution.email_sender_patterns)
            if institution.email_sender_patterns
            else []
        ),
        "has_db_record": True,
        "created_at": institution.created_at.isoformat() if institution.created_at else None,
        "updated_at": institution.updated_at.isoformat() if institution.updated_at else None,
    }


@router.put("/{institution_name}/config")
def update_adapter_config(
    institution_name: str,
    config: InstitutionConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Update the configuration for an adapter.

    Creates an institution record if one doesn't exist.
    """
    registry = get_adapter_registry()
    adapter = registry.get_adapter(institution_name)

    if not adapter:
        raise HTTPException(
            status_code=404,
            detail=f"Adapter '{institution_name}' not found",
        )

    import json

    # Get or create institution record
    institution = db.query(Institution).filter(Institution.name == institution_name).first()

    if not institution:
        institution = Institution(
            name=institution_name,
            display_name=adapter.display_name,
            parse_mode="regex",
            is_active=True,
            sms_sender_patterns=json.dumps(adapter.sms_sender_patterns),
            email_sender_patterns=json.dumps(adapter.email_sender_patterns),
        )
        db.add(institution)

    # Validate parse modes
    valid_modes = ["regex", "ollama", "hybrid"]

    # Update fields
    if config.parse_mode is not None:
        if config.parse_mode not in valid_modes:
            raise HTTPException(
                status_code=400,
                detail="Invalid parse_mode. Must be: regex, ollama, or hybrid",
            )
        institution.parse_mode = config.parse_mode

    if config.sms_parse_mode is not None:
        if config.sms_parse_mode and config.sms_parse_mode not in valid_modes:
            raise HTTPException(
                status_code=400,
                detail="Invalid sms_parse_mode. Must be: regex, ollama, or hybrid",
            )
        institution.sms_parse_mode = config.sms_parse_mode or None

    if config.email_parse_mode is not None:
        if config.email_parse_mode and config.email_parse_mode not in valid_modes:
            raise HTTPException(
                status_code=400,
                detail="Invalid email_parse_mode. Must be: regex, ollama, or hybrid",
            )
        institution.email_parse_mode = config.email_parse_mode or None

    if config.is_active is not None:
        institution.is_active = config.is_active

    if config.sms_sender_patterns is not None:
        institution.sms_sender_patterns = json.dumps(config.sms_sender_patterns)

    if config.email_sender_patterns is not None:
        institution.email_sender_patterns = json.dumps(config.email_sender_patterns)

    db.commit()
    db.refresh(institution)

    return {
        "success": True,
        "institution_name": institution.name,
        "parse_mode": institution.parse_mode,
        "sms_parse_mode": institution.sms_parse_mode,
        "email_parse_mode": institution.email_parse_mode,
        "is_active": institution.is_active,
    }


@router.post("/test-pattern", response_model=TestPatternResponse)
def test_pattern(
    request: TestPatternRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TestPatternResponse:
    """
    Test which adapter/parser matches a sample message.

    Useful for debugging and verifying adapter configurations.
    """
    parsing_service = ParsingService(db)
    result = parsing_service.test_pattern(
        sender=request.sender,
        body=request.body,
        source=request.source,
    )

    return TestPatternResponse(**result)


@router.get("/{institution_name}/parsers")
def list_adapter_parsers(
    institution_name: str,
    current_user: User = Depends(get_current_user),
) -> list[ParserMetadataResponse]:
    """
    List all parsers for a specific adapter.
    """
    registry = get_adapter_registry()
    adapter = registry.get_adapter(institution_name)

    if not adapter:
        raise HTTPException(
            status_code=404,
            detail=f"Adapter '{institution_name}' not found",
        )

    parser_metadata = adapter.get_parser_metadata()

    return [
        ParserMetadataResponse(
            name=pm.name,
            description=pm.description,
            message_types=pm.message_types,
            version=pm.version,
        )
        for pm in parser_metadata
    ]
