from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/testops_hub"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-change-me-0123456789abcdef"
    access_token_lifetime_seconds: int = 900
    refresh_token_lifetime_seconds: int = 60 * 60 * 24 * 7


@lru_cache
def get_settings() -> Settings:
    return Settings()
