"""Notification API contract (Pydantic).

DB model `app/models/notification.py` ile birebir. Response'lar
PaginatedEnvelope ile birlikte kullanılır.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NotificationTypeLiteral = Literal["info", "success", "warning", "error"]


class NotificationItem(BaseModel):
    """Tek bildirim - frontend NotificationBell + NotificationsPage gösterir."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: NotificationTypeLiteral
    title: str
    message: str | None = None
    link: str | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    """`GET /notifications/unread-count` cevabı - TopBar bell rozeti."""

    count: int = Field(..., ge=0)


class MarkAllReadResponse(BaseModel):
    """`POST /notifications/mark-all-read` cevabı."""

    updated: int = Field(..., ge=0, description="Kaç bildirim güncellendi")
