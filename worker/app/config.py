"""Worker configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://txnuser:txnpass@localhost:5432/txndb"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    encryption_key: str = "dev-encryption-key-change-me"

    # IMAP (Proton Mail Bridge)
    imap_host: str = "host.docker.internal"
    imap_port: int = 1143
    imap_user: str = ""
    imap_password: str = ""

    # Ollama (optional)
    ollama_base_url: str | None = None
    ollama_model: str = "llama3"

    # API for internal calls (parsing trigger)
    api_port: int = 8001

    @property
    def api_url(self) -> str:
        return f"http://127.0.0.1:{self.api_port}"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
