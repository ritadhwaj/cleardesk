from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env file."""

    database_url: str = "postgresql://cleardesk:cleardesk@localhost:5432/cleardesk"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480

    # LLM provider: mock | gemini | ollama | anthropic  (mock = no key needed)
    llm_provider: str = "mock"
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2-vision"

    upload_dir: str = "uploads"
    max_cross_verify_rounds: int = 3
    llm_min_interval_s: float = 6.0  # spacing between LLM calls (free-tier friendly)

    class Config:
        env_file = ".env"


settings = Settings()
