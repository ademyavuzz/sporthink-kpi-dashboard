"""Profil avatar yönetimi: yükleme, resize, silme.

Akış:
- Kullanıcı multipart `image/*` upload eder
- Pillow ile open + EXIF rotation correction
- 256x256 center-crop + WebP'ye dönüş (yer/bandwidth tasarrufu)
- Disk: `{settings.upload_dir}/avatars/<user_id>.webp`
- DB: `users.avatar_url = "/uploads/avatars/<user_id>.webp?v=<unix>"`
  (cache busting; frontend img cache'ini kırmak için)

Güvenlik:
- Format whitelist (PNG/JPG/JPEG/WEBP) — magic byte ile Pillow doğrular
- Boyut limiti `MAX_BYTES` (2MB)
- Filename kullanıcıdan alınmaz; deterministik `<user_id>.webp`
- Directory traversal imkansız (filename hard-coded)
"""
from __future__ import annotations

import io
import logging
import time
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

ACCEPTED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_BYTES = 2 * 1024 * 1024  # 2MB
TARGET_SIZE = 256


def _avatar_dir() -> Path:
    return Path(settings.upload_dir) / "avatars"


def _avatar_path(user_id: int) -> Path:
    return _avatar_dir() / f"{user_id}.webp"


def save_avatar(user_id: int, *, content: bytes, content_type: str | None) -> str:
    """Yüklenen byte'ları doğrular, resize + WebP yazar, public URL döner.

    Returns: `/uploads/avatars/<user_id>.webp?v=<ts>` (relative path).
    """
    if content_type and content_type.lower() not in ACCEPTED_TYPES:
        raise ValidationError(
            "Unsupported image format. Use PNG, JPG, or WEBP.",
            field="file",
            params={"accepted": list(ACCEPTED_TYPES)},
        )
    if len(content) > MAX_BYTES:
        raise ValidationError(
            "Image is too large (max 2 MB).",
            field="file",
            params={"max_bytes": MAX_BYTES},
        )

    try:
        img = Image.open(io.BytesIO(content))
    except UnidentifiedImageError as exc:
        raise ValidationError("Invalid image file", field="file") from exc

    img = ImageOps.exif_transpose(img)  # iPhone/Android rotated images fix
    img = img.convert("RGBA")

    # Center crop to square then resize
    short_side = min(img.size)
    left = (img.size[0] - short_side) // 2
    top = (img.size[1] - short_side) // 2
    img = img.crop((left, top, left + short_side, top + short_side))
    img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)

    _avatar_dir().mkdir(parents=True, exist_ok=True)
    out_path = _avatar_path(user_id)
    img.save(out_path, "WEBP", quality=88, method=6)
    logger.info("avatar_saved user_id=%d size=%d", user_id, out_path.stat().st_size)

    # Cache busting query string
    return f"/uploads/avatars/{user_id}.webp?v={int(time.time())}"


def delete_avatar(user_id: int) -> None:
    path = _avatar_path(user_id)
    if path.exists():
        try:
            path.unlink()
            logger.info("avatar_deleted user_id=%d", user_id)
        except OSError as exc:
            logger.warning("avatar_delete_failed user_id=%d err=%s", user_id, exc)
