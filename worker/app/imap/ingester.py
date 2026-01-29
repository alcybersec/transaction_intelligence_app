"""IMAP email ingestion worker for Proton Mail Bridge."""

import email
import re
import ssl
import time
from datetime import datetime, timezone
from email.header import decode_header
from email.utils import parsedate_to_datetime
from typing import Any

import redis
import structlog
from imapclient import IMAPClient
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.core.encryption import encrypt_body, hash_body
from app.db.models import Message, MessageSource, ParseStatus
from app.db.session import SessionLocal

logger = structlog.get_logger()

# Keywords to filter banking transaction emails
TRANSACTION_KEYWORDS = [
    "transaction",
    "purchase",
    "payment",
    "credited",
    "debited",
    "card ending",
    "account",
    "transfer",
    "withdrawal",
    "deposit",
    "available balance",
    "avl balance",
    "avl limit",
]

# Known banking senders (case-insensitive patterns)
BANKING_SENDERS = [
    r"mashreq",
    r"neo",
    r"bank",
    r"noreply.*bank",
    r"alerts?@",
    r"notification",
]


class IMAPIngester:
    """
    IMAP email ingestion worker.

    Connects to Proton Mail Bridge via IMAP, monitors Inbox using IDLE,
    and ingests matching banking transaction emails.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        redis_url: str | None = None,
    ):
        self.host = host or settings.imap_host
        self.port = port or settings.imap_port
        self.username = username or settings.imap_user
        self.password = password or settings.imap_password
        self.redis_url = redis_url or settings.redis_url

        self.client: IMAPClient | None = None
        self.redis_client: redis.Redis | None = None
        self._running = False

        # Reconnection backoff settings
        self.initial_backoff = 5  # seconds
        self.max_backoff = 300  # 5 minutes
        self.current_backoff = self.initial_backoff

    def _connect_redis(self) -> None:
        """Connect to Redis for heartbeat tracking."""
        if not self.redis_client:
            self.redis_client = redis.from_url(self.redis_url)

    def _update_heartbeat(self) -> None:
        """Update IMAP worker heartbeat in Redis."""
        try:
            self._connect_redis()
            self.redis_client.set(
                "imap:last_heartbeat",
                datetime.now(timezone.utc).isoformat(),
                ex=600,  # Expire after 10 minutes
            )
        except Exception as e:
            logger.warning("Failed to update heartbeat", error=str(e))

    def connect(self) -> bool:
        """
        Connect to IMAP server.

        Returns:
            True if connection successful, False otherwise
        """
        if not self.username or not self.password:
            logger.warning("IMAP credentials not configured, skipping email ingestion")
            return False

        try:
            logger.info(
                "Connecting to IMAP server",
                host=self.host,
                port=self.port,
                user=self.username,
            )

            # Proton Bridge uses STARTTLS on port 1143 with self-signed cert
            self.client = IMAPClient(self.host, port=self.port, ssl=False)

            # Create SSL context that accepts self-signed certificates
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

            self.client.starttls(ssl_context=ssl_context)
            self.client.login(self.username, self.password)

            logger.info("IMAP connection established")
            self.current_backoff = self.initial_backoff
            return True

        except Exception as e:
            logger.error("Failed to connect to IMAP", error=str(e))
            return False

    def disconnect(self) -> None:
        """Disconnect from IMAP server."""
        if self.client:
            try:
                self.client.logout()
            except Exception:
                pass
            self.client = None

    def _decode_header_value(self, value: Any) -> str:
        """Decode email header value to string."""
        if value is None:
            return ""

        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")

        if isinstance(value, str):
            # Try to decode MIME encoded words
            decoded_parts = decode_header(value)
            result = []
            for part, charset in decoded_parts:
                if isinstance(part, bytes):
                    charset = charset or "utf-8"
                    result.append(part.decode(charset, errors="replace"))
                else:
                    result.append(part)
            return "".join(result)

        return str(value)

    def _get_email_body(self, msg: email.message.Message) -> str:
        """Extract email body as text."""
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
                        break
                elif content_type == "text/html" and not body:
                    # Fallback to HTML if no plain text
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        # Basic HTML stripping
                        html = payload.decode(charset, errors="replace")
                        body = re.sub(r"<[^>]+>", " ", html)
                        body = re.sub(r"\s+", " ", body).strip()
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")

        return body

    def _is_banking_email(self, sender: str, subject: str, body: str) -> bool:
        """Check if email appears to be a banking transaction notification."""
        # Check sender
        sender_lower = sender.lower()
        sender_match = any(re.search(pattern, sender_lower) for pattern in BANKING_SENDERS)

        # Check subject and body for keywords
        text = (subject + " " + body).lower()
        keyword_match = any(kw in text for kw in TRANSACTION_KEYWORDS)

        return sender_match or keyword_match

    def _generate_source_uid(self, uid: int, message_id: str) -> str:
        """Generate unique source_uid from IMAP UID and Message-ID."""
        return f"{uid}:{message_id}"

    def _check_duplicate(self, source_uid: str) -> bool:
        """Check if message already exists."""
        with SessionLocal() as db:
            existing = (
                db.query(Message)
                .filter(
                    Message.source == MessageSource.EMAIL,
                    Message.source_uid == source_uid,
                )
                .first()
            )
            return existing is not None

    def _store_email(
        self,
        source_uid: str,
        sender: str,
        body: str,
        observed_at: datetime,
    ) -> Message | None:
        """Store email as a message in database."""
        with SessionLocal() as db:
            try:
                message = Message(
                    source=MessageSource.EMAIL,
                    source_uid=source_uid,
                    observed_at=observed_at,
                    sender=sender,
                    raw_body_encrypted=encrypt_body(body),
                    raw_body_hash=hash_body(body),
                    parse_status=ParseStatus.PENDING,
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                logger.info(
                    "Stored email message",
                    message_id=str(message.id),
                    sender=sender,
                )
                return message

            except IntegrityError:
                db.rollback()
                logger.debug("Duplicate email skipped", source_uid=source_uid)
                return None

    def process_email(self, uid: int, raw_email: bytes) -> bool:
        """
        Process a single email message.

        Args:
            uid: IMAP message UID
            raw_email: Raw email bytes

        Returns:
            True if email was processed (stored or skipped as non-banking)
        """
        try:
            msg = email.message_from_bytes(raw_email)

            # Extract headers
            sender = self._decode_header_value(msg.get("From", ""))
            subject = self._decode_header_value(msg.get("Subject", ""))
            message_id = self._decode_header_value(msg.get("Message-ID", ""))
            date_str = msg.get("Date", "")

            # Parse date
            try:
                observed_at = parsedate_to_datetime(date_str)
                if observed_at.tzinfo is None:
                    observed_at = observed_at.replace(tzinfo=timezone.utc)
            except Exception:
                observed_at = datetime.now(timezone.utc)

            # Extract body
            body = self._get_email_body(msg)

            # Check if banking email
            if not self._is_banking_email(sender, subject, body):
                logger.debug(
                    "Non-banking email skipped",
                    sender=sender,
                    subject=subject[:50] if subject else "",
                )
                return True

            # Generate source_uid
            source_uid = self._generate_source_uid(uid, message_id or str(uid))

            # Check duplicate
            if self._check_duplicate(source_uid):
                logger.debug("Duplicate email skipped", source_uid=source_uid)
                return True

            # Store email
            self._store_email(source_uid, sender, body, observed_at)
            return True

        except Exception as e:
            logger.error("Failed to process email", uid=uid, error=str(e))
            return False

    def fetch_and_process_new_emails(self) -> int:
        """
        Fetch and process new emails from Inbox.

        Returns:
            Number of emails processed
        """
        if not self.client:
            return 0

        try:
            self.client.select_folder("INBOX")

            # Search for unprocessed emails (last 7 days)
            messages = self.client.search(["SINCE", "1-Jan-2024"])

            if not messages:
                return 0

            # Fetch in batches of 50
            processed = 0
            for i in range(0, len(messages), 50):
                batch = messages[i : i + 50]
                fetched = self.client.fetch(batch, ["RFC822", "INTERNALDATE"])

                for uid, data in fetched.items():
                    raw_email = data.get(b"RFC822")
                    if raw_email and self.process_email(uid, raw_email):
                        processed += 1

            return processed

        except Exception as e:
            logger.error("Failed to fetch emails", error=str(e))
            return 0

    def run_idle_loop(self) -> None:
        """
        Run IMAP IDLE loop for near-real-time email monitoring.

        This method runs indefinitely, using IMAP IDLE to wait for
        new emails with automatic reconnection on failure.
        """
        self._running = True
        logger.info("Starting IMAP IDLE loop")

        while self._running:
            try:
                if not self.client:
                    if not self.connect():
                        logger.warning(
                            "Connection failed, backing off",
                            backoff=self.current_backoff,
                        )
                        time.sleep(self.current_backoff)
                        self.current_backoff = min(self.current_backoff * 2, self.max_backoff)
                        continue

                # Process any existing unread emails
                processed = self.fetch_and_process_new_emails()
                if processed:
                    logger.info("Processed emails on startup", count=processed)

                # Select INBOX for IDLE
                self.client.select_folder("INBOX")

                # Enter IDLE mode
                self.client.idle()
                logger.debug("Entered IDLE mode")

                # Wait for up to 29 minutes (IMAP servers often timeout at 30)
                responses = self.client.idle_check(timeout=1740)

                # Exit IDLE
                self.client.idle_done()

                # Update heartbeat
                self._update_heartbeat()

                # Process new emails if we got a notification
                if responses:
                    logger.debug("IDLE notification received", responses=responses)
                    processed = self.fetch_and_process_new_emails()
                    if processed:
                        logger.info("Processed new emails", count=processed)

                # Reset backoff on successful iteration
                self.current_backoff = self.initial_backoff

            except Exception as e:
                logger.error("IDLE loop error", error=str(e))
                self.disconnect()
                time.sleep(self.current_backoff)
                self.current_backoff = min(self.current_backoff * 2, self.max_backoff)

    def stop(self) -> None:
        """Stop the IDLE loop."""
        self._running = False
        self.disconnect()
