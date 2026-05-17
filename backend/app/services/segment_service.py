"""Segment hesaplama + RFM scoring.

`docs/09` §9.7.3 — Recency, Frequency, Monetary skorlaması NTILE(5) ile
yapılır. Hazır segmentler: Champions (R5,F4-5,M4-5), Loyal (F4-5),
At Risk (R1-2,F3-5,M3-5), Lost (R1, F1-2, M1-2), New (F1).

Visual segment rule builder JSON şeması:
    {"op": "AND", "rules": [
        {"field": "total_revenue", "op": ">=", "value": 5000},
        {"field": "city", "op": "IN", "value": ["Istanbul", "Izmir"]},
        {"op": "OR", "rules": [...]}
    ]}
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError, ValidationError
from app.models import Customer, Segment

logger = logging.getLogger(__name__)


# Rule field → ORM column whitelist (SQL injection koruması)
_FIELD_MAP: dict[str, Any] = {
    "total_revenue": Customer.total_revenue,
    "total_orders": Customer.total_orders,
    "city": Customer.city,
    "gender": Customer.gender,
    "age_group": Customer.age_group,
    "registration_source": Customer.registration_source,
    "is_newsletter_subscriber": Customer.is_newsletter_subscriber,
}


def _build_rule_clause(rule: dict[str, Any]) -> Any:
    """Recursive: bir rule node'unu SQLAlchemy clause'a çevirir."""
    if "op" in rule and rule["op"] in ("AND", "OR") and "rules" in rule:
        clauses = [_build_rule_clause(r) for r in rule["rules"]]
        return and_(*clauses) if rule["op"] == "AND" else or_(*clauses)

    field_name = rule.get("field")
    if field_name not in _FIELD_MAP:
        raise ValidationError(f"Unknown segment field: {field_name}", field="rules")
    col = _FIELD_MAP[field_name]
    op = rule.get("op", "==")
    value = rule.get("value")

    match op:
        case "==" | "=":
            return col == value
        case "!=" | "<>":
            return col != value
        case ">":
            return col > value
        case ">=":
            return col >= value
        case "<":
            return col < value
        case "<=":
            return col <= value
        case "IN":
            return col.in_(value or [])
        case "NOT IN":
            return col.notin_(value or [])
        case "LIKE":
            return col.like(f"%{value}%")
        case _:
            raise ValidationError(f"Unknown segment operator: {op}", field="rules")


async def evaluate_count(db: AsyncSession, rules: dict[str, Any]) -> int:
    """Segment kurallarını eval edip eşleşen müşteri sayısını döner."""
    clause = _build_rule_clause(rules)
    from sqlalchemy import func

    stmt = select(func.count(Customer.id)).where(and_(Customer.deleted_at.is_(None), clause))
    return int((await db.execute(stmt)).scalar_one())


async def list_customers(
    db: AsyncSession, rules: dict[str, Any], *, limit: int = 100
) -> list[Customer]:
    """Segment kurallarına uyan müşterileri listele."""
    clause = _build_rule_clause(rules)
    stmt = (
        select(Customer)
        .where(and_(Customer.deleted_at.is_(None), clause))
        .order_by(Customer.total_revenue.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def update_cached_count(db: AsyncSession, segment_id: int) -> int:
    """Segment'in cached_count'unu güncelleyip yeni değeri döner."""
    seg = await db.get(Segment, segment_id)
    if seg is None:
        raise ValueError(f"Segment {segment_id} not found")
    count = await evaluate_count(db, seg.rules)
    seg.cached_count = count
    seg.cached_at = datetime.now(UTC)
    await db.flush()
    await db.commit()
    return count


# --------------------- CRUD ---------------------


async def list_for_user(db: AsyncSession, *, user_id: int) -> list[Segment]:
    """Kullanıcının kendi + paylaşılmış segmentlerini listele."""
    stmt = (
        select(Segment)
        .where(
            Segment.deleted_at.is_(None),
            (Segment.user_id == user_id) | (Segment.is_shared.is_(True)),
        )
        .order_by(Segment.id.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_segment(db: AsyncSession, segment_id: int) -> Segment:
    """Aktif (soft-deleted olmayan) segment kaydını getir, yoksa 404."""
    seg = await db.get(Segment, segment_id)
    if seg is None or seg.deleted_at is not None:
        raise ResourceNotFoundError(params={"segment_id": segment_id})
    return seg


async def create_segment(
    db: AsyncSession,
    *,
    user_id: int,
    name: str,
    description: str | None,
    rules: dict[str, Any],
    is_shared: bool,
) -> Segment:
    """Segment yaratır; count cache evaluation fail olursa segment yine de
    yaratılır (count sonradan job ile güncellenir), ama `ValidationError`
    raise edilirse kullanıcının kural düzeltmesi gerekir."""
    seg = Segment(
        user_id=user_id,
        name=name,
        description=description,
        rules=rules,
        is_shared=is_shared,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(seg)
    await db.flush()
    try:
        seg.cached_count = await evaluate_count(db, rules)
        seg.cached_at = datetime.now(UTC)
    except ValidationError:
        raise
    except Exception:  # noqa: BLE001
        logger.warning(
            "segment_count_evaluation_failed",
            extra={"rules_keys": list(rules.keys()) if rules else []},
            exc_info=True,
        )
        seg.cached_count = None
    await db.commit()
    await db.refresh(seg)
    return seg


async def update_segment(
    db: AsyncSession,
    segment_id: int,
    *,
    actor_id: int,
    name: str | None,
    description: str | None,
    rules: dict[str, Any] | None,
    is_shared: bool | None,
) -> Segment:
    seg = await get_segment(db, segment_id)
    if name is not None:
        seg.name = name
    if description is not None:
        seg.description = description
    if rules is not None:
        seg.rules = rules
        seg.cached_count = await evaluate_count(db, rules)
        seg.cached_at = datetime.now(UTC)
    if is_shared is not None:
        seg.is_shared = is_shared
    seg.updated_by = actor_id
    await db.commit()
    await db.refresh(seg)
    return seg


async def soft_delete_segment(db: AsyncSession, segment_id: int) -> None:
    seg = await get_segment(db, segment_id)
    seg.deleted_at = datetime.now(UTC)
    await db.commit()


# --------------------- RFM ---------------------


async def rfm_table(
    db: AsyncSession, *, reference_date: date | None = None
) -> list[dict[str, Any]]:
    """Tüm müşteriler için RFM skoru (R/F/M 1-5 NTILE) ve segment etiketi.

    Çok büyük müşteri tabanları için (1M+) bu sorgu Celery task'a taşınmalı;
    şu an demo için doğrudan async route'tan çağrılıyor.
    """
    ref = reference_date or date.today()
    stmt = text(
        """
        WITH base AS (
            SELECT
                id AS customer_pk_id,
                customer_id,
                customer_name,
                city,
                DATEDIFF(:ref, last_order_date) AS recency_days,
                total_orders AS frequency,
                total_revenue AS monetary
            FROM customers
            WHERE deleted_at IS NULL AND last_order_date IS NOT NULL
        ),
        scored AS (
            SELECT
                customer_pk_id, customer_id, customer_name, city,
                recency_days, frequency, monetary,
                NTILE(5) OVER (ORDER BY recency_days ASC) AS r_score,
                NTILE(5) OVER (ORDER BY frequency DESC)   AS f_score,
                NTILE(5) OVER (ORDER BY monetary DESC)    AS m_score
            FROM base
        )
        SELECT * FROM scored ORDER BY monetary DESC LIMIT 1000
        """
    )
    rows = (await db.execute(stmt, {"ref": ref})).all()
    out: list[dict[str, Any]] = []
    for r in rows:
        rfm_label = _rfm_segment_label(int(r.r_score), int(r.f_score), int(r.m_score))
        out.append(
            {
                "customer_pk_id": int(r.customer_pk_id),
                "customer_id": r.customer_id,
                "customer_name": r.customer_name,
                "city": r.city,
                "recency_days": int(r.recency_days),
                "frequency": int(r.frequency),
                "monetary": str(r.monetary),
                "r_score": int(r.r_score),
                "f_score": int(r.f_score),
                "m_score": int(r.m_score),
                "segment": rfm_label,
            }
        )
    return out


def _rfm_segment_label(r: int, f: int, m: int) -> str:
    """`docs/09` §9.7.3 etiket map.

    Sıralama spesifikten genele: 'At Risk' (R düşük, F yüksek = uzun süredir
    alışveriş yapmıyor ama eskiden değerliydi) Loyal'dan ÖNCE kontrol edilmeli.
    Aksi takdirde müşteri kaybı sinyali kaçar.
    """
    if r >= 4 and f >= 4 and m >= 4:
        return "Champions"
    if r == 1 and f <= 2 and m <= 2:
        return "Lost"
    if r <= 2 and f >= 3 and m >= 3:
        return "At Risk"
    if f >= 4 and m >= 3:
        return "Loyal"
    if f == 1 and r >= 4:
        return "New"
    if r >= 3 and f >= 2 and m >= 3:
        return "Potential Loyalist"
    return "Other"


async def rfm_distribution(
    db: AsyncSession, *, reference_date: date | None = None
) -> dict[str, int]:
    """Hazır segmentlerin müşteri sayısı dağılımı."""
    rows = await rfm_table(db, reference_date=reference_date)
    out: dict[str, int] = {}
    for r in rows:
        seg = r["segment"]
        out[seg] = out.get(seg, 0) + 1
    return out
