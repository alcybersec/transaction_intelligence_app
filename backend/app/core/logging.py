"""Structured logging configuration using structlog.

Provides consistent JSON logging for production and colored console output for development.

Usage:
    from app.core.logging import get_logger, setup_logging

    # At application startup
    setup_logging()

    # In modules
    logger = get_logger(__name__)
    logger.info("message_processed", message_id=str(msg.id), status="success")
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import Processor

from app.config import settings


def setup_logging(
    log_format: str | None = None,
    log_level: str | None = None,
) -> None:
    """
    Configure structured logging for the application.

    Args:
        log_format: "json" for JSON output, "console" for colored console output.
                   Defaults to LOG_FORMAT env var or "console".
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR).
                   Defaults to LOG_LEVEL env var or "INFO".
    """
    # Get configuration from settings or parameters
    format_type = log_format or getattr(settings, "log_format", "console")
    level_str = log_level or getattr(settings, "log_level", "INFO")
    level = getattr(logging, level_str.upper(), logging.INFO)

    # Shared processors for all output formats
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if format_type == "json":
        # JSON output for production
        processors: list[Processor] = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
        # Configure standard logging to use structlog
        logging.basicConfig(
            format="%(message)s",
            stream=sys.stdout,
            level=level,
        )
    else:
        # Colored console output for development
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.plain_traceback,
            ),
        ]
        logging.basicConfig(
            format="%(message)s",
            stream=sys.stdout,
            level=level,
        )

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging to go through structlog
    # This ensures third-party libraries using stdlib logging also output structured logs
    structlog.configure_once(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Set third-party loggers to WARNING to reduce noise
    for noisy_logger in ["httpx", "httpcore", "urllib3", "sqlalchemy.engine"]:
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name, typically __name__

    Returns:
        Bound structlog logger instance

    Usage:
        logger = get_logger(__name__)
        logger.info("event_name", key="value", count=42)
    """
    return structlog.get_logger(name)


def bind_context(**kwargs: Any) -> None:
    """
    Bind context variables that will be included in all subsequent log messages.

    Useful for request-scoped context like request_id, user_id, etc.

    Args:
        **kwargs: Key-value pairs to bind to context

    Usage:
        bind_context(request_id=str(uuid4()), user_id="123")
        logger.info("processing")  # Will include request_id and user_id
    """
    structlog.contextvars.bind_contextvars(**kwargs)


def clear_context() -> None:
    """Clear all bound context variables."""
    structlog.contextvars.clear_contextvars()
