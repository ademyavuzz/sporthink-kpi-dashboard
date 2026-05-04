from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"

    database_url: str = Field(
        default="mysql+aiomysql://sporthink:sporthink_dev_pw@localhost:3306/sporthink_dashboard"
    )

    redis_cache_url: str = Field(default="redis://localhost:6379/0")
    redis_broker_url: str = Field(default="redis://localhost:6379/1")

    jwt_secret_key: str = Field(
        default="dev-secret-change-in-production-this-must-be-at-least-64-characters-long",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    frontend_origin: str = "http://localhost:5173"

    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@sporthink.local"

    super_admin_email: str = "admin@sporthink.local"
    super_admin_password: str = "ChangeMe!1234567890"

    # Import sistemi — dosya kalıcılığı ve dev seed klasörü
    upload_dir: str = "/var/sporthink/uploads"
    seed_data_dir: str = "/seed_data"
    import_max_file_size_mb: int = 50

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
