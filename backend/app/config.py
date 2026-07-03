from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://myapp:myapp@localhost:5432/myapp"
    cors_origins: list[str] = ["http://localhost:5173"]
    # front のビルド成果物(dist)のパス。設定すると SPA を同居配信する(本番用)
    static_dir: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
