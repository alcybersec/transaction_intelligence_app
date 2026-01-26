"""Worker entry point - handles background jobs and IMAP ingestion."""

import signal
import sys
import threading
import time

import structlog
from redis import Redis
from rq import Worker

from app.config import settings
from app.imap import IMAPIngester

logger = structlog.get_logger()

# Global references for signal handling
_imap_ingester: IMAPIngester | None = None
_rq_worker: Worker | None = None
_shutdown_event = threading.Event()


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info("Shutdown signal received", signal=signum)
    _shutdown_event.set()

    if _imap_ingester:
        _imap_ingester.stop()

    if _rq_worker:
        _rq_worker.request_stop(signum, frame)


def run_imap_ingester():
    """Run IMAP ingester in a separate thread."""
    global _imap_ingester

    # Check if IMAP is configured
    if not settings.imap_user or not settings.imap_password:
        logger.info(
            "IMAP credentials not configured, email ingestion disabled. "
            "Set IMAP_USER and IMAP_PASSWORD to enable."
        )
        return

    logger.info("Starting IMAP ingester thread")
    _imap_ingester = IMAPIngester()

    try:
        _imap_ingester.run_idle_loop()
    except Exception as e:
        logger.error("IMAP ingester crashed", error=str(e))
    finally:
        logger.info("IMAP ingester thread stopped")


def run_rq_worker():
    """Run RQ worker for background jobs."""
    global _rq_worker

    logger.info("Starting RQ worker")
    redis_conn = Redis.from_url(settings.redis_url)
    _rq_worker = Worker(["default"], connection=redis_conn)

    try:
        _rq_worker.work(with_scheduler=True)
    except Exception as e:
        logger.error("RQ worker crashed", error=str(e))
    finally:
        logger.info("RQ worker stopped")


def main():
    """Start the worker process with both RQ and IMAP ingestion."""
    logger.info(
        "Starting worker",
        redis_url=settings.redis_url,
        imap_host=settings.imap_host,
        imap_user=settings.imap_user or "(not configured)",
    )

    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Start IMAP ingester in a separate thread
    imap_thread = threading.Thread(target=run_imap_ingester, daemon=True)
    imap_thread.start()

    # Run RQ worker in main thread
    run_rq_worker()

    # Wait for shutdown
    if _shutdown_event.is_set():
        logger.info("Worker shutdown complete")
    else:
        # If RQ worker exits unexpectedly, signal IMAP to stop too
        _shutdown_event.set()
        if _imap_ingester:
            _imap_ingester.stop()
        imap_thread.join(timeout=5)


if __name__ == "__main__":
    main()
