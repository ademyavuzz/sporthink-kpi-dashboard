# CLAUDE.md — Sporthink Backend

> Kök `/CLAUDE.md`'yi okuduğun varsayılır. Bu dosya **backend'e özel** kuralları içerir.
> Backend altında çalışıyorsan bu dosyadaki her kural geçerlidir.

---

## 1. Stack Özeti

- **Dil:** Python 3.12 (CPython, async/await destekli)
- **Framework:** FastAPI 0.115+ (Uvicorn ASGI; Gunicorn production process manager)
- **ORM:** SQLAlchemy 2.0+ **async API** (sync API kullanılmaz)
- **Validation:** Pydantic 2.11+ (Rust core, hızlı)
- **Background Jobs:** Celery 5.4+ (broker: Redis db 1)
- **DB:** MySQL 8.4 LTS (utf8mb4, partition + computed columns)
- **Cache:** Redis 7.4 (db 0 = cache, db 1 = Celery broker — karıştırma)
- **Migration:** Alembic 1.14+
- **Auth:** PyJWT + passlib[bcrypt]
- **Lint/Format:** Ruff (Black + Flake8 + isort yerine tek araç)
- **Test:** pytest 8 + pytest-asyncio + pytest-cov

Detay: `docs/overview/02-tech-stack.md` §2.4–2.5

---

## 2. Klasör Yapısı

`docs/overview/03-architecture.md` §3.3.1 birebir geçerli. Hızlı referans:

```
backend/
├── app/
│   ├── main.py              # FastAPI app, exception handler, middleware mount
│   ├── config.py            # Pydantic Settings — TÜM env burada okunur
│   ├── dependencies.py      # Global FastAPI deps (get_db, get_current_user)
│   │
│   ├── core/                # Çapraz kesen bileşenler
│   │   ├── permissions.py   # 43 izin enum'u — TEK doğru kaynak
│   │   ├── exceptions.py    # Custom exception class'ları
│   │   ├── security.py      # JWT encode/decode, password hash
│   │   └── cache_keys.py    # Tüm cache key formatları
│   │
│   ├── api/v1/              # Router'lar (HTTP layer)
│   │   ├── auth.py          # /api/v1/auth/*
│   │   ├── users.py         # /api/v1/users/*
│   │   └── ...
│   │
│   ├── services/            # İŞ MANTIĞI — uygulamanın beyni
│   ├── repositories/        # DB erişimi — sadece ORM sorguları
│   ├── models/              # SQLAlchemy ORM (DB şekli)
│   ├── schemas/             # Pydantic (API contract)
│   ├── tasks/               # Celery görevleri
│   ├── parsers/             # CSV/XLSX/JSON parser'lar
│   ├── utils/               # Saf yardımcılar (state-less)
│   └── middleware/          # CORS, rate limit, audit
│
├── alembic/versions/        # Migration dosyaları
├── tests/
│   ├── unit/                # Service ve util seviyesi (DB yok)
│   ├── integration/         # Router seviyesi (test DB ile)
│   └── conftest.py          # Fixture'lar
│
├── pyproject.toml
├── ruff.toml
├── Dockerfile
└── .env.example
```

**Her klasör için "ne girer / ne girmez":**

| Klasör | Girer | Girmez |
|---|---|---|
| `api/v1/` | HTTP method handler, request validation (Pydantic), response shape | İş mantığı, SQL, hesaplama |
| `services/` | Orkestrasyon, validation kuralları, transaction yönetimi, KPI formülleri | HTTP detayları (Request, Response, status_code) |
| `repositories/` | SQLAlchemy sorguları, CRUD operasyonları | İş kuralları, validation, business logic |
| `models/` | Tablo tanımı, ilişkiler, computed columns | API serialization, validation kuralları |
| `schemas/` | Pydantic Create/Update/Response sınıfları | Hesaplama, DB erişimi |
| `tasks/` | Celery task tanımları, retry policy | DB connection açma (session DI ile gelir) |
| `parsers/` | Dosya format dönüşümü, raw data extraction | İş kuralı, KPI hesabı |
| `utils/` | Saf fonksiyonlar (date, fuzzy match, pagination) | Side effect, DB, network |

---

## 3. KATMANLAMA KURALI (Router → Service → Repository)

**Bu kural hiçbir koşulda atlanmaz.** Atlamak istediğinde dur ve neden gerektiğini sorgula — %99 ihtimalle yanlış yapıyorsundur.

```
HTTP Request
    ↓
api/v1/<resource>.py     ← Pydantic validation, status code, dependency injection
    ↓
services/<resource>_service.py     ← İş mantığı, transaction, validation kuralları
    ↓
repositories/<resource>_repository.py     ← SQLAlchemy sorguları
    ↓
MySQL
```

### Doğru Pattern

```python
# api/v1/users.py
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_permission("users.delete")),
    db: AsyncSession = Depends(get_db),
):
    await user_service.delete_user(db, user_id, deleted_by=current_user.id)
    return {"success": True}

# services/user_service.py
async def delete_user(db: AsyncSession, user_id: int, deleted_by: int) -> None:
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        raise ResourceNotFoundError("User not found")
    if user.role and user.role.is_system:
        raise ValidationError("Cannot delete super admin", field="user_id")
    await user_repo.soft_delete(db, user_id)
    await audit_service.log(db, "user.deleted", actor_id=deleted_by, target_id=user_id)
    await cache.delete(cache_keys.user_perms(user_id))

# repositories/user_repository.py
async def soft_delete(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(deleted_at=func.now())
    )
    await db.commit()
```

### Yasak Pattern

```python
# api/v1/users.py — KATMANLAMA İHLALİ
@router.delete("/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.execute(select(User).where(User.id == user_id))  # ❌ Router'da SQL
    if user.role.is_system:                                           # ❌ Router'da iş kuralı
        raise HTTPException(400, "Cannot delete admin")               # ❌ Generic exception
    await db.delete(user)                                              # ❌ Hard delete
    await db.commit()
```

---

## 4. Model vs Schema Disiplini

**Model = DB şekli, Schema = API contract.** İkisi karıştırılmaz.

- Bir `models/user.py` → `User(Base)` (SQLAlchemy ORM)
- Bir `schemas/user.py` → en az üç sınıf:
  - `UserCreate` — POST request (password var, id yok)
  - `UserUpdate` — PATCH request (tüm alanlar Optional)
  - `UserResponse` — GET response (id var, password_hash YOK)

```python
# schemas/user.py
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role_id: int

class UserCreate(UserBase):
    password: str = Field(min_length=10)

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role_id: int | None = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    last_login_at: datetime | None
    model_config = ConfigDict(from_attributes=True)
```

ORM model'i doğrudan response'a dönmek **yasak** (parola hash'i sızar). Daima Pydantic schema'ya çevir.

---

## 5. RBAC ENFORCEMENT (Kritik)

`docs/overview/05-rbac-security.md` §5.5 birebir uygulanır. Kısa özet:

### 5.1 Her Endpoint'te İzin Kontrolü

```python
# DOĞRU
@router.get("/kpi/summary")
async def kpi_summary(
    current_user: User = Depends(require_permission("dashboard.view")),
):
    ...
```

```python
# YASAK — yetki kontrolü yok
@router.get("/kpi/summary")
async def kpi_summary(current_user: User = Depends(get_current_user)):
    ...
```

**İstisna sadece:** `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/health/*`. Bunlar dışında izinsiz endpoint **yoktur**.

### 5.2 İzin String'leri Hardcode Edilmez

```python
# YASAK
@Depends(require_permission("users.delete"))

# DOĞRU
from app.core.permissions import Permission
@Depends(require_permission(Permission.USERS_DELETE))
```

Tüm 43 izin `app/core/permissions.py` içinde `Permission` enum'unda tanımlıdır. Yeni izin eklenirken:
1. `docs/overview/05-rbac-security.md` §5.5.4 güncellenir.
2. `Permission` enum'una eklenir.
3. Migration ile `permissions` tablosuna seed edilir.
4. Sistem rollerinin (ör. Super Admin) bu izni otomatik aldığı doğrulanır.

### 5.3 Süper Admin Bypass

`current_user.role.is_system == True` ise tüm izin kontrolleri **bypass** edilir. Bu `require_permission` içinde tek noktada yapılır, başka yerde tekrar implementasyon YASAK.

### 5.4 Permission Cache

- Key formatı: `cache_keys.user_perms(user_id)` → `"user_perms:{id}"`
- TTL: **5 dakika** (`docs/overview/05` §5.5.6)
- Invalidasyon tetikleyicileri: rol atama değişikliği, izin değişikliği, rol silme, kullanıcı pasifleştirme. Hepsinde `await cache.delete(cache_keys.user_perms(user_id))` çağrılır.

---

## 6. API Response Standardı

Tüm response **tek formatta** döner. Frontend bu yapıya göre yazılmıştır, sapma frontend'i kırar.

### 6.1 Başarılı Response

```json
{
  "success": true,
  "data": { ... } | [ ... ]
}
```

Pagination'lı liste:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 1234
  }
}
```

### 6.2 Hatalı Response

```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_TOO_SHORT",
    "message": "Password must be at least 10 characters",
    "field": "password",
    "params": { "min": 10 }
  }
}
```

- `code`: SCREAMING_SNAKE_CASE, sabit, frontend i18n için kullanır. **Asla değişmez** (changelog gerekir).
- `message`: İngilizce default açıklama. Frontend `code`'a göre TR/EN gösterir.
- `field`: validasyon hatası ise hatalı alan adı (opsiyonel).
- `params`: i18n için parametre seti (opsiyonel).

### 6.3 HTTP Status Code Kullanımı

| Durum | Status | Code Örneği |
|---|---|---|
| Başarılı | 200, 201, 204 | — |
| Auth gerekli | 401 | `AUTH_REQUIRED`, `TOKEN_EXPIRED` |
| Yetkisiz | 403 | `PERMISSION_DENIED` |
| Bulunamadı | 404 | `RESOURCE_NOT_FOUND` |
| Validation | 422 | `VALIDATION_ERROR`, `EMAIL_INVALID` |
| Çakışma | 409 | `EMAIL_ALREADY_EXISTS` |
| Rate limit | 429 | `RATE_LIMIT_EXCEEDED` |
| Sunucu hatası | 500 | `INTERNAL_ERROR` |

`HTTPException` doğrudan kullanılmaz; `app/core/exceptions.py`'daki custom class'lar kullanılır. Bunlar global handler'da yukarıdaki şemaya çevrilir.

---

## 7. Database Disiplini

`docs/overview/04-data-model.md` her zaman doğru kabul edilir.

### 7.1 Migration

- **Tüm DB değişiklikleri Alembic ile.** Manuel SQL yasak.
- Yeni model eklediğinde:
  ```bash
  alembic revision --autogenerate -m "add_xyz_table"
  ```
- Generated migration **review edilir**: autogenerate index'leri ve constraint'leri her zaman doğru çıkarmaz.
- Down migration yazılır (rollback için), sadece data-destructive ise comment'le belirt.

### 7.2 Tip ve İndeks Kuralları

- Para → `DECIMAL(15, 2)`, NOT NULL DEFAULT 0
- Yüzde → `DECIMAL(8, 2)`
- Zaman → `TIMESTAMP` (UTC, aware), DEFAULT `CURRENT_TIMESTAMP` ON UPDATE `CURRENT_TIMESTAMP`
- ID → `BIGINT UNSIGNED AUTO_INCREMENT`
- Email → `VARCHAR(255)` UNIQUE, lowercase normalize
- JSON → `JSON` (MySQL native), küçük metadata için OK; büyük yapı için ayrı tablo
- Tüm FK'lerde `ON DELETE` davranışı açıkça belirtilir (CASCADE / RESTRICT / SET NULL)

### 7.3 Soft Delete

- `deleted_at TIMESTAMP NULL` pattern.
- `users`, `roles`, `segments`, `views`, `imports` soft delete.
- Aggregation/log tabloları (`audit_logs`, `kpi_*_aggregates`, `api_request_logs`) **hard delete edilmez**, sadece partition drop ile temizlenir.
- Repository'de default sorgular `WHERE deleted_at IS NULL` filtresini ekler. Soft-deleted erişimi gerekiyorsa explicit `include_deleted=True` parametresi.

### 7.4 SQL Yazma Kuralları

- `SELECT *` **yasak**. Kolonlar açıkça belirtilir.
- ORM model'i tüm kolonları çekmek için OK; ama raw SQL veya Core query'de kolon listesi açık olmalı.
- N+1 sorgu için `selectinload` veya `joinedload` kullan.
- Büyük tablo sorgularında (`ga4_traffic`, `meta_ads`, vb.) `date` üzerinde indeks olduğunu doğrula; yoksa migration ekle.

### 7.5 Transaction Yönetimi

- Service layer'da `async with db.begin():` block'u ile birden fazla DB operasyonu atomic yapılır.
- Auto-commit varsayma; her zaman explicit `await db.commit()` veya `db.begin()` block'u.

---

## 8. Async ve Celery Kuralları

### 8.1 Async Disiplini

- **Tüm endpoint'ler `async def`**. Sync endpoint yazma — FastAPI thread pool'a düşürür ve performans kaybeder.
- **Async fonksiyonda blocking I/O YASAK:**
  - ❌ `requests.get(...)` → ✅ `httpx.AsyncClient`
  - ❌ `time.sleep(5)` → ✅ `await asyncio.sleep(5)`
  - ❌ `open(...)` (büyük dosya) → ✅ `aiofiles.open(...)`
  - ❌ Sync DB session → ✅ `AsyncSession`
- CPU-bound iş varsa (büyük pandas işlemi, hash) Celery task'a taşı.

### 8.2 Celery Task'lar

- **3 saniyeden uzun sürebilen her iş Celery task'a taşınır.** Threshold:
  - Dosya import (her boyutta) → Celery
  - Aggregation rebuild → Celery
  - Bulk export (>1000 satır) → Celery
  - Email gönderimi → Celery (SendGrid 1-2sn alabilir)

- **Task şablonu:**
  ```python
  @celery_app.task(
      bind=True,
      autoretry_for=(SQLAlchemyError, ConnectionError, httpx.HTTPError),
      retry_kwargs={'max_retries': 3, 'countdown': 60},
      acks_late=True,
  )
  def process_import(self, import_id: int) -> dict:
      # idempotent olmalı: aynı import_id ile iki kez çağrılırsa duplikat üretmez
      ...
  ```

- **Job state akışı:** `PENDING → STARTED → SUCCESS | FAILURE`. Frontend polling ile durum sorgular: `GET /api/v1/jobs/{job_id}`.
- Task içinde `print()` veya `logging.info(...)` kullan; Celery worker log'larında görünür.
- Task argümanları **küçük ve serializable** olmalı (id'ler, dict'ler). Büyük objeleri argument olarak geçme — DB'den çek.

### 8.3 Redis DB Ayrımı

- `db 0` = uygulama cache (KPI sonuçları, permission cache, session)
- `db 1` = Celery broker
- **Karıştırma yasak.** `Settings`'te ayrı URL'ler:
  ```
  REDIS_CACHE_URL=redis://redis:6379/0
  REDIS_BROKER_URL=redis://redis:6379/1
  ```

---

## 9. Cache Stratejisi

### 9.1 Tek Doğru Kaynak: `app/core/cache_keys.py`

Tüm cache key'leri tek dosyada üretilir. Endpoint'te string concat yapma.

```python
# app/core/cache_keys.py
def kpi_summary(filter_hash: str, date_range: str) -> str:
    return f"kpi:summary:{filter_hash}:{date_range}"

def user_perms(user_id: int) -> str:
    return f"user_perms:{user_id}"

def role_perms(role_id: int) -> str:
    return f"role_perms:{role_id}"
```

### 9.2 TTL Standartları

| Veri | TTL | Invalidasyon |
|---|---|---|
| KPI summary sonuçları | 5 dakika | Yeni import sonrası tüm `kpi:*` |
| User permissions | 5 dakika | Rol/izin değişikliğinde |
| Filter dropdown listeleri | 30 dakika | İlgili tablo değişikliğinde |
| Static referans (rol listesi) | 1 saat | Rol CRUD'da |

### 9.3 Cache Pattern

```python
async def get_kpi_summary(filters: KPIFilter) -> KPISummary:
    key = cache_keys.kpi_summary(filters.hash(), filters.date_range_str())
    cached = await cache.get(key)
    if cached:
        return KPISummary.model_validate_json(cached)
    result = await kpi_repo.compute_summary(filters)
    await cache.setex(key, 300, result.model_dump_json())
    return result
```

---

## 10. Import ve Parser Kuralları

`docs/overview/08-import-system.md` her zaman doğru kabul edilir.

### 10.1 Yeni Veri Kaynağı Eklenirse

1. `docs/overview/08-import-system.md`'ye kaynak spesifikasyonu eklenir (kolonlar, format, frequency).
2. `parsers/<source>_parser.py` yazılır.
3. `services/normalize_service.py` içinde mapping tanımlanır.
4. `services/import_service.py` içinde routing eklenir.
5. `tasks/import_tasks.py` içinde Celery task'a hook'lanır.
6. Aggregation update mantığı `tasks/normalize_tasks.py`'de tanımlanır.
7. Test: en az 1 happy path + 1 malformed file + 1 partial duplicate.

### 10.2 Validation ve Hata Raporu

- Parser **fail-fast etmez**, hatalı satırları toplar.
- Sonuç:
  ```python
  ImportResult(
      total_rows=10000,
      success_rows=9876,
      failed_rows=124,
      errors=[
          ImportError(row=42, field="date", message="Invalid date format"),
          ...
      ]
  )
  ```
- Hata listesi DB'ye kaydedilir (`import_errors` tablosu) ve frontend'e ilk 100'ü gösterilir.

### 10.3 Auto-detect ve Manual Mapping

- `parsers/auto_detector.py` kolon header'larını fuzzy match ile tanır (utils/fuzzy_match.py).
- Eşleşme < 0.8 confidence ise kullanıcıya manuel kolon mapping wizard'ı sunulur.
- Onaylanan mapping `column_mappings` tablosuna kaydedilir, sonraki import'larda otomatik kullanılır.

---

## 11. KPI Hesaplama Kuralları

`docs/overview/09-kpi-formulas.md` toplam **31 KPI**'yi tanımlar. Tek doğru kaynak.

### 11.1 Yer

- KPI formülleri **sadece** `app/services/kpi_service.py` içinde.
- Repository'de SQL aggregation'lar (SUM, AVG) OK ama **iş kuralı (eşik, koşul) repository'de yok**.
- Frontend KPI hesaplamaz, **gösterir**. Yüzde değişim, trend yönü, formatlama backend'de.

### 11.2 Formül Yazma Standardı

```python
async def calculate_cart_abandonment_rate(
    db: AsyncSession,
    filters: KPIFilter,
) -> KPIResult:
    """Cart Abandonment Rate.

    Formül: (1 - completed_orders / cart_creates) * 100
    Kaynak: docs/overview/09-kpi-formulas.md §9.5.3
    Birim: yüzde (DECIMAL 8,2)
    Trend yönü: 'down' iyidir (azalış olumlu)
    """
    cart_creates = await kpi_aggregate_repo.sum_metric(db, "cart_creates", filters)
    completed = await kpi_aggregate_repo.sum_metric(db, "completed_orders", filters)
    if cart_creates == 0:
        value = None  # 0/0 değil, "veri yok"
    else:
        value = round((1 - completed / cart_creates) * 100, 2)
    return KPIResult(
        kpi_id="cart_abandonment_rate",
        value=value,
        unit="percent",
        trend_direction_positive="down",
    )
```

**Her KPI fonksiyonu:**
- Docstring'de formül + `docs/overview/09` referansı + birim + trend yönü.
- NULL semantik (sıfır bölünme = NULL, "veri yok").
- Pure: aynı input → aynı output. DB'den çeker, başka side effect yok.
- Test edilir (`tests/unit/test_kpi_service.py`).

### 11.3 Aggregation Tabloları

Üç tablo: `kpi_daily_aggregates`, `kpi_monthly_aggregates`, `kpi_campaign_aggregates`.

- Yeni veri import'undan sonra `tasks/normalize_tasks.py::rebuild_aggregations(date_range)` çağrılır.
- Manual rebuild gerekirse: `POST /api/v1/admin/aggregations/rebuild` (sadece `settings.update` izniyle).
- Tüm KPI sorgular **bu tablolar üzerinden** yapılır, raw tablolardan değil.

### 11.4 Karşılaştırma Periyodu

`docs/overview/09` §9.2.2: tüm KPI'lar mevcut + önceki periyot için hesaplanır. Önceki periyot iki seçenek:
- **Sequential** (default): aynı uzunluk geriye (Son 30 gün → önceki 30 gün)
- **YoY**: bir önceki yılın aynı dönemi

Frontend toggle ile seçer; backend `comparison_mode` query param ile alır.

---

## 12. Audit Log Kuralları

`docs/overview/05-rbac-security.md` §5.8

### 12.1 Otomatik Loglanan Action'lar

`middleware/audit_middleware.py` aşağıdakileri otomatik loglar:
- Auth: `login`, `login.failed`, `logout`, `password.reset`, `account.locked`
- Mutating endpoints (POST, PATCH, DELETE) — endpoint adı + actor + target id

### 12.2 Manuel Audit Log

İş mantığı içinde anlamlı olay varsa `audit_service.log()` ile manuel yazılır:

```python
await audit_service.log(
    db,
    action="role.permission_changed",
    actor_id=current_user.id,
    target_type="role",
    target_id=role.id,
    details={"added": [...], "removed": [...]},
)
```

### 12.3 Audit'e YAZILMAZ

- Şifre, token, secret değerleri (sadece "password.changed" event, plaintext değil)
- Kişisel veri içeren payload (telefon, adres) → sadece field adı log'lanır, değer değil
- GET istekleri (gürültü) — sadece `logs.view_audit` gibi hassas GET'ler

---

## 13. Hata Hiyerarşisi

`app/core/exceptions.py` içinde:

```python
class SporthinkException(Exception):
    code: str
    status_code: int
    field: str | None = None
    params: dict | None = None

class AuthenticationError(SporthinkException):
    code = "AUTH_REQUIRED"; status_code = 401

class TokenExpiredError(AuthenticationError):
    code = "TOKEN_EXPIRED"

class PermissionDeniedError(SporthinkException):
    code = "PERMISSION_DENIED"; status_code = 403

class ResourceNotFoundError(SporthinkException):
    code = "RESOURCE_NOT_FOUND"; status_code = 404

class ValidationError(SporthinkException):
    code = "VALIDATION_ERROR"; status_code = 422

class ConflictError(SporthinkException):
    code = "CONFLICT"; status_code = 409

class RateLimitError(SporthinkException):
    code = "RATE_LIMIT_EXCEEDED"; status_code = 429
```

`main.py`'de global handler bu sınıfları yakalar ve §6.2 formatında JSON döndürür.

**`HTTPException` doğrudan raise yasak** (response format'ı bozar).

---

## 14. Date / Time Kuralı

- **DB:** her zaman UTC `TIMESTAMP`.
- **Service ve repository:** her zaman UTC `datetime` (timezone-aware, `datetime.now(timezone.utc)`).
- **Pydantic schema:** `datetime` tipi (Pydantic ISO 8601 serialize eder).
- **TZ dönüşümü:** sadece çok özel raporlama gerektiğinde backend'de (örn: günlük rapor — kullanıcının saatine göre "bugün" tanımı). Aksi halde **frontend dönüştürür**.
- `date_utils.py`: yardımcılar (`now_utc()`, `to_utc(dt)`, `parse_iso(s)`).
- **`datetime.now()` (naive) yasak** — daima `datetime.now(timezone.utc)`.

---

## 15. Logging Standardı

```python
import logging
logger = logging.getLogger(__name__)

logger.info("user_login", extra={"user_id": user.id, "ip": request.client.host})
logger.warning("import_partial_failure", extra={"import_id": id, "failed_rows": n})
logger.error("payment_processing_failed", extra={"order_id": id}, exc_info=True)
```

- `print()` **yasak**.
- Log seviyeleri: DEBUG (dev only), INFO (normal akış), WARNING (anormal ama beklenen), ERROR (kurtarıldı), CRITICAL (sistem riskli).
- Hassas bilgi (`password`, `token`, `secret`, `email`, `phone`) log'a **yazılmaz**.
- Structured log: `extra={...}` ile key-value, free-form string yerine.

---

## 16. Test Disiplini

`docs/overview/12-testing.md` referans.

### 16.1 Test Tipleri

| Tip | Yer | Marker | Neyi Test Eder |
|---|---|---|---|
| Unit | `tests/unit/` | `@pytest.mark.unit` | Saf fonksiyon, service mantığı (DB mock'lu) |
| Integration | `tests/integration/` | `@pytest.mark.integration` | Endpoint + gerçek test DB (SQLite veya MySQL) |
| Task | `tests/tasks/` | `@pytest.mark.task` | Celery task'lar (eager mode) |

### 16.2 Yeni Endpoint İçin Minimum Test Seti

```python
# tests/integration/test_users_api.py
async def test_delete_user_success(client, super_admin_token, sample_user):
    r = await client.delete(f"/api/v1/users/{sample_user.id}",
                            headers={"Authorization": f"Bearer {super_admin_token}"})
    assert r.status_code == 200
    assert r.json()["success"] is True

async def test_delete_user_unauthorized(client, low_perm_token, sample_user):
    r = await client.delete(f"/api/v1/users/{sample_user.id}",
                            headers={"Authorization": f"Bearer {low_perm_token}"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PERMISSION_DENIED"

async def test_delete_user_not_found(client, super_admin_token):
    r = await client.delete("/api/v1/users/999999",
                            headers={"Authorization": f"Bearer {super_admin_token}"})
    assert r.status_code == 404
```

### 16.3 Coverage Hedefi

- Genel minimum: **%75**
- `services/`, `core/security.py`, `services/kpi_service.py`: **%90+** (kritik kod)
- `api/v1/`: **%80+** (her endpoint için en az happy + auth + validation testi)

### 16.4 Fixture'lar (`conftest.py`)

- `client` — async TestClient (httpx.AsyncClient + ASGITransport)
- `db` — test DB session (her test sonrası rollback)
- `super_admin_token`, `low_perm_token` — auth token fixture'ları
- `sample_user`, `sample_role`, `sample_import` — factory pattern (factory_boy)

---

## 17. Lint ve Format

- **Ruff** tek araç — Black, Flake8, isort, pyupgrade hepsini yapar.
- Pre-commit hook: `ruff check --fix` + `ruff format`.
- `pyproject.toml` veya `ruff.toml` içinde config:
  ```toml
  [tool.ruff]
  line-length = 100
  target-version = "py312"

  [tool.ruff.lint]
  select = ["E", "F", "W", "I", "N", "UP", "B", "C4", "SIM", "ASYNC"]
  ```
- CI'da `ruff check .` fail ederse merge edilemez.

---

## 18. Sık Komutlar

```bash
# Dev server (Docker dışı, lokal)
uvicorn app.main:app --reload --port 8000

# Celery worker (ayrı terminal)
celery -A app.celery_app worker --loglevel=info
celery -A app.celery_app beat --loglevel=info  # scheduled task'lar

# Migration
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
alembic history

# Test
pytest                                  # tüm testler
pytest -m unit                          # sadece unit
pytest tests/integration/test_kpi.py    # tek dosya
pytest -k test_login                    # isim eşleşen
pytest --cov=app --cov-report=html      # coverage

# Lint
ruff check .
ruff check --fix .
ruff format .

# Shell (debug)
python -c "from app.config import settings; print(settings)"
```

---

## 19. Mutlak Yasaklar (Backend)

| # | Yasak | Doğrusu |
|---|---|---|
| 1 | Async fonksiyonda blocking I/O (`requests`, `time.sleep`, sync `open`) | `httpx.AsyncClient`, `asyncio.sleep`, `aiofiles` |
| 2 | Direkt `psycopg`, `pymysql` kullanımı | SQLAlchemy `AsyncSession` |
| 3 | `SELECT *` veya kolon listesiz raw query | Açık kolon listesi |
| 4 | `print()` veya stdout debug | `logger.info(..., extra={...})` |
| 5 | `try: ... except: pass` (sessiz hata yutma) | Spesifik exception, log + raise veya recover |
| 6 | Router içinde SQL veya iş mantığı | Service çağırılır |
| 7 | Service içinde `Request`, `Response`, `HTTPException` | Custom exception raise |
| 8 | İzin string'ini hardcode (`"users.delete"`) | `Permission.USERS_DELETE` enum |
| 9 | `HTTPException` doğrudan raise | `app.core.exceptions` custom class |
| 10 | `datetime.now()` naive | `datetime.now(timezone.utc)` |
| 11 | Hard delete (auth ve audit dışında) | Soft delete (`deleted_at`) |
| 12 | ORM model'i doğrudan response'a return | Pydantic schema'ya çevir |
| 13 | Manuel SQL ile DB değiştirmek (production) | Alembic migration |
| 14 | Şifre, token, secret, kişisel veri log'a yazmak | Sadece event adı, ID'ler |
| 15 | `app/core/permissions.py` dışında izin tanımlamak | Tek doğru kaynak |
| 16 | KPI formülünü `kpi_service.py` dışında yazmak | Tek noktada toplanır |
| 17 | Cache key'i string concat ile elle yapmak | `cache_keys.py` fonksiyonları |
| 18 | Celery task'a büyük obje argument geçmek | ID geç, task içinde DB'den çek |
| 19 | Yeni dependency eklemek (onaysız) | Mevcutu kullan; eklenecekse insan onayı |
| 20 | Parolayı hash'lemeden DB'ye yazmak | `passlib` ile bcrypt cost 12 |

---

*Bu dosya `/CLAUDE.md`'nin alt katmanıdır. Çelişki olursa kök dosya proje çapı kuralları için, bu dosya backend implementasyon detayları için doğrudur.*
