from enum import StrEnum


class Permission(StrEnum):
    """40 granüler izin — `docs/overview/05-rbac-security.md` §5.5.4 referans.

    DB'deki `permissions` tablosu ile birebir uyumlu. `app/seed.py` her boot'ta
    enum ile DB tablosunu senkronize eder (eksik izin eklenir, fazla izin uyarılır).

    Yeni izin eklenirken aynı PR'da:
    1. Buraya enum eklenir.
    2. `docs/overview/05-rbac-security.md` §5.5.4 güncellenir.
    3. Seed komutu çalıştırılır → `permissions` tablosu güncellenir.
    """

    # --- Kategori 1: Veri Görüntüleme (9 izin) ---
    DASHBOARD_VIEW = "dashboard.view"
    TRAFFIC_VIEW = "traffic.view"
    META_ADS_VIEW = "meta_ads.view"
    GOOGLE_ADS_VIEW = "google_ads.view"
    ECOMMERCE_VIEW = "ecommerce.view"
    CAMPAIGNS_VIEW = "campaigns.view"
    FUNNEL_VIEW = "funnel.view"
    COHORT_VIEW = "cohort.view"
    PRODUCTS_VIEW = "products.view"

    # --- Kategori 2: Veri İşlemleri (17 izin) ---
    IMPORTS_VIEW = "imports.view"
    IMPORTS_CREATE = "imports.create"
    IMPORTS_DELETE = "imports.delete"
    MAPPINGS_VIEW = "mappings.view"
    MAPPINGS_CREATE = "mappings.create"
    MAPPINGS_UPDATE = "mappings.update"
    MAPPINGS_DELETE = "mappings.delete"
    SEGMENTS_VIEW = "segments.view"
    SEGMENTS_CREATE = "segments.create"
    SEGMENTS_UPDATE = "segments.update"
    SEGMENTS_DELETE = "segments.delete"
    VIEWS_VIEW = "views.view"
    VIEWS_CREATE = "views.create"
    VIEWS_UPDATE = "views.update"
    VIEWS_DELETE = "views.delete"
    EXPORT_CSV = "export.csv"
    EXPORT_REPORT = "export.report"
    REPORTS_VIEW = "reports.view"
    REPORTS_CREATE = "reports.create"
    REPORTS_DELETE = "reports.delete"

    # --- Kategori 3: Kullanıcı ve Rol Yönetimi (9 izin) ---
    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"
    USERS_RESET_PASSWORD = "users.reset_password"
    ROLES_VIEW = "roles.view"
    ROLES_CREATE = "roles.create"
    ROLES_UPDATE = "roles.update"
    ROLES_DELETE = "roles.delete"

    # --- Kategori 4: Sistem ve Loglar (5 izin) ---
    LOGS_VIEW_API = "logs.view_api"
    LOGS_VIEW_AUDIT = "logs.view_audit"
    LOGS_VIEW_IMPORTS = "logs.view_imports"
    SETTINGS_VIEW = "settings.view"
    SETTINGS_UPDATE = "settings.update"


# Kategori bazlı meta — seed ve UI grupları için
PERMISSION_CATEGORIES: dict[Permission, str] = {
    # view
    **{p: "view" for p in [
        Permission.DASHBOARD_VIEW, Permission.TRAFFIC_VIEW, Permission.META_ADS_VIEW,
        Permission.GOOGLE_ADS_VIEW, Permission.ECOMMERCE_VIEW, Permission.CAMPAIGNS_VIEW,
        Permission.FUNNEL_VIEW, Permission.COHORT_VIEW, Permission.PRODUCTS_VIEW,
    ]},
    # data
    **{p: "data" for p in [
        Permission.IMPORTS_VIEW, Permission.IMPORTS_CREATE, Permission.IMPORTS_DELETE,
        Permission.MAPPINGS_VIEW, Permission.MAPPINGS_CREATE, Permission.MAPPINGS_UPDATE,
        Permission.MAPPINGS_DELETE, Permission.SEGMENTS_VIEW, Permission.SEGMENTS_CREATE,
        Permission.SEGMENTS_UPDATE, Permission.SEGMENTS_DELETE, Permission.VIEWS_VIEW,
        Permission.VIEWS_CREATE, Permission.VIEWS_UPDATE, Permission.VIEWS_DELETE,
        Permission.EXPORT_CSV, Permission.EXPORT_REPORT,
        Permission.REPORTS_VIEW, Permission.REPORTS_CREATE, Permission.REPORTS_DELETE,
    ]},
    # admin
    **{p: "admin" for p in [
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_UPDATE,
        Permission.USERS_DELETE, Permission.USERS_RESET_PASSWORD,
        Permission.ROLES_VIEW, Permission.ROLES_CREATE, Permission.ROLES_UPDATE,
        Permission.ROLES_DELETE,
    ]},
    # system
    **{p: "system" for p in [
        Permission.LOGS_VIEW_API, Permission.LOGS_VIEW_AUDIT, Permission.LOGS_VIEW_IMPORTS,
        Permission.SETTINGS_VIEW, Permission.SETTINGS_UPDATE,
    ]},
}


# Açıklamalar — seed sırasında `permissions.description` kolonuna yazılır
PERMISSION_DESCRIPTIONS: dict[Permission, str] = {
    Permission.DASHBOARD_VIEW: "Genel Özet sayfasını görme",
    Permission.TRAFFIC_VIEW: "Trafik (GA4) sayfasını görme",
    Permission.META_ADS_VIEW: "Meta Ads sayfasını görme",
    Permission.GOOGLE_ADS_VIEW: "Google Ads sayfasını görme",
    Permission.ECOMMERCE_VIEW: "E-Ticaret sayfasını görme",
    Permission.CAMPAIGNS_VIEW: "Kampanyalar sayfasını görme",
    Permission.FUNNEL_VIEW: "Dönüşüm Hunisi sayfasını görme",
    Permission.COHORT_VIEW: "Müşteri Cohort sayfasını görme",
    Permission.PRODUCTS_VIEW: "Ürünler sayfasını görme",
    Permission.IMPORTS_VIEW: "Import işlem geçmişini görme",
    Permission.IMPORTS_CREATE: "Yeni veri import etme",
    Permission.IMPORTS_DELETE: "Import kaydını silme",
    Permission.MAPPINGS_VIEW: "Kanal eşlemelerini görme",
    Permission.MAPPINGS_CREATE: "Yeni kanal eşlemesi oluşturma",
    Permission.MAPPINGS_UPDATE: "Kanal eşlemesi düzenleme",
    Permission.MAPPINGS_DELETE: "Kanal eşlemesi silme",
    Permission.SEGMENTS_VIEW: "Segmentleri görme",
    Permission.SEGMENTS_CREATE: "Yeni segment oluşturma",
    Permission.SEGMENTS_UPDATE: "Segment düzenleme",
    Permission.SEGMENTS_DELETE: "Segment silme",
    Permission.VIEWS_VIEW: "Kayıtlı görünümleri görme",
    Permission.VIEWS_CREATE: "Yeni görünüm oluşturma",
    Permission.VIEWS_UPDATE: "Görünüm düzenleme",
    Permission.VIEWS_DELETE: "Görünüm silme",
    Permission.EXPORT_CSV: "Veriyi CSV formatında dışa aktarma",
    Permission.EXPORT_REPORT: "PDF/Excel rapor dışa aktarma",
    Permission.REPORTS_VIEW: "Oluşturulmuş raporları görüntüleme",
    Permission.REPORTS_CREATE: "Yeni rapor oluşturma",
    Permission.REPORTS_DELETE: "Rapor kaydını silme",
    Permission.USERS_VIEW: "Kullanıcı listesini görme",
    Permission.USERS_CREATE: "Yeni kullanıcı oluşturma",
    Permission.USERS_UPDATE: "Kullanıcı bilgilerini düzenleme",
    Permission.USERS_DELETE: "Kullanıcı silme",
    Permission.USERS_RESET_PASSWORD: "Kullanıcı şifresini sıfırlama",
    Permission.ROLES_VIEW: "Rol listesini görme",
    Permission.ROLES_CREATE: "Yeni rol oluşturma",
    Permission.ROLES_UPDATE: "Rol düzenleme",
    Permission.ROLES_DELETE: "Rol silme",
    Permission.LOGS_VIEW_API: "API erişim loglarını görme",
    Permission.LOGS_VIEW_AUDIT: "Denetim loglarını görme",
    Permission.LOGS_VIEW_IMPORTS: "Import detay loglarını görme",
    Permission.SETTINGS_VIEW: "Sistem ayarlarını görme",
    Permission.SETTINGS_UPDATE: "Sistem ayarlarını düzenleme",
}


def split_code(code: str) -> tuple[str, str]:
    """`'users.delete'` → `('users', 'delete')`."""
    module, _, action = code.partition(".")
    return module, action
