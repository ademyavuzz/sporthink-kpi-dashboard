from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedMixin, Base, BigIntPK, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.permission import Permission as PermissionModel
    from app.models.user import User


class Role(Base, AuditedMixin, SoftDeleteMixin):
    __tablename__ = "roles"

    id: Mapped[int] = BigIntPK()

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    users: Mapped[list[User]] = relationship(
        "User",
        back_populates="role",
        foreign_keys="User.role_id",
        lazy="select",
    )

    permissions: Mapped[list[PermissionModel]] = relationship(
        "Permission",
        secondary="role_permissions",
        primaryjoin="Role.id == RolePermission.role_id",
        secondaryjoin="Permission.id == RolePermission.permission_id",
        viewonly=True,
        lazy="select",
    )
