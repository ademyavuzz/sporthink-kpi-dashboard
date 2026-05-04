"""Mail gönderim servisi (Gmail SMTP / aiosmtplib).

Akış:
- `send_email(...)` MIME multipart (text + html) üretir, STARTTLS ile gönderir.
- SMTP yapılandırılmamışsa (`smtp_user` boş) gönderim atlanır ve link log'a
  yazılır — dev modunda mail kutusu olmadan akışı test etmeyi sağlar.
- Hassas başlıklar (link, token) log'a sızdırılmaz; sadece davet/sıfırlama
  event'i ve hedef email loglanır (kullanıcı ID değil — service bilmez).

`docs/overview/05-rbac-security.md` §5.6 — şifre sıfırlama disiplini.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"


def _load_template(name: str) -> str:
    path = _TEMPLATES_DIR / name
    return path.read_text(encoding="utf-8")


def render_template(name: str, **context: str) -> str:
    """Template'i `{variable}` placeholder'ları ile doldurur.

    Jinja2 yerine `str.format_map`: dependency yok, escape gerekmez (URL'ler
    HTML attribute içinde href olarak kullanılır, kullanıcı girdisi yok).
    """
    template = _load_template(name)
    return template.format_map(_SafeFormatDict(context))


class _SafeFormatDict(dict):
    """Eksik anahtarda KeyError yerine boş string döner — template'lerde
    opsiyonel alanların atlanmasını sağlar."""

    def __missing__(self, key: str) -> str:
        return ""


async def send_email(
    *,
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
) -> bool:
    """Tek mail gönderir. SMTP yoksa False döner (sessiz no-op).

    Returns: True ise gönderim başarılı, False ise SMTP yapılandırılmamış.
    Exception ise yukarı raise edilir (Celery retry tetiklesin diye).
    """
    if not settings.smtp_configured:
        logger.warning(
            "smtp_not_configured email_skipped to=%s subject=%s", to, subject
        )
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((settings.mail_from_name, settings.effective_mail_from))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body or _html_to_text_fallback(html_body))
    msg.add_alternative(html_body, subtype="html")

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        start_tls=settings.smtp_use_tls,
        timeout=30,
    )
    logger.info("email_sent to=%s subject=%s", to, subject)
    return True


def _html_to_text_fallback(html: str) -> str:
    """Çok basit HTML → plaintext fallback. Mail client text/plain ister
    diye bir şey gerekiyor; tag'leri çıkar yeter."""
    import re

    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()
