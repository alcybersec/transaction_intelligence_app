"""Worker entry point - handles background jobs and IMAP ingestion."""

import structlog
from redis import Redis
from rq import Worker

from app.config import settings

logger = structlog.get_logger()


def main():
    """Start the worker process."""
    logger.info("Starting worker", redis_url=settings.redis_url)

    redis_conn = Redis.from_url(settings.redis_url)

    # Create worker listening on default queue
    worker = Worker(["default"], connection=redis_conn)

    logger.info("Worker ready, listening for jobs...")
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
