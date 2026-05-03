"""Tüm Redis cache key formatları tek noktada üretilir.

Endpoint veya service içinde elle string concat YASAK — her zaman bu modül.
Bkz: backend/CLAUDE.md §9.1.
"""


def user_perms(user_id: int) -> str:
    return f"user_perms:{user_id}"


def role_perms(role_id: int) -> str:
    return f"role_perms:{role_id}"


def kpi_summary(filter_hash: str, date_range: str) -> str:
    return f"kpi:summary:{filter_hash}:{date_range}"
