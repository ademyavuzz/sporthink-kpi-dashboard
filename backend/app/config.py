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

    # --- E-posta (Gmail SMTP) ---
    # Gmail uygulama şifresi (app password): https://myaccount.google.com/apppasswords
    # Production'da kişisel hesap yerine domain SMTP'si kullanılması önerilir;
    # Gmail SMTP'nin günlük relay limiti ~500 mail/gün'dür.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    mail_from: str = ""  # Boş ise smtp_user kullanılır (Gmail relay zorunluluğu)
    mail_from_name: str = "Sporthink Dashboard"

    # Davet ve şifre sıfırlama token süreleri
    invite_token_expire_hours: int = 168  # 7 gün
    reset_token_expire_minutes: int = 60  # 1 saat

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

    @property
    def effective_mail_from(self) -> str:
        """Gmail SMTP'de From adresi SMTP user ile aynı olmalıdır.

        Boş bırakılırsa user'a düşer; aksi takdirde elle override edilen
        adres dönülür.
        """
        return self.mail_from or self.smtp_user

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_user and self.smtp_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
