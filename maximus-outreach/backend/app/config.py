from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/maximus_outreach"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    JWT_SECRET: str = "change-this-to-a-random-64-character-string-before-production"
    ENCRYPTION_KEY: str = ""
    JWT_EXPIRE_HOURS: int = 24

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Environment
    ENV: str = "development"
    LOG_LEVEL: str = "info"

    # File uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Email tracking
    TRACKING_BASE_URL: str = "http://localhost:8000"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        return v

    def get_cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
