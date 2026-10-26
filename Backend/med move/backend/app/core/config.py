from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgress@localhost:5432/medmove"
    JWT_SECRET_KEY: str = "super-secret-dev-key-change-in-prod"
    JWT_EXPIRES_MINUTES: int = 480
    DEMO_HOSPITAL_JOIN_CODE: str = "medmove-demo-2026"
    COORDINATOR_EMAIL: str = "coordinator@medmove.test"
    COORDINATOR_PASSWORD: str = "coordinator-password"
    DEFAULT_OPTIMIZATION_BUDGET_MINOR_UNITS: int = 500000
    DEFAULT_PLANNING_DATE: str = "2026-10-24"

settings = Settings()