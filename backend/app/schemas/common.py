"""Ortak response zarfı.

Tüm başarılı response'lar `{success: true, data: ...}` formatında döner
(`/CLAUDE.md` §6.1). Hatalı response'lar `SporthinkException.to_response()`
tarafından üretilir.
"""
from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class SuccessEnvelope(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")

    success: Literal[True] = True
    data: T
