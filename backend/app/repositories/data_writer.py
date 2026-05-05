"""Generic data writer for import targets.

Tüm kaynak tablolar için aynı 3 operasyon kullanılır:
1. `fetch_pk_map`        — FK lookup (external_id → pk_id)
2. `fetch_existing_keys` — dedup detection
3. `bulk_insert`         — chunked INSERT

Kullanım: `import_service` parser çıktısını alır, FK lookup yapar, dedup
filtrelemesi yapar, bulk insert eder. Tek bir tablo-spesifik kod yazmadan
tüm 4 source aynı pipeline'dan geçer.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import bindparam, insert, text
from sqlalchemy.ext.asyncio import AsyncSession

_BULK_BATCH_SIZE = 500


async def fetch_pk_map(
    db: AsyncSession,
    *,
    table: str,
    pk_column: str,
    lookup_column: str,
    values: list[str],
) -> dict[str, int]:
    """`values` içindeki her external_id için DB'deki PK'yı dict olarak döner.

    Bulunamayan değerler dict'te yer almaz. Çağıran taraf `required` FK ise
    eksikleri hata olarak işaretler.

    Tablo ve kolon adları kod-içi sabitlerden gelir (kullanıcı input'u değil)
    — SQL injection yüzeyi yok.
    """
    if not values:
        return {}
    # IN clause expanding ile parametreli
    stmt = text(
        f"SELECT {lookup_column}, {pk_column} FROM {table} WHERE {lookup_column} IN :vals"
    ).bindparams(bindparam("vals", expanding=True))
    result = await db.execute(stmt, {"vals": list(set(values))})
    return {row[0]: row[1] for row in result.all()}


async def fetch_existing_keys(
    db: AsyncSession,
    *,
    table: str,
    key_columns: list[str],
    batch: list[dict[str, Any]],
) -> set[tuple[Any, ...]]:
    """Verilen satırların dedup anahtarlarına göre DB'de zaten var olanları döner.

    Tek kolonlu key için tuple tek elemanlı: `{("ORD-1",), ("ORD-2",)}`.
    Çok kolonlu key için: `{("ORD-1", 1), ("ORD-1", 2)}`.

    Tablo + kolon adları kod sabitleri.
    """
    if not batch or not key_columns:
        return set()

    # Tek kolon → IN; çok kolon → tuple-IN (MySQL destekler).
    cols_select = ", ".join(key_columns)
    if len(key_columns) == 1:
        col = key_columns[0]
        values = list({row[col] for row in batch if col in row})
        if not values:
            return set()
        stmt = text(f"SELECT {col} FROM {table} WHERE {col} IN :vals").bindparams(
            bindparam("vals", expanding=True)
        )
        result = await db.execute(stmt, {"vals": values})
        return {(r[0],) for r in result.all()}

    # Çok kolonlu — IN ((a, b), (c, d), ...)
    tuples = list(
        {tuple(row[c] for c in key_columns) for row in batch if all(c in row for c in key_columns)}
    )
    if not tuples:
        return set()
    placeholders = ", ".join(
        "(" + ", ".join(f":k{i}_{j}" for j in range(len(key_columns))) + ")"
        for i in range(len(tuples))
    )
    params: dict[str, Any] = {}
    for i, tup in enumerate(tuples):
        for j, val in enumerate(tup):
            params[f"k{i}_{j}"] = val
    stmt = text(f"SELECT {cols_select} FROM {table} WHERE ({cols_select}) IN ({placeholders})")
    result = await db.execute(stmt, params)
    return {tuple(r) for r in result.all()}


async def bulk_insert(
    db: AsyncSession,
    *,
    model: type,
    rows: list[dict[str, Any]],
) -> int:
    """`rows` listesini model'in tablosuna chunked INSERT eder.

    Returns: yazılan satır sayısı.
    """
    if not rows:
        return 0
    inserted = 0
    for start in range(0, len(rows), _BULK_BATCH_SIZE):
        chunk = rows[start : start + _BULK_BATCH_SIZE]
        await db.execute(insert(model), chunk)
        inserted += len(chunk)
    return inserted
