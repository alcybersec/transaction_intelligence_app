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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
