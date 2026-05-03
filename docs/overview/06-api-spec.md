# 6. API SPESİFİKASYONU

> **Bu Bölümde Neler Var?**
> Bu bölüm, sistemin tüm REST API endpoint'lerini ve her endpoint'in girdi/çıktı yapısını ele almaktadır. API mimari prensipleri, hata yanıt formatı, pagination, filtreleme ve özel kullanım senaryoları detaylı olarak belgelenmiştir. Tüm endpoint'ler Swagger/OpenAPI ile otomatik dokümante edilmektedir.

## 6.1 API Mimari Prensipleri

### 6.1.1 RESTful Tasarım

Tüm API'ler REST prensiplerine uygun olarak tasarlanmıştır. Kaynak odaklı (resource-oriented) URL yapısı, HTTP metodlarının doğru kullanımı ve uygun status code'ları temel alınmıştır.

| HTTP Metodu | Kullanım | Örnek |
|---|---|---|
| GET | Kaynak listeleme veya tek kaynak getirme | `GET /users` |
| POST | Yeni kaynak oluşturma | `POST /users` |
| PUT | Kaynağı tamamen güncelleme | `PUT /users/{id}` |
| PATCH | Kaynağı kısmen güncelleme | `PATCH /users/{id}` |
| DELETE | Kaynağı silme | `DELETE /users/{id}` |

### 6.1.2 URL Yapısı

Tüm endpoint'ler `/api/v1/` prefix'i ile başlar. Versiyonlama URL üzerinden yapılır; ileride breaking change olduğunda `/api/v2/` ile yeni versiyon yayınlanabilir, eski versiyon geri uyumluluk için yaşamaya devam eder.

```
https://dashboard.sporthink.com.tr/api/v1/{resource}/{id}/{sub-resource}
```

Kaynak isimleri çoğul kullanılır: `users`, `imports`, `roles` (tekil değil).

### 6.1.3 İsteklerin İçeriği

Tüm istek body'leri ve response'ları **JSON** formatındadır.

```
Content-Type: application/json
Accept: application/json
```

Dosya yükleme istekleri (`POST /imports`) `multipart/form-data` kullanır.

### 6.1.4 Authentication Header

Login dışındaki tüm endpoint'ler Authorization header gerektirir:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Geçersiz veya süresi dolmuş token 401 Unauthorized hatası ile reddedilir.

### 6.1.5 Standart Response Formatı

Tüm response'lar tutarlı bir JSON yapısına sahiptir.

**Başarılı Response:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-04-15T14:23:00Z"
  }
}
```

**Hata Response:**

```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_TOO_SHORT",
    "message": "Password must be at least 10 characters",
    "field": "password",
    "params": { "min": 10 }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-04-15T14:23:00Z"
  }
}
```

`error.code` machine-readable hata kodudur. Frontend bu kodu kendi locale sözlüğüne göre çevirir. `error.message` İngilizce default mesajdır (developer'lar için).

**Liste Response (Pagination):**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 156,
    "total_pages": 8
  },
  "meta": { ... }
}
```

### 6.1.6 HTTP Status Code'ları

Sistem aşağıdaki status code'ları kullanır:

| Code | Anlam | Kullanım |
|---|---|---|
| 200 | OK | Başarılı GET, PUT, PATCH, DELETE |
| 201 | Created | Başarılı POST (yeni kaynak oluşturuldu) |
| 202 | Accepted | Async işlem başlatıldı (örn: import) |
| 204 | No Content | Başarılı DELETE, response body yok |
| 400 | Bad Request | Geçersiz istek (örn: malformed JSON) |
| 401 | Unauthorized | Authentication eksik veya geçersiz |
| 403 | Forbidden | Yetkisiz erişim (authentication var ama permission yok) |
| 404 | Not Found | Kaynak bulunamadı |
| 409 | Conflict | Çakışma (örn: aynı email ile kayıt) |
| 422 | Unprocessable Entity | Validation hatası |
| 423 | Locked | Hesap kilitli (5 yanlış şifre denemesi sonrası) |
| 429 | Too Many Requests | Rate limit aşıldı |
| 500 | Internal Server Error | Sunucu hatası |
| 503 | Service Unavailable | Bakım modu, geçici servis dışı |

### 6.1.7 Pagination

Liste endpoint'leri pagination destekler. Query parametreleri:

```
GET /api/v1/users?page=1&page_size=20&sort=created_at&order=desc
```

| Parametre | Default | Açıklama |
|---|---|---|
| `page` | 1 | Sayfa numarası |
| `page_size` | 20 | Sayfa başına kayıt sayısı (max 100) |
| `sort` | `created_at` | Sıralanacak alan |
| `order` | `desc` | `asc` veya `desc` |

### 6.1.8 Filtreleme

Liste endpoint'leri query parameter ile filtrelenebilir:

```
GET /api/v1/imports?status=completed&data_type=ga4_traffic&date_from=2026-04-01
```

Çoklu değerler virgülle ayrılır:

```
GET /api/v1/users?role_id=2,3,5
```

## 6.2 Endpoint Grupları

API endpoint'leri 12 ana gruba ayrılmıştır.

| Grup | Prefix | Amaç |
|---|---|---|
| Authentication | `/auth` | Login, logout, token refresh, şifre sıfırlama |
| Users | `/users` | Kullanıcı CRUD |
| Roles | `/roles` | Rol ve permission yönetimi |
| Permissions | `/permissions` | İzin listesi |
| Imports | `/imports` | Veri import işlemleri |
| Mappings | `/mappings` | Channel mapping yönetimi |
| KPI | `/kpi` | KPI hesaplamaları |
| Dashboard | `/dashboard` | Dashboard veri endpoint'leri |
| Filters | `/filters` | Filtre seçenekleri |
| Segments | `/segments` | Segmentasyon |
| Saved Views | `/views` | Kayıtlı görünümler |
| Export | `/export` | Veri dışa aktarma |
| Logs | `/logs` | API ve audit logları |
| Health | `/health` | Sistem sağlık kontrolü |

## 6.3 Authentication Endpoints

### 6.3.1 POST /auth/login

Kullanıcı giriş yapar, access token ve refresh token alır.

**Request:**
```json
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "remember_me": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "user": {
      "id": 7,
      "email": "user@example.com",
      "first_name": "Adem",
      "last_name": "Yavuz",
      "role": {
        "id": 1,
        "name": "Süper Admin",
        "is_system": true
      },
      "permissions": ["dashboard.view", "users.create", ...]
    }
  }
}
```

Refresh token httpOnly cookie ile gönderilir (response body'sinde değil).

**Hata Kodları:**
- `INVALID_CREDENTIALS` (401)
- `ACCOUNT_LOCKED` (423)
- `ACCOUNT_DEACTIVATED` (403)

### 6.3.2 POST /auth/refresh

Access token'ı yeniler. Refresh token httpOnly cookie ile otomatik gönderilir.

**Request:**
```
POST /api/v1/auth/refresh
Cookie: refresh_token=...
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "expires_in": 900
  }
}
```

### 6.3.3 POST /auth/logout

Aktif oturumu sonlandırır. Refresh token revoke edilir, cookie silinir.

**Response 204:** No Content

### 6.3.4 POST /auth/forgot-password

Şifre sıfırlama linki email ile gönderilir.

**Request:**
```json
{ "email": "user@example.com" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Eğer email kayıtlıysa, sıfırlama linki gönderildi"
  }
}
```

### 6.3.5 GET /auth/verify-reset-token

Şifre sıfırlama token'ının geçerliliğini kontrol eder.

**Request:**
```
GET /api/v1/auth/verify-reset-token?token=abc123...
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user_email": "u**r@example.com"
  }
}
```

### 6.3.6 POST /auth/reset-password

Yeni şifre belirler.

**Request:**
```json
{
  "token": "abc123...",
  "new_password": "NewSecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Şifreniz değiştirildi, lütfen tekrar giriş yapın"
  }
}
```

### 6.3.7 GET /auth/me

Aktif kullanıcının bilgilerini ve güncel izinlerini döndürür. Frontend permission cache invalidation için kullanır.

**Response 200:** Login response'undaki `user` objesinin aynısı.

## 6.4 Users Endpoints

### 6.4.1 GET /users

Kullanıcı listesini döndürür. Pagination, filtreleme ve arama destekler.

**Yetki:** `users.view`

**Query Params:**
- `page`, `page_size`, `sort`, `order`
- `is_active` (true/false)
- `role_id`
- `search` (email veya isimde arama)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "email": "user@example.com",
      "first_name": "Adem",
      "last_name": "Yavuz",
      "phone": "+90 531 ...",
      "department": "Pazarlama",
      "role": { "id": 2, "name": "Pazarlama Analisti", "color": "#3b82f6" },
      "is_active": true,
      "last_login_at": "2026-04-15T08:30:00Z",
      "created_at": "2026-03-20T10:15:00Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total_items": 12, "total_pages": 1 }
}
```

### 6.4.2 GET /users/{id}

Tek bir kullanıcının detayını döndürür.

**Yetki:** `users.view`

### 6.4.3 POST /users

Yeni kullanıcı davet eder. Email ile davet linki gönderilir. Aynı request'te kullanıcıya özel rol oluşturulabilir.

**Yetki:** `users.create`

**Request (Yeni rol oluşturarak):**
```json
{
  "user": {
    "email": "yeni@example.com",
    "first_name": "Mehmet",
    "last_name": "Demir",
    "phone": "+90 ...",
    "department": "E-Ticaret"
  },
  "role_action": "create_new",
  "new_role": {
    "name": "E-Ticaret Yöneticisi",
    "description": "E-Ticaret operasyonları yönetimi",
    "color": "#10b981",
    "icon": "🛒",
    "permissions": ["dashboard.view", "ecommerce.view", "products.view", "imports.view", "imports.create"]
  }
}
```

**Request (Mevcut role atayarak):**
```json
{
  "user": { ... },
  "role_action": "assign_existing",
  "role_id": 3
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "invitation_sent": true
  }
}
```

### 6.4.4 PATCH /users/{id}

Kullanıcı bilgilerini günceller.

**Yetki:** `users.update`

### 6.4.5 DELETE /users/{id}

Kullanıcıyı soft delete eder. Aktif token'ları revoke edilir.

**Yetki:** `users.delete`

### 6.4.6 POST /users/{id}/deactivate

Kullanıcıyı pasifleştirir (silmez).

**Yetki:** `users.update`

### 6.4.7 POST /users/{id}/activate

Pasif kullanıcıyı tekrar aktifleştirir.

**Yetki:** `users.update`

### 6.4.8 POST /users/{id}/reset-password

Süper Admin kullanıcının şifresini zorla sıfırlatır. Kullanıcıya yeni şifre belirleme linki gönderilir.

**Yetki:** `users.reset_password`

## 6.5 Roles Endpoints

### 6.5.1 GET /roles

Tüm rolleri listeler. Süper Admin sistem rolü dahil edilir, ancak silinebilir veya düzenlenebilir gösterilmez.

**Yetki:** `roles.view`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Süper Admin",
      "description": "Sistem yöneticisi",
      "color": "#E63946",
      "icon": "👑",
      "is_system": true,
      "user_count": 1,
      "permission_count": 37,
      "created_at": "2026-03-14T00:00:00Z"
    },
    {
      "id": 2,
      "name": "Pazarlama Analisti",
      "color": "#3b82f6",
      "icon": "📊",
      "is_system": false,
      "user_count": 3,
      "permission_count": 15,
      "created_at": "2026-03-20T10:00:00Z"
    }
  ]
}
```

### 6.5.2 GET /roles/{id}

Tek rolün tüm izin listesiyle birlikte detayını döndürür.

**Yetki:** `roles.view`

### 6.5.3 POST /roles

Yeni rol oluşturur (kullanıcı atamadan).

**Yetki:** `roles.create`

### 6.5.4 PATCH /roles/{id}

Rol bilgilerini ve izinlerini günceller.

**Yetki:** `roles.update`

**Request:**
```json
{
  "name": "Yeni Rol Adı",
  "description": "...",
  "color": "#10b981",
  "icon": "🎯",
  "permissions": ["dashboard.view", "traffic.view", "imports.view"]
}
```

Permission değişikliği ile birlikte, bu role atanmış tüm kullanıcıların permission cache'i Redis'ten silinir. Bu sayede yeni izinler bir sonraki istekte yansır.

### 6.5.5 DELETE /roles/{id}

Rolü siler. O role atanmış kullanıcılar pasifleştirilir.

**Yetki:** `roles.delete`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Rol silindi",
    "deactivated_users": [
      "user1@example.com",
      "user2@example.com"
    ],
    "deactivated_count": 2
  }
}
```

Süper Admin rolü silinemez. Denenirse 403 hatası döner.

## 6.6 Permissions Endpoints

### 6.6.1 GET /permissions

Tüm sistem izinlerini kategori bazlı gruplanmış olarak döndürür.

**Yetki:** `roles.view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "key": "view",
        "label": "Veri Görüntüleme",
        "permissions": [
          { "code": "dashboard.view", "module": "dashboard", "action": "view", "description": "Genel Özet sayfasını görüntüleme" },
          { "code": "traffic.view", ... }
        ]
      },
      {
        "key": "data",
        "label": "Veri İşlemleri",
        "permissions": [...]
      },
      {
        "key": "admin",
        "label": "Kullanıcı ve Rol Yönetimi",
        "permissions": [...]
      },
      {
        "key": "system",
        "label": "Sistem ve Loglar",
        "permissions": [...]
      }
    ]
  }
}
```

## 6.7 Imports Endpoints

### 6.7.1 POST /imports

Yeni veri import işlemi başlatır (dosya yükleme).

**Yetki:** `imports.create`

**Request:** `multipart/form-data`
```
file: <dosya>
data_type: "ga4_traffic" (opsiyonel, otomatik tespit edilir)
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "import_id": 42,
    "status": "pending",
    "file_name": "ga4_april_2026.csv",
    "file_size": 4823100,
    "detected_type": "ga4_traffic",
    "next_step": "preview"
  }
}
```

### 6.7.2 GET /imports

Import geçmişini listeler.

**Yetki:** `imports.view`

**Query Params:** `status`, `data_type`, `user_id`, `date_from`, `date_to`, pagination

### 6.7.3 GET /imports/{id}

Tek bir import işleminin detayını döndürür.

**Yetki:** `imports.view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "user": { "id": 7, "email": "..." },
    "file_name": "ga4_april_2026.csv",
    "file_size": 4823100,
    "data_type": "ga4_traffic",
    "status": "completed",
    "progress_percentage": 100,
    "total_rows": 8420,
    "valid_rows": 8411,
    "invalid_rows": 9,
    "skipped_rows": 0,
    "inserted_rows": 8411,
    "duplicate_strategy": "skip",
    "started_at": "2026-04-15T14:23:00Z",
    "completed_at": "2026-04-15T14:25:30Z",
    "duration_seconds": 150,
    "created_at": "2026-04-15T14:23:00Z"
  }
}
```

### 6.7.4 GET /imports/{id}/status

Import işleminin anlık durumunu döndürür. Frontend polling ile bu endpoint'i her 2 saniyede bir çağırır.

**Yetki:** `imports.view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "validating",
    "progress_percentage": 65,
    "current_step": "Verileri doğrulama",
    "rows_processed": 5460,
    "rows_total": 8420,
    "estimated_seconds_remaining": 12,
    "errors_count": 4
  }
}
```

### 6.7.5 GET /imports/{id}/preview

Yüklenen dosyanın ilk 100 satırını önizleme olarak döndürür.

**Yetki:** `imports.view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "headers": ["date", "sessionSource", "sessionMedium", "sessions", "totalUsers", ...],
    "rows": [
      ["20260315", "google", "organic", "1250", "980", ...],
      ...
    ],
    "total_rows": 8420,
    "preview_count": 100,
    "detected_type": "ga4_traffic"
  }
}
```

### 6.7.6 POST /imports/{id}/map-columns

Kolon eşleme yapısını kaydeder. Otomatik eşleme önerisi veya manuel eşleme kullanılır.

**Yetki:** `imports.create`

**Request:**
```json
{
  "mappings": [
    { "source": "date", "target": "date" },
    { "source": "sessionSource", "target": "session_source" },
    { "source": "sessionMedium", "target": "session_medium" },
    { "source": "sessions", "target": "sessions" }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "auto_suggested_count": 12,
    "manual_count": 3,
    "missing_required_fields": [],
    "ready_for_validation": true
  }
}
```

### 6.7.7 POST /imports/{id}/validate

Import edilen veriyi doğrular (commit etmeden). Hatalı satırları raporlar.

**Yetki:** `imports.create`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_rows": 8420,
    "valid_rows": 8411,
    "invalid_rows": 9,
    "duplicate_rows": 245,
    "errors_summary": [
      { "code": "INVALID_DATE_FORMAT", "count": 5, "sample_rows": [123, 456, 789] },
      { "code": "MISSING_REQUIRED_FIELD", "count": 4, "sample_rows": [200, 300, 400, 500] }
    ],
    "duplicates_detected": true,
    "next_action_required": "duplicate_strategy"
  }
}
```

### 6.7.8 POST /imports/{id}/commit

Doğrulanan veriyi MySQL'e yazar.

**Yetki:** `imports.create`

**Request:**
```json
{
  "duplicate_strategy": "skip",
  "error_strategy": "skip"
}
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "import_id": 42,
    "status": "committing",
    "message": "Veri yazma işlemi başladı, /status endpoint'i ile takip edin"
  }
}
```

### 6.7.9 GET /imports/{id}/errors

Hatalı satırların detaylarını listeler.

**Yetki:** `imports.view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "row_number": 123,
        "field_name": "date",
        "error_code": "INVALID_DATE_FORMAT",
        "error_message": "Tarih formatı geçersiz: 2026/04/15 (beklenen YYYYMMDD)",
        "row_data": { "date": "2026/04/15", "sessionSource": "google", ... }
      }
    ],
    "total_errors": 9
  }
}
```

### 6.7.10 GET /imports/{id}/errors/download

Hatalı satırları CSV dosyası olarak indirir.

**Yetki:** `imports.view`

**Response:** `Content-Type: text/csv` ile dosya indirme.

### 6.7.11 POST /imports/{id}/cancel

Aktif import işlemini iptal eder.

**Yetki:** `imports.create`

### 6.7.12 DELETE /imports/{id}

Import işlemini geri alır (rollback). Bu import ile yazılmış tüm satırlar silinir, aggregation tabloları yeniden hesaplanır.

**Yetki:** `imports.delete`

## 6.8 Mappings Endpoints

### 6.8.1 GET /mappings/channels

Tüm channel mapping kayıtlarını listeler.

**Yetki:** `mappings.view`

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "source": "google", "medium": "organic", "channel_group": "Organic Search", "is_auto_assigned": false },
    { "id": 2, "source": "facebook", "medium": "cpc", "channel_group": "Paid Social", "is_auto_assigned": false }
  ],
  "meta": {
    "auto_assigned_count": 3,
    "needs_review": true
  }
}
```

### 6.8.2 POST /mappings/channels

Yeni channel mapping ekler.

**Yetki:** `mappings.create`

### 6.8.3 PATCH /mappings/channels/{id}

Mevcut mapping'i günceller.

**Yetki:** `mappings.update`

### 6.8.4 DELETE /mappings/channels/{id}

Mapping'i siler.

**Yetki:** `mappings.delete`

## 6.9 KPI Endpoints

### 6.9.1 GET /kpi/summary

KPI özet metriklerini döndürür. Filtre parametrelerini kabul eder.

**Yetki:** `dashboard.view` (veya ilgili sayfanın view yetkisi)

**Query Params:**
- `date_from`, `date_to` (ISO 8601)
- `compare_to`: `previous_period` veya `previous_year` (opsiyonel)
- `channel`, `device`, `city` (filtreler)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2026-04-01",
      "to": "2026-04-30",
      "days": 30
    },
    "comparison_period": {
      "from": "2026-03-02",
      "to": "2026-03-31",
      "days": 30
    },
    "kpis": {
      "sessions": {
        "value": 187420,
        "previous_value": 161300,
        "change_percentage": 16.2,
        "trend": "up"
      },
      "users": {
        "value": 142840,
        "previous_value": 121400,
        "change_percentage": 17.7,
        "trend": "up"
      },
      "revenue": {
        "value": 4872340.50,
        "previous_value": 4210500.00,
        "change_percentage": 15.7,
        "trend": "up",
        "unit": "TRY"
      },
      "roas": {
        "value": 11.42,
        "previous_value": 10.85,
        "change_percentage": 5.3,
        "trend": "up",
        "unit": "x"
      }
    }
  }
}
```

### 6.9.2 POST /kpi/run

KPI hesaplama süreçlerini manuel olarak tetikler. Aggregation tablolarını yeniden hesaplar.

**Yetki:** `imports.create` veya `settings.update`

## 6.10 Dashboard Endpoints

### 6.10.1 GET /dashboard/trend

Zaman serisi trend verilerini döndürür.

**Yetki:** `dashboard.view`

**Query Params:** `metric` (revenue, sessions, orders, ...), `granularity` (daily, weekly, monthly), tarih ve filtre params

**Response 200:**
```json
{
  "success": true,
  "data": {
    "metric": "revenue",
    "granularity": "daily",
    "series": [
      { "date": "2026-04-01", "value": 145320.50 },
      { "date": "2026-04-02", "value": 162840.00 },
      ...
    ]
  }
}
```

### 6.10.2 GET /dashboard/channel-performance

Kanal bazlı performans verilerini döndürür.

**Yetki:** `dashboard.view`

### 6.10.3 GET /dashboard/platform-performance

Platform bazlı (Meta, Google) performans.

**Yetki:** `dashboard.view`

### 6.10.4 GET /dashboard/campaign-performance

Kampanya bazlı performans tablosu.

**Yetki:** `campaigns.view`

### 6.10.5 GET /dashboard/funnel

Funnel analizi verilerini döndürür (view → cart → checkout → purchase).

**Yetki:** `funnel.view`

### 6.10.6 GET /dashboard/cohort

Cohort matrisini döndürür (kullanıcıların ilk siparişe göre retention).

**Yetki:** `cohort.view`

**Query Params:** `cohort_period` (week/month), `metric` (retention/revenue)

### 6.10.7 GET /dashboard/products

Ürün performans verilerini döndürür.

**Yetki:** `products.view`

## 6.11 Filters Endpoints

### 6.11.1 GET /filters/options

Filtreler için kullanılabilir değerleri döndürür (dropdown'ları doldurmak için).

**Yetki:** `dashboard.view`

**Query Params:** `field` (channel, device, city, campaign, vb.)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channel": ["Organic Search", "Paid Search", "Paid Social", "Direct", "Email", "Referral"],
    "device": ["mobile", "desktop", "tablet"],
    "city": ["Istanbul", "Ankara", "Izmir", "Bursa", ...],
    "payment_method": ["credit_card", "debit_card", "bank_transfer", "pay_at_door"]
  }
}
```

## 6.12 Segments Endpoints

### 6.12.1 GET /segments

Kullanıcının kayıtlı segmentlerini listeler.

**Yetki:** `segments.view`

### 6.12.2 POST /segments

Yeni segment oluşturur.

**Yetki:** `segments.create`

**Request:**
```json
{
  "name": "VIP Mobile İstanbul",
  "description": "Mobile cihazdan alışveriş yapan İstanbul'lu VIP müşteriler",
  "rules": {
    "logic": "AND",
    "conditions": [
      { "field": "total_orders", "operator": ">=", "value": 5 },
      { "field": "city", "operator": "=", "value": "Istanbul" },
      { "field": "total_revenue", "operator": ">=", "value": 5000 }
    ]
  }
}
```

### 6.12.3 GET /segments/{id}/preview

Segment kurallarına uyan müşteri sayısını ve örnek müşterileri döndürür.

**Yetki:** `segments.view`

### 6.12.4 POST /segments/preview

Henüz kaydedilmemiş bir segment için önizleme yapar (debounced kullanım için).

**Yetki:** `segments.view`

### 6.12.5 GET /segments/{id}/kpi

Belirli bir segment için KPI hesaplamaları döndürür.

**Yetki:** `segments.view`

### 6.12.6 PATCH /segments/{id}

Segment'i günceller.

**Yetki:** `segments.update`

### 6.12.7 DELETE /segments/{id}

Segment'i siler (soft delete).

**Yetki:** `segments.delete`

## 6.13 Saved Views Endpoints

### 6.13.1 GET /views

Kullanıcının kayıtlı görünümlerini listeler.

**Yetki:** `views.view`

**Query Params:** `page` (overview, traffic, vb.)

### 6.13.2 POST /views

Yeni view kaydeder (mevcut filtrelerle).

**Yetki:** `views.create`

### 6.13.3 PATCH /views/{id}

View'ı günceller.

**Yetki:** `views.update`

### 6.13.4 DELETE /views/{id}

View'ı siler.

**Yetki:** `views.delete`

## 6.14 Export Endpoints

### 6.14.1 GET /export/raw

Filtrelenmiş ham veriyi export eder. Boyuta göre sync veya async çalışır.

**Yetki:** `export.csv`

**Query Params:** `format` (csv/json/xlsx), `data_type` (ga4_traffic, meta_ads, vb.), filtreler

**Response (sync, < 50K satır):**
- 200 OK + dosya indirme

**Response (async, ≥ 50K satır):**
```json
{
  "success": true,
  "data": {
    "job_id": 123,
    "status": "queued",
    "message": "Export hazırlandığında email ile link gönderilecek"
  }
}
```

### 6.14.2 GET /export/kpi-summary

KPI özet verilerini export eder.

**Yetki:** `export.csv`

### 6.14.3 GET /export/channel-performance

Kanal performansını export eder.

### 6.14.4 GET /export/campaign-performance

Kampanya performansını export eder.

### 6.14.5 GET /export/jobs/{id}/status

Async export işleminin durumunu kontrol eder.

### 6.14.6 GET /export/jobs/{id}/download

Async export sonucunu indirir.

## 6.15 Logs Endpoints

### 6.15.1 GET /logs/api

API loglarını döndürür.

**Yetki:** `logs.view_api`

### 6.15.2 GET /logs/audit

Audit loglarını döndürür.

**Yetki:** `logs.view_audit`

**Query Params:** `user_id`, `action`, `resource_type`, `date_from`, `date_to`

### 6.15.3 GET /logs/imports

Import loglarını döndürür (imports tablosundan beslenir).

**Yetki:** `logs.view_imports`

## 6.16 Health Endpoints

### 6.16.1 GET /health

Sistemin genel sağlık durumunu döndürür.

**Yetki:** Public (token gerektirmez)

**Response 200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 432000
}
```

### 6.16.2 GET /health/db

Database sağlık kontrolü.

### 6.16.3 GET /health/redis

Redis sağlık kontrolü.

### 6.16.4 GET /health/celery

Celery worker durum kontrolü.

## 6.17 Hata Kodları Sözlüğü

Frontend tarafından i18n çevirisi için kullanılan hata kodları:

| Hata Kodu | HTTP Status | Açıklama |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Token eksik veya geçersiz |
| `TOKEN_EXPIRED` | 401 | Access token süresi doldu |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token geçersiz |
| `INVALID_CREDENTIALS` | 401 | Email veya şifre hatalı |
| `ACCOUNT_LOCKED` | 423 | Hesap kilitli |
| `ACCOUNT_DEACTIVATED` | 403 | Hesap pasif |
| `PERMISSION_DENIED` | 403 | Yetki yok |
| `RESOURCE_NOT_FOUND` | 404 | Kaynak bulunamadı |
| `EMAIL_DUPLICATE` | 409 | Email zaten kullanılıyor |
| `VALIDATION_ERROR` | 422 | Validasyon hatası (genel) |
| `PASSWORD_TOO_SHORT` | 422 | Şifre 10 karakterden kısa |
| `PASSWORD_NO_UPPERCASE` | 422 | Büyük harf yok |
| `PASSWORD_NO_LOWERCASE` | 422 | Küçük harf yok |
| `PASSWORD_NO_NUMBER` | 422 | Rakam yok |
| `PASSWORD_TOO_COMMON` | 422 | Yaygın şifre |
| `INVALID_EMAIL_FORMAT` | 422 | Email formatı geçersiz |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit aşıldı |
| `FILE_TOO_LARGE` | 422 | Dosya 50 MB'dan büyük |
| `INVALID_FILE_FORMAT` | 422 | Desteklenmeyen format |
| `IMPORT_IN_PROGRESS` | 409 | Aktif import var |
| `INVALID_DATE_FORMAT` | 422 | Tarih formatı geçersiz |
| `MISSING_REQUIRED_FIELD` | 422 | Zorunlu alan eksik |
| `DUPLICATE_RECORD` | 409 | Duplicate kayıt |
| `ROLE_HAS_USERS` | 409 | Role atanmış kullanıcı var (silme öncesi) |
| `CANNOT_DELETE_SYSTEM_ROLE` | 403 | Sistem rolü silinemez |
| `INTERNAL_ERROR` | 500 | Sunucu hatası |
| `SERVICE_UNAVAILABLE` | 503 | Servis geçici olarak kullanılamıyor |

## 6.18 Swagger / OpenAPI Dokümantasyonu

FastAPI otomatik olarak Swagger UI ve ReDoc dokümantasyonu üretir.

**Swagger UI:** `https://dashboard.sporthink.com.tr/api/docs`

**ReDoc:** `https://dashboard.sporthink.com.tr/api/redoc`

**OpenAPI JSON:** `https://dashboard.sporthink.com.tr/api/openapi.json`

Production'da Swagger UI yalnızca authenticated kullanıcılar için açıktır (anonim erişim engellenir).

## 6.19 Sonraki Bölüm

Bu bölümde tüm API endpoint'leri ve standartları detaylı olarak ele alındı. Sonraki bölümde, frontend tasarımı, component library ve UI/UX kararları detaylandırılacaktır.

**Sonraki Bölüm:** [07 - Frontend Tasarım ve UI/UX](07-frontend-design.md)

*Bölüm 06 sonu.*
