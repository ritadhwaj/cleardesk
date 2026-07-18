from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env file."""

    database_url: str = "postgresql://cleardesk:cleardesk@localhost:5432/cleardesk"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480

    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    upload_dir: str = "uploads"
    max_cross_verify_rounds: int = 3

    class Config:
        env_file = ".env"


settings = Settings()
