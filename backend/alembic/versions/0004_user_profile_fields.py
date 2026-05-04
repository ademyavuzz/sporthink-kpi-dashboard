"""users tablosuna profil alanları ekle (bio, doğum tarihi, sosyal medya).

Süper Admin / kullanıcılar profil sayfasından kendi bilgilerini daha
zengin doldurabilsin diye 8 yeni opsiyonel alan:
- bio (kısa biyografi, ~280 char)
- birth_date (DATE)
- location (şehir/ülke)
- website_url
- linkedin_url, twitter_url, github_url, instagram_url

Tüm alanlar nullable; mevcut kayıtlar etkilenmez.

Revision ID: 0004_user_profile_fields
Revises: 0003_password_reset_purpose
Create Date: 2026-05-04
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_user_profile_fields"
down_revision = "0003_password_reset_purpose"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("website_url", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("linkedin_url", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("twitter_url", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("github_url", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("instagram_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "instagram_url")
    op.drop_column("users", "github_url")
    op.drop_column("users", "twitter_url")
    op.drop_column("users", "linkedin_url")
    op.drop_column("users", "website_url")
    op.drop_column("users", "location")
    op.drop_column("users", "birth_date")
    op.drop_column("users", "bio")
