from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_SSL: bool = False
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REQUIRE_EMAIL_VERIFICATION: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    APP_BASE_URL: str = "http://localhost:5173"
    APP_BASE_URL_NL: str = ""
    SMOKETEST_EMAIL: str = ""
    FEEDBACK_EMAIL: str = ""

    CORS_ORIGINS: str = "http://localhost:5173"

    ENABLE_WAITLIST: bool = False
    MAX_ACTIVE_USERS: int = 20

    ENABLE_TEST_RESET: bool = False

    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_RELEASE: str = ""

    model_config = {"extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
