from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
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
    SMOKETEST_EMAIL: str = ""

    model_config = {"extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
