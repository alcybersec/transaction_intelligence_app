"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://txnuser:txnpass@localhost:5432/txndb"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    encryption_key: str = "dev-encryption-key-change-me"

    # Ingestion
    ingestion_hmac_secret: str = "dev-hmac-secret"

    # Ollama (optional)
    ollama_base_url: str | None = None
    ollama_model: str = "llama3"
    ollama_timeout: float = 180.0  # seconds, increase for slow/remote Ollama
    ollama_num_thread: int | None = None  # CPU threads for inference, None = Ollama default

    # Logging
    log_format: str = "console"  # "json" for production, "console" for development
    log_level: str = "INFO"

    # IP Allowlist (optional security layer)
    allowed_ip_ranges: str | None = None  # e.g., "192.168.1.0/24,100.64.0.0/10"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
