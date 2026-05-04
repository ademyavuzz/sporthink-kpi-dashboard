"""Mail gönderim Celery task'ları.

Davet ve şifre sıfırlama mailleri arka planda gönderilir; request akışını
SMTP gecikmesi (1-3sn) bekletmez. SMTP hatası olduğunda otomatik retry
(60sn aralıkla, max 3 deneme).

Task'lar idempotent: aynı task tekrar tetiklenirse aynı mail tekrar
gönderilebilir; yan etki yoktur.
"""
from __future__ import annotations

import asyncio
import logging

import aiosmtplib

from app.celery_app import celery_app
from app.services import mail_service

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Sync Celery worker → async coroutine köprüsü."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("loop closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(
    bind=True,
    name="email.send_invitation",
    autoretry_for=(aiosmtplib.SMTPException, ConnectionError, TimeoutError),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    acks_late=True,
)
def send_invitation_email(
    self,
    *,
    user_email: str,
    first_name: str,
    inviter_name: str,
    role_name: str,
    action_url: str,
    expires_in: str,
    lang: str = "tr",
) -> dict:
    template_name = "invite_tr.html" if lang == "tr" else "invite_en.html"
    subject = (
        f"{inviter_name} sizi Sporthink Dashboard'a davet ediyor"
        if lang == "tr"
        else f"{inviter_name} invited you to Sporthink Dashboard"
    )
    html = mail_service.render_template(
        template_name,
        first_name=first_name,
        inviter_name=inviter_name,
        role_name=role_name,
        action_url=action_url,
        expires_in=expires_in,
    )
    sent = _run_async(
        mail_service.send_email(to=user_email, subject=subject, html_body=html)
    )
    return {"sent": sent, "to": user_email, "type": "invitation"}


@celery_app.task(
    bind=True,
    name="email.send_password_reset",
    autoretry_for=(aiosmtplib.SMTPException, ConnectionError, TimeoutError),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    acks_late=True,
)
def send_password_reset_email(
    self,
    *,
    user_email: str,
    first_name: str,
    action_url: str,
    expires_in: str,
    lang: str = "tr",
) -> dict:
    template_name = "reset_tr.html" if lang == "tr" else "reset_en.html"
    subject = (
        "Sporthink Dashboard şifrenizi sıfırlayın"
        if lang == "tr"
        else "Reset your Sporthink Dashboard password"
    )
    html = mail_service.render_template(
        template_name,
        first_name=first_name,
        action_url=action_url,
        expires_in=expires_in,
    )
    sent = _run_async(
        mail_service.send_email(to=user_email, subject=subject, html_body=html)
    )
    return {"sent": sent, "to": user_email, "type": "password_reset"}
