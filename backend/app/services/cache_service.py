"""Redis cache wrapper — uygulama-wide tek erişim noktası.

Kullanım:
    cached = await cache.get_json(key)
    if cached is not None:
        return SomeModel.model_validate(cached)
    result = await compute()
    await cache.set_json(key, result.model_dump(mode='json'), ttl=300)
    return result

Pattern silme (`kpi:*` gibi): `await cache.delete_pattern(...)`. SCAN kullanır,
production'da yüz binlerce key'de bile güvenlidir.

Decorator: `@cache.cached(key_fn, ttl=300)` ile fonksiyon-seviyesi sarmalama.
"""
from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


class _CacheClient:
    """Lazy-init async Redis client (`db 0` = uygulama cache)."""

    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None

    @property
    def client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(
                settings.redis_cache_url,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._client

    async def get_json(self, key: str) -> Any | None:
        """JSON-decoded değer veya None (cache miss / hata)."""
        try:
            raw = await self.client.get(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache_get_error key=%s err=%s", key, exc)
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("cache_decode_error key=%s", key)
            return None

    async def set_json(self, key: str, value: Any, *, ttl: int) -> None:
        """JSON-encoded set + TTL. `value` model_dump(mode='json') olmalı."""
        try:
            await self.client.set(key, json.dumps(value, default=str), ex=ttl)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache_set_error key=%s err=%s", key, exc)

    async def delete(self, key: str) -> None:
        try:
            await self.client.delete(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache_delete_error key=%s err=%s", key, exc)

    async def delete_pattern(self, pattern: str) -> int:
        """SCAN ile pattern eşleşen key'leri sil. Returns silinen sayı."""
        deleted = 0
        try:
            async for key in self.client.scan_iter(match=pattern, count=200):
                await self.client.delete(key)
                deleted += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("cache_scan_error pattern=%s err=%s", pattern, exc)
        return deleted

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


cache = _CacheClient()


# ---- Decorator helper ----

T = TypeVar("T")


def cached_json(
    key_fn: Callable[..., str],
    ttl: int,
    deserialize: Callable[[Any], T] | None = None,
):
    """Fonksiyon sonucunu JSON'a çevirip cache'ler.

    `key_fn(**fn_kwargs)` cache anahtarını üretir.
    `deserialize` cache hit'inde JSON dict'i tipine çevirir (ör Pydantic
    `Model.model_validate`).

    Yazılan değerin `model_dump(mode='json')` veya JSON-serializable olması
    beklenir.
    """

    def decorator(fn: Callable[..., Awaitable[Any]]):
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = key_fn(**kwargs)
            hit = await cache.get_json(key)
            if hit is not None:
                logger.debug("cache_hit key=%s", key)
                return deserialize(hit) if deserialize else hit
            result = await fn(*args, **kwargs)
            payload = (
                result.model_dump(mode="json")
                if hasattr(result, "model_dump")
                else result
            )
            await cache.set_json(key, payload, ttl=ttl)
            return result

        return wrapper

    return decorator
