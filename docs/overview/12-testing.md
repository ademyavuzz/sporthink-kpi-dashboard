# 12. TEST STRATEJİSİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, sistemin kalite güvencesini sağlayan test stratejisini detaylı olarak ele almaktadır. Unit test, integration test, E2E test piramidi, kullanılan kütüphaneler, coverage hedefleri, test verisi yönetimi ve sürekli entegrasyon detayları belgelenmiştir.

## 12.1 Test Felsefesi

Sporthink KPI Dashboard test stratejisi üç temel ilke üzerine kurulmuştur:

**Test Pyramid:** Unit testler en altta (çok sayıda, hızlı), integration testler ortada (orta sayıda), E2E testler tepede (az sayıda, yavaş ama yüksek güven). Bu yapı hem hız hem de güven dengesi sunar.

**Critical Path First:** Sınırlı 11 haftalık zaman çerçevesinde her satır kodu test etmek mümkün değildir. Bu nedenle iş açısından kritik olan path'lere (auth, RBAC, KPI hesaplama, import) yoğunlaşılır.

**Regression Coverage:** Bir kez bulunan ve düzeltilen bir bug için mutlaka test yazılır. Aynı bug ileride tekrar ortaya çıkarsa otomatik yakalanır.

```
                    ┌──────────┐
                    │   E2E    │  ~10 test, slow, high confidence
                    │  Tests   │
                    └──────────┘
                ┌──────────────────┐
                │   Integration    │  ~50 test, medium speed
                │      Tests        │
                └──────────────────┘
        ┌──────────────────────────────┐
        │         Unit Tests            │  ~200+ test, fast
        │   (Backend + Frontend)        │
        └──────────────────────────────┘
```

## 12.2 Coverage Hedefleri

| Katman | Hedef Coverage | Açıklama |
|---|---|---|
| Backend Services | %80+ | Tüm iş mantığı katmanı |
| Backend API Endpoints | %70+ | Critical path %100 |
| Backend Repository | %60+ | Basit CRUD'lar düşük coverage'da kalabilir |
| Frontend Components | %60+ | Visual elements düşük, logic-heavy yüksek |
| Frontend Hooks | %80+ | Tüm custom hook'lar |
| Frontend Stores | %90+ | State management kritik |
| **Overall** | **%70+** | Genel hedef |

CI pipeline coverage düşünce build fail edilir. PR merge için minimum %70 coverage zorunludur.

## 12.3 Backend Test Stratejisi

### 12.3.1 Pytest Framework

Tüm backend testleri **pytest** ile yazılır. async test desteği için `pytest-asyncio`, coverage için `pytest-cov` kullanılır.

`backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts =
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=70
    -v
```

### 12.3.2 Test Klasör Yapısı

```
backend/tests/
├── conftest.py              # Pytest fixtures (DB, client, auth)
├── unit/
│   ├── services/
│   │   ├── test_auth_service.py
│   │   ├── test_kpi_service.py
│   │   ├── test_segment_service.py
│   │   └── ...
│   ├── repositories/
│   │   └── ...
│   └── utils/
│       ├── test_jwt.py
│       ├── test_password.py
│       └── test_normalize.py
├── integration/
│   ├── test_auth_flow.py
│   ├── test_import_flow.py
│   ├── test_kpi_flow.py
│   ├── test_rbac.py
│   └── ...
├── fixtures/
│   ├── sample_ga4_traffic.csv
│   ├── sample_meta_ads.csv
│   └── sample_orders.csv
└── helpers/
    ├── auth_helper.py
    └── data_factory.py
```

### 12.3.3 Pytest Fixtures

`backend/tests/conftest.py`:

```python
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from httpx import AsyncClient

from app.main import app
from app.dependencies import get_db
from app.models.base import Base

TEST_DATABASE_URL = "mysql+aiomysql://user:pass@localhost/sporthink_test"

@pytest.fixture(scope="session")
def event_loop():
    """Pytest-asyncio için event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def engine():
    """Test DB engine."""
    engine = create_async_engine(TEST_DATABASE_URL)

    # Tüm tabloları oluştur
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Test sonrası temizlik
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    """Her test için fresh DB session."""
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()  # Test sonrası rollback

@pytest.fixture
async def client(db_session):
    """Authenticated HTTP client."""
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
async def super_admin(db_session):
    """Test için Süper Admin kullanıcı."""
    from app.models import User, Role
    from app.utils.password import hash_password

    role = Role(name="Süper Admin", is_system=True)
    db_session.add(role)
    await db_session.flush()

    user = User(
        email="admin@test.com",
        password_hash=hash_password("TestPass123"),
        first_name="Admin",
        last_name="Test",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
async def auth_headers(client, super_admin):
    """Login yapıp token header döner."""
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123",
    })
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### 12.3.4 Unit Test Örnekleri

**Şifre Hash'leme Testi:**

```python
# tests/unit/utils/test_password.py
import pytest
from app.utils.password import hash_password, verify_password

def test_hash_password_creates_unique_hash():
    """Aynı şifre için her hash farklı olmalı (salt nedeniyle)."""
    password = "TestPass123"
    hash1 = hash_password(password)
    hash2 = hash_password(password)
    assert hash1 != hash2

def test_verify_password_correct():
    """Doğru şifre verify edilmeli."""
    password = "TestPass123"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True

def test_verify_password_wrong():
    """Yanlış şifre reject edilmeli."""
    hashed = hash_password("TestPass123")
    assert verify_password("WrongPass", hashed) is False

def test_hash_format():
    """Bcrypt hash $2b$ ile başlamalı."""
    hashed = hash_password("TestPass123")
    assert hashed.startswith("$2b$")
```

**KPI Hesaplama Testi:**

```python
# tests/unit/services/test_kpi_service.py
import pytest
from datetime import date
from app.services.kpi_service import calculate_bounce_rate, calculate_roas

def test_bounce_rate_normal():
    """Normal bounce rate hesaplama."""
    result = calculate_bounce_rate(bounce_sessions=300, total_sessions=1000)
    assert result == 30.0

def test_bounce_rate_zero_sessions():
    """0 oturum için bounce rate 0 olmalı (ZeroDivisionError değil)."""
    result = calculate_bounce_rate(bounce_sessions=0, total_sessions=0)
    assert result == 0.0

def test_roas_calculation():
    """ROAS = revenue / spend."""
    result = calculate_roas(revenue=1000.00, spend=200.00)
    assert result == 5.0

def test_roas_zero_spend():
    """0 harcama için ROAS None olmalı (sonsuz değil)."""
    result = calculate_roas(revenue=1000.00, spend=0)
    assert result is None
```

**Veri Normalizasyon Testi:**

```python
# tests/unit/utils/test_normalize.py
from datetime import date
from app.utils.normalize import normalize_date, normalize_channel

def test_normalize_date_iso_format():
    assert normalize_date("2026-04-15") == date(2026, 4, 15)

def test_normalize_date_ga4_format():
    assert normalize_date("20260415") == date(2026, 4, 15)

def test_normalize_date_turkish_format():
    assert normalize_date("15/04/2026") == date(2026, 4, 15)

def test_normalize_date_invalid():
    with pytest.raises(InvalidDateFormatError):
        normalize_date("not-a-date")

def test_normalize_channel_known(db_session):
    result = normalize_channel("google", "organic", db_session)
    assert result == "Organic Search"

def test_normalize_channel_unknown_creates_other(db_session):
    """Bilinmeyen source/medium 'Other' olarak kaydedilmeli."""
    result = normalize_channel("unknownsource", "unknownmedium", db_session)
    assert result == "Other"
    # Yeni mapping oluşturulduğunu doğrula
    mapping = db_session.query(ChannelMapping).filter_by(
        source="unknownsource", medium="unknownmedium"
    ).first()
    assert mapping is not None
    assert mapping.is_auto_assigned is True
```

### 12.3.5 Integration Test Örnekleri

**Login Flow:**

```python
# tests/integration/test_auth_flow.py
import pytest

@pytest.mark.asyncio
async def test_login_success(client, super_admin):
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123",
    })
    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert data["user"]["email"] == "admin@test.com"

@pytest.mark.asyncio
async def test_login_wrong_password(client, super_admin):
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "WrongPass",
    })
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"

@pytest.mark.asyncio
async def test_login_account_lockout(client, super_admin):
    """5 yanlış denemede hesap kilitlenmeli."""
    for i in range(5):
        await client.post("/api/v1/auth/login", json={
            "email": "admin@test.com",
            "password": "WrongPass",
        })

    # 6. deneme - hesap kilitli olmalı
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123",  # Doğru şifre bile çalışmamalı
    })
    assert response.status_code == 423
    assert response.json()["error"]["code"] == "ACCOUNT_LOCKED"

@pytest.mark.asyncio
async def test_refresh_token_flow(client, super_admin):
    # Login
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123",
    })
    refresh_cookie = response.cookies.get("refresh_token")

    # Refresh
    response = await client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": refresh_cookie}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]
```

**Import Flow:**

```python
# tests/integration/test_import_flow.py
@pytest.mark.asyncio
async def test_import_csv_success(client, auth_headers, db_session):
    # 1. Upload
    with open("tests/fixtures/sample_ga4_traffic.csv", "rb") as f:
        response = await client.post(
            "/api/v1/imports",
            headers=auth_headers,
            files={"file": ("ga4.csv", f, "text/csv")},
        )

    assert response.status_code == 202
    import_id = response.json()["data"]["import_id"]

    # 2. Preview
    response = await client.get(
        f"/api/v1/imports/{import_id}/preview",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["data"]["detected_type"] == "ga4_traffic"

    # 3. Validate
    response = await client.post(
        f"/api/v1/imports/{import_id}/validate",
        headers=auth_headers,
    )
    assert response.status_code == 200

    # 4. Commit
    response = await client.post(
        f"/api/v1/imports/{import_id}/commit",
        headers=auth_headers,
        json={"duplicate_strategy": "skip", "error_strategy": "skip"},
    )
    assert response.status_code == 202

    # 5. Status check (polling simulation)
    # Celery sync mode'da çalışıyorsa hemen completed
    response = await client.get(
        f"/api/v1/imports/{import_id}/status",
        headers=auth_headers,
    )
    assert response.json()["data"]["status"] == "completed"

@pytest.mark.asyncio
async def test_import_too_large_rejected(client, auth_headers):
    """50 MB üzeri dosya reddedilmeli."""
    large_data = b"a" * (51 * 1024 * 1024)  # 51 MB
    response = await client.post(
        "/api/v1/imports",
        headers=auth_headers,
        files={"file": ("large.csv", large_data, "text/csv")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"
```

**RBAC Test:**

```python
# tests/integration/test_rbac.py
@pytest.mark.asyncio
async def test_user_without_permission_cannot_access(client, db_session):
    # Sadece dashboard.view yetkisi olan kullanıcı
    user = await create_user_with_permissions(db_session, ["dashboard.view"])
    headers = await get_auth_headers(client, user)

    # Users endpoint'ine erişim denemesi (users.view yetkisi yok)
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"

@pytest.mark.asyncio
async def test_super_admin_has_all_permissions(client, auth_headers):
    """Süper Admin tüm endpoint'lere erişebilmeli."""
    endpoints = [
        "/api/v1/users",
        "/api/v1/roles",
        "/api/v1/imports",
        "/api/v1/logs/audit",
        "/api/v1/settings",
    ]

    for endpoint in endpoints:
        response = await client.get(endpoint, headers=auth_headers)
        assert response.status_code != 403, f"Forbidden on {endpoint}"
```

## 12.4 Frontend Test Stratejisi

### 12.4.1 Vitest Framework

Frontend testleri **Vitest** ile yazılır. React component testleri için **@testing-library/react**, mocking için **MSW (Mock Service Worker)** kullanılır.

`frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
      exclude: ['node_modules/', 'tests/', 'src/main.tsx'],
    },
  },
});
```

### 12.4.2 Test Klasör Yapısı

```
frontend/tests/
├── setup.ts                  # Global test setup
├── mocks/
│   ├── handlers.ts           # MSW handlers
│   └── server.ts
├── unit/
│   ├── stores/
│   │   ├── authStore.test.ts
│   │   └── filtersStore.test.ts
│   ├── hooks/
│   │   ├── usePermissions.test.ts
│   │   └── useDebounce.test.ts
│   └── utils/
│       └── format.test.ts
└── components/
    ├── KpiCard.test.tsx
    ├── FilterChip.test.tsx
    └── ...
```

### 12.4.3 Component Test Örnekleri

**KPI Card:**

```typescript
// tests/components/KpiCard.test.tsx
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/kpi/KpiCard';

describe('KpiCard', () => {
  test('değeri doğru gösterir', () => {
    render(
      <KpiCard
        label="Toplam Oturum"
        value={187420}
        previousValue={161300}
      />
    );

    expect(screen.getByText('Toplam Oturum')).toBeInTheDocument();
    expect(screen.getByText('187,4K')).toBeInTheDocument();
  });

  test('pozitif trend yeşil renkte gösterilir', () => {
    render(
      <KpiCard
        label="Sessions"
        value={100}
        previousValue={80}
      />
    );

    const trend = screen.getByText(/25%/);
    expect(trend).toHaveClass('text-success');
  });

  test('inverseTrend için yukarı kötü, aşağı iyi', () => {
    render(
      <KpiCard
        label="Bounce Rate"
        value={70}
        previousValue={50}
        inverseTrend
      />
    );

    // Artış kötü olmalı (kırmızı)
    const trend = screen.getByText(/40%/);
    expect(trend).toHaveClass('text-error');
  });

  test('previousValue olmadan delta gösterilmez', () => {
    render(<KpiCard label="Sessions" value={100} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
```

**Filter Chip:**

```typescript
// tests/components/FilterChip.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChip } from '@/components/filters/FilterChip';

test('chip x butonuna basınca onRemove tetiklenir', () => {
  const handleRemove = vi.fn();
  render(
    <FilterChip
      label="Cihaz"
      value="Mobile"
      onRemove={handleRemove}
    />
  );

  const removeButton = screen.getByRole('button', { name: /kaldır/i });
  fireEvent.click(removeButton);

  expect(handleRemove).toHaveBeenCalledTimes(1);
});
```

### 12.4.4 Hook Test Örnekleri

```typescript
// tests/unit/hooks/usePermissions.test.ts
import { renderHook } from '@testing-library/react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ user: null });
});

test('Süper Admin tüm permission\'lara sahip', () => {
  useAuthStore.setState({
    user: {
      id: 1,
      email: 'admin@test.com',
      role: { id: 1, name: 'Süper Admin', isSystem: true },
      permissions: [],
    },
  });

  const { result } = renderHook(() => usePermissions());

  expect(result.current.has('users.delete')).toBe(true);
  expect(result.current.has('any.permission')).toBe(true);
});

test('normal kullanıcı sadece kendi izinlerine sahip', () => {
  useAuthStore.setState({
    user: {
      id: 2,
      email: 'user@test.com',
      role: { id: 2, name: 'Analist', isSystem: false },
      permissions: ['dashboard.view', 'traffic.view'],
    },
  });

  const { result } = renderHook(() => usePermissions());

  expect(result.current.has('dashboard.view')).toBe(true);
  expect(result.current.has('users.delete')).toBe(false);
});
```

### 12.4.5 Store Test Örnekleri

```typescript
// tests/unit/stores/filtersStore.test.ts
import { useFiltersStore } from '@/stores/filtersStore';

beforeEach(() => {
  useFiltersStore.setState({
    globalFilters: {},
    crossFilters: {},
  });
});

test('addCrossFilter yeni filtre ekler', () => {
  useFiltersStore.getState().addCrossFilter('overview', 'device', 'mobile');

  const state = useFiltersStore.getState();
  expect(state.crossFilters.device).toContain('mobile');
});

test('removeCrossFilter filtre kaldırır', () => {
  useFiltersStore.setState({
    crossFilters: { device: ['mobile'], channel: ['paid_search'] },
  });

  useFiltersStore.getState().removeCrossFilter('device');

  const state = useFiltersStore.getState();
  expect(state.crossFilters.device).toBeUndefined();
  expect(state.crossFilters.channel).toEqual(['paid_search']);
});

test('clearCrossFilters tüm cross-filter\'ları temizler', () => {
  useFiltersStore.setState({
    crossFilters: { device: ['mobile'], channel: ['paid_search'] },
  });

  useFiltersStore.getState().clearCrossFilters();

  expect(useFiltersStore.getState().crossFilters).toEqual({});
});
```

### 12.4.6 MSW ile API Mock'lama

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json();

    if (body.email === 'admin@test.com' && body.password === 'TestPass123') {
      return HttpResponse.json({
        success: true,
        data: {
          access_token: 'mock-jwt-token',
          user: { id: 1, email: 'admin@test.com' },
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS' } },
      { status: 401 }
    );
  }),

  http.get('/api/v1/kpi/summary', () => {
    return HttpResponse.json({
      success: true,
      data: {
        kpis: {
          sessions: { value: 187420, previous_value: 161300 },
          revenue: { value: 4872340.50, previous_value: 4210500.00 },
        },
      },
    });
  }),
];
```

## 12.5 E2E Test Stratejisi

### 12.5.1 Playwright Framework

End-to-end testler için **Playwright** kullanılır. MVP kapsamında ~10 critical journey test edilir.

`frontend/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 12.5.2 E2E Senaryolar

**Senaryo 1: Login Flow**

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('kullanıcı login olabilir ve dashboard\'a gider', async ({ page }) => {
  await page.goto('/login');

  await page.fill('[name="email"]', 'admin@test.com');
  await page.fill('[name="password"]', 'TestPass123');
  await page.click('button[type="submit"]');

  // Dashboard'a yönlendirilmeli
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Genel Özet');
});

test('yanlış şifre hata mesajı gösterir', async ({ page }) => {
  await page.goto('/login');

  await page.fill('[name="email"]', 'admin@test.com');
  await page.fill('[name="password"]', 'WrongPassword');
  await page.click('button[type="submit"]');

  await expect(page.locator('.error-message')).toContainText('Email veya şifre hatalı');
});
```

**Senaryo 2: Filtre Uygulama**

```typescript
// e2e/filters.spec.ts
test('global tarih filtresi tüm KPI\'ları günceller', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');

  // İlk değer
  const initialRevenue = await page.locator('[data-testid="kpi-revenue"]').textContent();

  // Tarih filtresini değiştir
  await page.click('[data-testid="date-picker"]');
  await page.click('button:has-text("Son 7 gün")');

  // Loading skeleton bekle
  await page.waitForSelector('[data-testid="kpi-revenue"]:not(.loading)');

  // Değer değişmeli
  const newRevenue = await page.locator('[data-testid="kpi-revenue"]').textContent();
  expect(newRevenue).not.toBe(initialRevenue);
});
```

**Senaryo 3: Veri Import**

```typescript
// e2e/import.spec.ts
test('CSV dosyası başarıyla import edilir', async ({ page }) => {
  await login(page);
  await page.goto('/import');

  // 1. Dosya yükle
  await page.setInputFiles('input[type="file"]', './fixtures/sample_ga4.csv');

  // 2. Mapping adımı
  await expect(page.locator('h2')).toContainText('Kolon Eşleme');
  await page.click('button:has-text("İleri")');

  // 3. Validate adımı
  await page.waitForSelector('[data-testid="validation-summary"]');
  await page.click('button:has-text("İleri")');

  // 4. Commit
  await page.click('button:has-text("Veriyi Yaz")');

  // Tamamlanma bekle
  await page.waitForSelector('[data-testid="import-success"]', { timeout: 30000 });
  await expect(page.locator('[data-testid="import-success"]')).toContainText('başarıyla');
});
```

**Senaryo 4: Cross-Filter**

```typescript
test('pie chart\'a tıklayınca cross-filter aktif olur', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/traffic');

  // Pie chart'taki Mobile dilimine tıkla
  await page.click('[data-testid="device-pie-chart"] [data-name="Mobile"]');

  // Filter chip görünmeli
  await expect(page.locator('[data-testid="filter-chip-device"]')).toContainText('Mobile');

  // KPI'lar yeniden yüklenmeli (loading state)
  await page.waitForSelector('[data-testid="kpi-card"]:not(.loading)');
});
```

## 12.6 Test Verisi Yönetimi

### 12.6.1 Fixture Dosyaları

Test için kullanılan örnek CSV/JSON dosyaları `tests/fixtures/` altında saklanır.

```
backend/tests/fixtures/
├── sample_ga4_traffic.csv      (100 satır)
├── sample_meta_ads.csv          (50 satır)
├── sample_google_ads.csv        (50 satır)
├── sample_orders.csv            (200 satır)
├── sample_customers.csv         (100 satır)
├── invalid_dates.csv            (hatalı veri)
├── duplicates.csv               (duplicate test için)
└── too_large.csv                (50 MB+ test)
```

### 12.6.2 Data Factory

Pythontaki Factory pattern ile test verisi üretimi:

```python
# tests/helpers/data_factory.py
from faker import Faker
from app.models import User, Customer, Order

fake = Faker('tr_TR')

class UserFactory:
    @staticmethod
    def create(db_session, **overrides):
        defaults = {
            'email': fake.email(),
            'first_name': fake.first_name(),
            'last_name': fake.last_name(),
            'password_hash': hash_password('TestPass123'),
        }
        defaults.update(overrides)
        user = User(**defaults)
        db_session.add(user)
        return user

class OrderFactory:
    @staticmethod
    def create(db_session, customer_id, **overrides):
        defaults = {
            'order_id': fake.uuid4(),
            'order_date': fake.date_between(start_date='-30d', end_date='today'),
            'customer_id': customer_id,
            'order_revenue': fake.pydecimal(left_digits=4, right_digits=2, positive=True),
            'order_status': 'completed',
            'payment_method': fake.random_element(['credit_card', 'debit_card']),
        }
        defaults.update(overrides)
        order = Order(**defaults)
        db_session.add(order)
        return order
```

### 12.6.3 Test DB Seed

Her test session başında baseline verisi seed edilir:

```python
@pytest.fixture(scope="session", autouse=True)
async def seed_database(engine):
    """Test session başında base data seed et."""
    async with AsyncSession(engine) as session:
        # Permissions
        for perm in PERMISSIONS_LIST:
            session.add(Permission(**perm))

        # Channel mappings
        for mapping in DEFAULT_CHANNEL_MAPPINGS:
            session.add(ChannelMapping(**mapping))

        await session.commit()
```

## 12.7 CI/CD Entegrasyonu

GitHub Actions test pipeline'ı:

```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.4
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: sporthink_test
        ports: ['3306:3306']
        options: --health-cmd="mysqladmin ping" --health-interval=10s
      redis:
        image: redis:7.4-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt -r requirements-dev.txt

      - name: Lint
        run: |
          cd backend
          ruff check .

      - name: Run tests
        env:
          TEST_DATABASE_URL: mysql+aiomysql://root:root@localhost/sporthink_test
          REDIS_URL: redis://localhost:6379/0
        run: |
          cd backend
          pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: backend/coverage.xml
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Lint
        run: |
          cd frontend
          npm run lint

      - name: Type check
        run: |
          cd frontend
          npm run typecheck

      - name: Run tests
        run: |
          cd frontend
          npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: frontend/coverage/lcov.info
          flags: frontend

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }

      - name: Install Playwright
        run: |
          cd frontend
          npm ci
          npx playwright install --with-deps chromium

      - name: Start backend (Docker)
        run: docker compose -f docker-compose.test.yml up -d

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## 12.8 Manual Testing Checklist

Otomatize testlerin yanı sıra her release öncesi yapılması gereken manuel testler:

**Authentication & RBAC:**
- [ ] Süper Admin login olabilir
- [ ] Yanlış şifre hesabı kilitler (5 deneme sonra)
- [ ] Şifremi unuttum email gönderir
- [ ] Reset link 30 dk sonra geçersiz olur
- [ ] Logout sonrası refresh token revoke olur
- [ ] Permission değişikliği bir sonraki API isteğinde yansır

**Dashboard:**
- [ ] Tüm 11 sayfa hatasız açılır
- [ ] Light/Dark tema geçişi sorunsuz çalışır
- [ ] TR/EN dil değişimi tüm metinleri çevirir
- [ ] Filtreler URL'e yansır, refresh sonrası korunur

**Import:**
- [ ] CSV/JSON/XLSX dosyaları başarıyla import edilir
- [ ] 50 MB üzeri dosya reddedilir
- [ ] Hatalı satırlar raporlanır, CSV indirilebilir
- [ ] Duplicate strategy seçenekleri doğru çalışır
- [ ] Rollback işlemi veriyi temizler, KPI'ları günceller

**Performance:**
- [ ] Dashboard ilk yükleme <3 sn
- [ ] KPI sorguları <500 ms
- [ ] Cross-filter etkileşim <300 ms

**Browser Compatibility:**
- [ ] Chrome (son 2 versiyon)
- [ ] Firefox (son 2 versiyon)
- [ ] Safari (son 2 versiyon)
- [ ] Edge (son 2 versiyon)

## 12.9 Sonraki Bölüm

Bu bölümde sistemin test stratejisi detaylı olarak ele alındı. Sonraki bölümde, projenin 11 haftalık zaman planı ve sprint detayları belgelenecektir.

**Sonraki Bölüm:** [13 - Proje Planı ve Zaman Çizelgesi](13-project-plan.md)

*Bölüm 12 sonu.*
