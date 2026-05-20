"""User management, audit log, channel mapping, saved view şemaları."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# --- Role / Permission ---


class PermissionItem(BaseModel):
    code: str
    module: str
    action: str
    description: str | None = None
    category: str
    category_label: str


class RoleListItem(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    is_system: bool
    user_count: int
    permission_count: int
    created_at: datetime
    updated_at: datetime


class RoleDetail(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    is_system: bool
    permissions: list[str]
    user_count: int
    created_at: datetime
    updated_at: datetime


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    color: str | None = Field(None, max_length=7)
    icon: str | None = Field(None, max_length=20)
    permissions: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    permissions: list[str] | None = None


# --- User management ---


class RoleSummaryAdmin(BaseModel):
    id: int
    name: str
    is_system: bool
    color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserListItem(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role_id: int
    role: RoleSummaryAdmin | None = None
    is_active: bool
    avatar_url: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    role_id: int


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    role_id: int | None = None
    is_active: bool | None = None


class UserCreateResponse(UserListItem):
    """Yeni kullanıcı oluştuğunda dönen + davet maili durumu.

    Geçici şifre artık üretilmiyor — kullanıcı maildeki linkle kendi
    şifresini belirler.
    """

    invitation_sent: bool = True


class AdminPasswordResetResponse(BaseModel):
    """`POST /users/{id}/reset-password` cevabı.

    Reset linki kullanıcının emailine gönderilir; ekrana şifre düşmez.
    """

    user_id: int
    email: str
    reset_email_sent: bool = True


# --- Audit log ---


class AuditLogItem(BaseModel):
    id: int
    action: str
    user_id: int | None = None
    user_email: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    ip_address: str | None = None
    details: dict[str, Any] | None = None
    created_at: str | None = None


# --- Channel mapping ---


class ChannelMappingItem(BaseModel):
    id: int
    source: str
    medium: str
    channel_group: str
    is_auto_assigned: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChannelMappingCreate(BaseModel):
    source: str = Field(min_length=1, max_length=255)
    medium: str = Field(min_length=1, max_length=100)
    channel_group: str = Field(min_length=1, max_length=100)
    notes: str | None = None


class ChannelMappingUpdate(BaseModel):
    channel_group: str | None = None
    notes: str | None = None


# --- Saved view ---


class SavedViewItem(BaseModel):
    id: int
    page: str
    name: str
    description: str | None = None
    filters: dict[str, Any]
    is_default: bool
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SavedViewCreate(BaseModel):
    page: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    filters: dict[str, Any]
    is_default: bool = False


class SavedViewUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    filters: dict[str, Any] | None = None
    is_default: bool | None = None
