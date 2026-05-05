"""Audit log SQL erişimi.

Sadece `add()` — audit log'lar append-only (hard delete edilmez,
backend/CLAUDE.md §7.3, partition drop ile temizlenir).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def add(
    db: AsyncSession,
    *,
    action: str,
    user_id: int | None,
    user_email: str | None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            action=action,
            user_id=user_id,
            user_email=user_email,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )
    )
    await db.flush()
