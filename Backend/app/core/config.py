from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgress@localhost:5432/medmove"
    JWT_SECRET_KEY: str = "super-secret-dev-key-change-in-prod"
    JWT_EXPIRES_MINUTES: int = 480
    DEMO_HOSPITAL_JOIN_CODE: str = "medmove-demo-2026"
    COORDINATOR_EMAIL: str = "coordinator@medmove.test"
    COORDINATOR_PASSWORD: str = "coordinator-password"
    DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS: int = 500000
    DEFAULT_PLANNING_DATE: str = "2027-01-15"
    AUTH_COOKIE_NAME: str = "medmove_access_token"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

settings = Settings()