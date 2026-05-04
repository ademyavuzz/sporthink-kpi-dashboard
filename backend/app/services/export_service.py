"""Dashboard verisini CSV/JSON/XLSX olarak export.

`StreamingResponse` ile büyük tablolar (10k+ satır) ram'i şişirmeden döner.
"""
from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterable
from typing import Any, Literal

ExportFormat = Literal["csv", "json", "xlsx"]


def to_csv(rows: Iterable[dict[str, Any]], headers: list[str] | None = None) -> bytes:
    """UTF-8 BOM ile CSV (Excel uyumlu)."""
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer)
    rows_list = list(rows)
    if not rows_list:
        return buffer.getvalue().encode("utf-8")
    cols = headers or list(rows_list[0].keys())
    writer.writerow(cols)
    for row in rows_list:
        writer.writerow([row.get(c, "") for c in cols])
    return buffer.getvalue().encode("utf-8")


def to_json(rows: Iterable[dict[str, Any]]) -> bytes:
    rows_list = list(rows)
    return json.dumps(rows_list, ensure_ascii=False, default=str, indent=2).encode("utf-8")


def to_xlsx(rows: Iterable[dict[str, Any]], sheet_name: str = "Data") -> bytes:
    """openpyxl ile XLSX. Büyük tablolar için CSV daha verimli."""
    try:
        from openpyxl import Workbook
    except ImportError:
        # Optional dep — değilse CSV fallback
        return to_csv(rows)

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    rows_list = list(rows)
    if rows_list:
        cols = list(rows_list[0].keys())
        ws.append(cols)
        for row in rows_list:
            ws.append([row.get(c) for c in cols])
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def encode(rows: Iterable[dict[str, Any]], fmt: ExportFormat) -> tuple[bytes, str]:
    """Format'a göre encode + content-type döner."""
    if fmt == "json":
        return to_json(rows), "application/json"
    if fmt == "xlsx":
        return to_xlsx(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return to_csv(rows), "text/csv; charset=utf-8"
