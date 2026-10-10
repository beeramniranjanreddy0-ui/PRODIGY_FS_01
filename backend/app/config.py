from __future__ import annotations

import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "sqlite:///./app.db"
    TEST_DATABASE_URL: str | None = None
    SECRET_KEY: str = "change-me-to-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]

    @property
    def effective_database_url(self) -> str:
        return os.getenv("TEST_DATABASE_URL") or self.DATABASE_URL


settings = Settings()
