from enum import StrEnum


class Permission(StrEnum):
    """37 granüler izin — `docs/overview/05-rbac-security.md` §5.5.4 referans.

    Yeni izin eklenirken aynı PR'da:
    1. Buraya enum eklenir.
    2. `docs/overview/05-rbac-security.md` güncellenir.
    3. Migration ile `permissions` tablosuna seed edilir.
    """

    # NOTE: 37 izin Sprint 3'te (`docs/overview/13-project-plan.md` §13.3.3) seed edilir.
    # Bu enum şu anda placeholder. Tam liste eklendiğinde alfabetik gruplanır:
    #   USERS_*, ROLES_*, IMPORTS_*, KPI_*, FILTERS_*, SEGMENTS_*, EXPORT_*,
    #   AUDIT_*, SETTINGS_*, DASHBOARD_*
    pass
