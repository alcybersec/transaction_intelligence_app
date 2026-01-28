"""Prometheus metrics for the Transaction Intelligence App.

This module provides centralized metrics collection using prometheus-client.
All metrics are exposed at the /metrics endpoint in Prometheus format.
"""

from prometheus_client import Counter, Gauge, Histogram, Info, REGISTRY, generate_latest, CONTENT_TYPE_LATEST

# Application info
app_info = Info("txn_app", "Transaction Intelligence App information")
app_info.info({
    "version": "0.1.0",
    "service": "api",
})

# Ingestion metrics
messages_ingested_total = Counter(
    "txn_messages_ingested_total",
    "Total number of messages ingested",
    ["source", "status"],  # source: sms/email, status: accepted/duplicate/failed
)

messages_parse_total = Counter(
    "txn_messages_parse_total",
    "Total number of messages parsed",
    ["mode", "status", "institution"],  # mode: regex/ollama/hybrid, status: success/failed/needs_review
)

transactions_created_total = Counter(
    "txn_transactions_created_total",
    "Total number of transaction groups created",
    ["direction", "institution"],  # direction: debit/credit
)

transactions_merged_total = Counter(
    "txn_transactions_merged_total",
    "Total number of messages merged into existing transactions",
)

# Processing metrics
parse_duration_seconds = Histogram(
    "txn_parse_duration_seconds",
    "Time spent parsing messages",
    ["mode"],  # regex/ollama/hybrid
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

merge_duration_seconds = Histogram(
    "txn_merge_duration_seconds",
    "Time spent in merge operations",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0),
)

# API metrics
http_requests_total = Counter(
    "txn_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "txn_http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

# Database metrics
db_query_duration_seconds = Histogram(
    "txn_db_query_duration_seconds",
    "Database query duration",
    ["operation"],  # select/insert/update/delete
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0),
)

# Queue metrics
review_queue_size = Gauge(
    "txn_review_queue_size",
    "Number of messages in review queue",
    ["status"],  # failed/needs_review
)

pending_messages = Gauge(
    "txn_pending_messages",
    "Number of messages pending parsing",
)

# Wallet metrics
wallet_balance = Gauge(
    "txn_wallet_balance",
    "Current wallet balance",
    ["wallet_id", "wallet_name", "currency"],
)

# IMAP worker metrics
imap_worker_connected = Gauge(
    "txn_imap_worker_connected",
    "IMAP worker connection status (1=connected, 0=disconnected)",
)

imap_emails_processed_total = Counter(
    "txn_imap_emails_processed_total",
    "Total emails processed by IMAP worker",
    ["status"],  # processed/skipped/failed
)

# AI metrics (when using Ollama)
ai_requests_total = Counter(
    "txn_ai_requests_total",
    "Total AI/Ollama requests",
    ["operation", "status"],  # operation: parse/categorize/chat, status: success/failed
)

ai_request_duration_seconds = Histogram(
    "txn_ai_request_duration_seconds",
    "AI request duration",
    ["operation"],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

# Admin operation metrics
admin_reparse_total = Counter(
    "txn_admin_reparse_total",
    "Total admin re-parse operations",
    ["status"],  # success/failed
)

admin_remerge_total = Counter(
    "txn_admin_remerge_total",
    "Total admin re-merge operations",
    ["status"],  # success/failed
)

backup_last_success_timestamp = Gauge(
    "txn_backup_last_success_timestamp",
    "Timestamp of last successful backup",
)


def get_metrics() -> bytes:
    """Generate Prometheus metrics in text format."""
    return generate_latest(REGISTRY)


def get_content_type() -> str:
    """Get the content type for Prometheus metrics."""
    return CONTENT_TYPE_LATEST
