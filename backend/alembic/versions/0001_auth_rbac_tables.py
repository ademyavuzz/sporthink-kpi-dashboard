"""auth and rbac tables

Sprint 2 (`docs/overview/13-project-plan.md` §13.3.2) — kimlik doğrulama ve
yetkilendirme için sistem tabloları.

Kapsam: roles, permissions, users, role_permissions, refresh_tokens,
password_reset_tokens, audit_logs.

Schema kaynağı: `docs/overview/04-data-model.md` §4.5.1–4.5.4, §4.5.9–4.5.11.

Revision ID: 0001
Revises:
Create Date: 2026-05-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MYSQL_TABLE_KWARGS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


def upgrade() -> None:
    # --- roles ---
    op.create_table(
        "roles",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("color", sa.String(7)),
        sa.Column("icon", sa.String(20)),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", mysql.BIGINT(unsigned=True)),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("updated_by", mysql.BIGINT(unsigned=True)),
        sa.Column("deleted_at", sa.DateTime()),
        sa.UniqueConstraint("name", name="uq_roles_name"),
        sa.Index("idx_roles_system", "is_system"),
        sa.Index("idx_roles_deleted", "deleted_at"),
        **MYSQL_TABLE_KWARGS,
    )

    # --- permissions ---
    op.create_table(
        "permissions",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255)),
        sa.Column("category", sa.String(50), nullable=False),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
        sa.Index("idx_permissions_module", "module"),
        sa.Index("idx_permissions_category", "category"),
        **MYSQL_TABLE_KWARGS,
    )

    # --- users (FK to roles; self-FK for created_by/updated_by added after table) ---
    op.create_table(
        "users",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("department", sa.String(100)),
        sa.Column("job_title", sa.String(100)),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("role_id", mysql.BIGINT(unsigned=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("deactivated_reason", sa.String(255)),
        sa.Column("last_login_at", sa.DateTime()),
        sa.Column("last_login_ip", sa.String(45)),
        sa.Column(
            "failed_login_attempts",
            mysql.INTEGER(unsigned=True),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("locked_until", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", mysql.BIGINT(unsigned=True)),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("updated_by", mysql.BIGINT(unsigned=True)),
        sa.Column("deleted_at", sa.DateTime()),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name="fk_users_role", ondelete="RESTRICT", onupdate="CASCADE"
        ),
        sa.Index("idx_users_email", "email"),
        sa.Index("idx_users_role", "role_id"),
        sa.Index("idx_users_active", "is_active"),
        sa.Index("idx_users_deleted", "deleted_at"),
        **MYSQL_TABLE_KWARGS,
    )

    # Self-referencing FKs (use_alter sayesinde ayrı ALTER TABLE ile eklenir).
    op.create_foreign_key(
        "fk_users_created_by",
        "users",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_updated_by",
        "users",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- role_permissions ---
    op.create_table(
        "role_permissions",
        sa.Column("role_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("permission_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column(
            "granted_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column("granted_by", mysql.BIGINT(unsigned=True)),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_rp_role", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], name="fk_rp_permission", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["granted_by"], ["users.id"], name="fk_rp_granted_by", ondelete="SET NULL"
        ),
        sa.Index("idx_rp_role", "role_id"),
        sa.Index("idx_rp_permission", "permission_id"),
        **MYSQL_TABLE_KWARGS,
    )

    # --- refresh_tokens ---
    op.create_table(
        "refresh_tokens",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("device_info", sa.String(500)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column(
            "issued_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime()),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_rt_user", ondelete="CASCADE"),
        sa.Index("idx_rt_user", "user_id"),
        sa.Index("idx_rt_expires", "expires_at"),
        sa.Index("idx_rt_revoked", "revoked_at"),
        **MYSQL_TABLE_KWARGS,
    )

    # --- password_reset_tokens ---
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime()),
        sa.Column("requested_ip", sa.String(45)),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.UniqueConstraint("token_hash", name="uq_prt_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_prt_user", ondelete="CASCADE"),
        sa.Index("idx_prt_user", "user_id"),
        sa.Index("idx_prt_expires", "expires_at"),
        **MYSQL_TABLE_KWARGS,
    )

    # --- audit_logs (FK YOK — kullanıcı silinse de log durur) ---
    op.create_table(
        "audit_logs",
        sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column("user_id", mysql.BIGINT(unsigned=True)),
        sa.Column("user_email", sa.String(255)),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50)),
        sa.Column("resource_id", sa.String(100)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("details", mysql.JSON()),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Index("idx_audit_user", "user_id"),
        sa.Index("idx_audit_action", "action"),
        sa.Index("idx_audit_resource", "resource_type", "resource_id"),
        sa.Index("idx_audit_created", "created_at"),
        **MYSQL_TABLE_KWARGS,
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("password_reset_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("role_permissions")
    op.drop_constraint("fk_users_updated_by", "users", type_="foreignkey")
    op.drop_constraint("fk_users_created_by", "users", type_="foreignkey")
    op.drop_table("users")
    op.drop_table("permissions")
    op.drop_table("roles")
