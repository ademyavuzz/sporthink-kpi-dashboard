# CLAUDE.md — Sporthink Frontend

> Kök `/CLAUDE.md`'yi okuduğun varsayılır. Bu dosya **frontend'e özel** kuralları içerir.
> Frontend altında çalışıyorsan bu dosyadaki her kural geçerlidir.

---

## 1. Stack Özeti

- **Framework:** React 19 (Concurrent rendering, Actions API, `use()` hook)
- **Build:** Vite 6 (ESBuild + Rollup)
- **Dil:** TypeScript 5.7 (strict mode AÇIK)
- **Styling:** TailwindCSS 4 (Oxide engine, CSS-first config) + shadcn/ui
- **Charts:** ApexCharts 4 (`react-apexcharts` wrapper)
- **Client State:** Zustand 5
- **Server State:** TanStack Query 5 (React Query)
- **Forms:** React Hook Form 7 + Zod 3 (validation)
- **i18n:** i18next + react-i18next (TR default, EN secondary)
- **Routing:** React Router v7 (lazy-loaded routes)
- **HTTP:** Axios 1 (single instance + interceptors)
- **Date:** dayjs 1.11 (TZ + locale plugin)
- **Test:** Vitest 2 + @testing-library/react 16
- **Lint/Format:** ESLint 9 + Prettier 3

> **Not:** Yukarıdaki versiyonlar hızlı referans amaçlıdır. Kesin versiyonlar `package.json` içindedir; çelişki varsa `package.json` doğrudur.

Detay: `docs/overview/02-tech-stack.md` §2.3, `docs/overview/07-frontend-design.md`

---

## 2. Klasör Yapısı

```
frontend/
├── public/
│   └── locales/
│       ├── tr/           # Türkçe çeviriler (DEFAULT)
│       │   ├── common.json
│       │   ├── kpi.json
│       │   ├── auth.json
│       │   ├── errors.json
│       │   └── <namespace>.json
│       └── en/           # İngilizce çeviriler (1:1 yansıma)
│
├── src/
│   ├── main.tsx          # Vite entry — providers (i18n, query, theme, router)
│   ├── App.tsx           # Root: <ErrorBoundary> + <Routes>
│   │
│   ├── pages/            # Route component'leri (sayfa = route)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── error/        # 403, 404, 500
│   │
│   ├── components/
│   │   ├── ui/           # shadcn primitives (npx shadcn add ile gelir)
│   │   ├── feature/      # Domain component'ler (KPICard, FunnelChart)
│   │   ├── layout/       # Sidebar, TopBar, PageHeader
│   │   └── common/       # ErrorBoundary, EmptyState, LoadingSpinner
│   │
│   ├── hooks/            # Custom hook'lar (usePermissions, useDebounce)
│   ├── stores/           # Zustand store'ları (useAuthStore, vb.)
│   │
│   ├── lib/
│   │   ├── api/          # API client'lar (her domain için bir dosya)
│   │   │   ├── client.ts # axios instance + interceptors
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   └── kpi.ts
│   │   ├── i18n.ts       # i18next config
│   │   ├── dayjs.ts      # dayjs config (locale + TZ)
│   │   ├── permissions.ts # Permission enum (backend ile senkron)
│   │   └── utils.ts      # cn(), formatters
│   │
│   ├── types/            # Global TypeScript tipleri
│   │   ├── api.ts        # API response shape'leri
│   │   ├── kpi.ts
│   │   └── domain.ts
│   │
│   └── styles/
│       └── globals.css   # Tailwind directives + CSS variables (theme)
│
├── tests/                # Vitest testleri (component bazlı)
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── eslint.config.js
└── package.json
```

**Her klasör için "ne girer / ne girmez":**

| Klasör | Girer | Girmez |
|---|---|---|
| `pages/` | Route component, layout composition, üst seviye data fetching (TanStack Query) | Reusable component, business logic |
| `components/feature/` | Domain'e özgü component (KPICard, AdsCampaignTable) | Sayfa, route logic, shadcn primitive |
| `components/ui/` | shadcn primitives (`Button`, `Dialog`, `Input`) | Manuel yazılmış primitive (her zaman shadcn add) |
| `hooks/` | Reusable custom hook | Component, side-effect-only logic |
| `stores/` | Zustand store + selector | Server state (TanStack Query'de) |
| `lib/api/` | Axios fetch fonksiyonları, TypeScript dönüş tipleri | Component, hook |
| `lib/` | Saf util'ler, config | Component, store |
| `types/` | Global tip tanımları | Component-local tip (component dosyasında) |

---

## 3. Component Hiyerarşisi

```
pages/dashboard/TrafficPage.tsx        ← Route, data fetching, layout
  └── components/layout/PageHeader     ← Reusable layout
  └── components/feature/KPISummary    ← Domain component
        └── components/feature/KPICard ← Domain component
              └── components/ui/Card   ← shadcn primitive
```

**Kural:** Component yukarı doğru sadece **callback** ve **data** geçer; aşağı doğru sadece **props** akar. Üst component'in state'ini alt component **doğrudan değiştirmez**.

### 3.1 shadcn Primitive Kullanımı

- `components/ui/` altındaki dosyalar **kopya kod**. Manuel düzenleme yapılabilir, ama yapıldığında PR description'da belirt.
- Yeni primitive eklemek için: `npx shadcn@latest add <component>`. Manuel oluşturma yasak.
- shadcn variant'ından sapma için **yeni variant ekle** (cva ile), inline style override yapma.

### 3.2 Feature Component Yazma

```tsx
// components/feature/KPICard.tsx
interface KPICardProps {
  kpiId: string;
  value: number | null;
  previousValue: number | null;
  unit: 'currency' | 'percent' | 'count';
  trendDirectionPositive: 'up' | 'down';
  loading?: boolean;
}

export function KPICard({ kpiId, value, previousValue, unit, trendDirectionPositive, loading }: KPICardProps) {
  const { t } = useTranslation('kpi');
  if (loading) return <KPICardSkeleton />;
  if (value === null) return <EmptyState message={t('no_data')} />;
  // ...
}
```

- Props interface **her zaman üstte ve named** (default export anonymous yasak).
- Loading, empty, error state'leri **HER feature component'te** ele alınır.
- Sayfa state'inden component bağımsız → reusable.

---

## 4. STATE MANAGEMENT KARARI (Hangi Ne Zaman)

Bu karar **kritik**. Yanlış state yöneticisi seçimi performans ve maintainability sorunu yaratır.

| State Türü | Araç | Örnek |
|---|---|---|
| **Server state** (API'den gelen, cache'lenmesi gereken) | **TanStack Query** | KPI sonuçları, kullanıcı listesi, import durumu |
| **Global client state** (cross-component, persist) | **Zustand store** | Auth (user, token), theme, dil, global filtreler |
| **URL state** (paylaşılabilir, geri tuşuyla geri gelebilir) | **searchParams** | Sayfa numarası, filtre, tab |
| **Component-local UI state** (geçici, tek component) | **useState** | Modal açık/kapalı, input draft, hover |
| **Form state** | **React Hook Form** | Tüm form'lar |

### 4.1 Server State → TanStack Query

```tsx
// hooks/queries/useKPISummary.ts
export function useKPISummary(filters: KPIFilter) {
  return useQuery({
    queryKey: ['kpi', 'summary', filters],
    queryFn: () => kpiApi.getSummary(filters),
    staleTime: 5 * 60 * 1000, // 5 dakika (backend cache TTL ile aynı)
  });
}
```

- **Server state ASLA Zustand'da tutulmaz.** Cache invalidation, refetch, optimistic update kaybedilir.
- Query key formatı: `['domain', 'action', ...params]` (sıralı, deterministik).
- Mutation sonrası ilgili query'leri invalidate et:
  ```tsx
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
  ```

### 4.2 Client State → Zustand Store

Mevcut store'lar (yenisi gerekiyorsa burada listele):

| Store | Amaç |
|---|---|
| `useAuthStore` | `user`, `accessToken`, `login()`, `logout()` |
| `useThemeStore` | `theme: 'light' \| 'dark'`, `toggleTheme()` |
| `useLanguageStore` | `lang: 'tr' \| 'en'`, `setLanguage()` |
| `useFiltersStore` | Global cross-page filtreler (date range, kanal) |
| `useToastStore` | `notify(...)` (sonner wrapper) |
| `useSidebarStore` | `collapsed: boolean` |

```tsx
// stores/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,  // ⚠️ token persist edilirse XSS riski — bkz §17
      setAuth: (user, accessToken) => set({ user, accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: 'auth', partialize: (s) => ({ user: s.user }) }, // sadece user persist
  ),
);
```

- Selector kullan: `const user = useAuthStore((s) => s.user)`. Tüm store'u almak gereksiz re-render üretir.

### 4.3 URL State → searchParams

```tsx
// pages/dashboard/TrafficPage.tsx
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get('page') ?? '1');
const channel = searchParams.get('channel') ?? 'all';
```

Filtreler URL'de olmazsa kullanıcı paylaştığında veya yenilediğinde kaybolur. **Paylaşılabilir state URL'de.**

---

## 5. Forms — React Hook Form + Zod

### 5.1 Standart Pattern

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email({ message: 'errors.email_invalid' }),
  password: z.string().min(10, { message: 'errors.password_too_short' }),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    await authApi.login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('email')} aria-invalid={!!errors.email} />
      {errors.email && <p>{t(errors.email.message!)}</p>}
      <Button type="submit" disabled={isSubmitting}>{t('login.submit')}</Button>
    </form>
  );
}
```

### 5.2 Kurallar

- **Manuel `useState` ile form yönetimi YASAK.** Her form RHF.
- Zod schema → backend Pydantic schema ile **alan adları ve kuralları senkron**. Sapma varsa backend doğrudur.
- Hata mesajları **i18n key** (string değil), `t()` ile render.
- Submit handler `async`. Loading state RHF'den (`formState.isSubmitting`), manuel state tutma.
- Network hatası `try/catch` + toast (`useToastStore`).

---

## 6. API Client (Axios + TanStack Query)

### 6.1 Tek Axios Instance — `lib/api/client.ts`

```tsx
import axios from 'axios';
import { useAuthStore } from '@/stores/useAuthStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // refresh token cookie için
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const { data } = await apiClient.post('/auth/refresh');
        useAuthStore.getState().setAuth(data.user, data.access_token);
        return apiClient(error.config);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
```

### 6.2 Domain API Modülleri — `lib/api/<domain>.ts`

```tsx
// lib/api/kpi.ts
import { apiClient } from './client';
import type { KPISummary, KPIFilter } from '@/types/kpi';

export const kpiApi = {
  async getSummary(filters: KPIFilter): Promise<KPISummary> {
    const { data } = await apiClient.post<{ success: true; data: KPISummary }>(
      '/kpi/summary',
      filters,
    );
    return data.data;
  },
};
```

- **Her API fonksiyonu typed** (return type explicit).
- Backend `{ success, data }` wrapper'ı **burada açılır**, component direkt veriyi alır.
- Hata → axios interceptor ile globalde, ek olarak component-level `useQuery`'nin `error` field'ı.

### 6.3 Query Key Konvansiyonu

| Pattern | Örnek |
|---|---|
| `[domain]` | `['users']` — tüm user listesi |
| `[domain, id]` | `['users', 42]` — tek user |
| `[domain, action, params]` | `['kpi', 'summary', { dateRange, channel }]` |

Filter object'i query key'de olunca, filter değişince otomatik refetch olur. **Bu doğru davranış.**

---

## 7. i18n DİSİPLİNİ (Kritik)

`docs/overview/07-frontend-design.md` referans.

### 7.1 Hardcode String YASAK

```tsx
// ❌ YASAK
<Button>Kaydet</Button>
<p>Şifre en az 10 karakter olmalı</p>
toast.error('Bir hata oluştu');

// ✅ DOĞRU
<Button>{t('common.save')}</Button>
<p>{t('errors.password_too_short')}</p>
toast.error(t('errors.unknown'));
```

### 7.2 Namespace Stratejisi

| Namespace | Kapsam |
|---|---|
| `common` | Genel (Save, Cancel, Loading, Yes, No) |
| `auth` | Login, register, password reset |
| `kpi` | KPI isimleri, açıklamalar, birimler |
| `errors` | Tüm error code → human message mapping |
| `<page-name>` | Sayfa-spesifik string'ler (örn: `dashboard`, `users`, `imports`) |

```tsx
const { t } = useTranslation('kpi');
// Sayfa-spesifik:
const { t } = useTranslation(['users', 'common']);
```

### 7.3 Yeni Key Eklerken

1. `public/locales/tr/<namespace>.json`'a TR ekle.
2. `public/locales/en/<namespace>.json`'a EN ekle (**aynı anda**).
3. CI script'i (`scripts/check-i18n-keys.ts`) eksik karşılığı varsa fail eder.

### 7.4 Pluralization

```json
// tr/common.json
{
  "items_count": "{{count}} öğe",
  "items_count_plural": "{{count}} öğe"   // TR'de plural form yok, ama yine de key var
}
// en/common.json
{
  "items_count": "{{count}} item",
  "items_count_plural": "{{count}} items"
}
```

```tsx
t('common.items_count', { count: 5 })
```

`if (n === 1) ... else ...` ile manuel pluralization **yasak**.

### 7.5 Hata Mesajı Yerelleştirme

Backend'den gelen `error.code` (örn: `PASSWORD_TOO_SHORT`) → `errors.json`'da karşılığı:

```json
{
  "PASSWORD_TOO_SHORT": "Şifre en az {{min}} karakter olmalı",
  "EMAIL_ALREADY_EXISTS": "Bu e-posta zaten kayıtlı"
}
```

```tsx
const message = t(`errors.${error.code}`, error.params);
```

Yeni backend error code → frontend `errors.json`'a aynı PR'da eklenir.

---

## 8. Theme Kuralları

### 8.1 Renk Hardcode YASAK

```tsx
// ❌ YASAK
<div className="bg-[#1a1a1a] text-[#fff]">
<div style={{ backgroundColor: '#3b82f6' }}>

// ✅ DOĞRU (semantic CSS variable)
<div className="bg-background text-foreground">
<div className="bg-primary text-primary-foreground">
```

### 8.2 Theme Token'ları

`styles/globals.css` içinde tek noktada:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 221 83% 53%;
    --primary-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --destructive: 0 84% 60%;
    /* ... */
  }
  .dark {
    --background: 222 47% 11%;
    --foreground: 0 0% 100%;
    /* ... */
  }
}
```

shadcn'in tüm component'leri bu token'ları kullanır. **Yeni token gerekiyorsa** `globals.css`'e ekle, component'te elle hex yazma.

### 8.3 Dark Mode

- Strategy: **class-based** (`tailwind.config` → `darkMode: 'class'`).
- `useThemeStore` `theme` değiştiğinde `<html>` element'ine `.dark` class ekler/kaldırır.
- localStorage'a persist (`prefers-color-scheme` ile başlangıç default).

### 8.4 Chart Renkleri

ApexCharts theme-aware olmalı:

```tsx
// hooks/useChartTheme.ts
export function useChartTheme() {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => ({
    colors: ['hsl(var(--primary))', 'hsl(var(--secondary))', ...],
    theme: { mode: theme },
    grid: { borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7' },
  }), [theme]);
}
```

---

## 9. Routing ve Route Guards

### 9.1 Lazy Loading (Her Sayfa)

```tsx
// App.tsx
import { lazy, Suspense } from 'react';

const TrafficPage = lazy(() => import('@/pages/dashboard/TrafficPage'));

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/traffic" element={<ProtectedRoute permission="traffic.view"><TrafficPage /></ProtectedRoute>} />
  </Routes>
</Suspense>
```

Bundle splitting otomatik — her sayfa ayrı chunk.

### 9.2 ProtectedRoute Wrapper

```tsx
// components/common/ProtectedRoute.tsx
interface ProtectedRouteProps {
  permission: string;
  children: ReactNode;
}

export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const { has } = usePermissions();

  if (!user) return <Navigate to="/login" replace />;
  if (!has(permission)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
```

- **Her route'da `permission` prop zorunlu.** İstisna: login, forgot-password, reset-password, 403, 404.
- `usePermissions` hook'u backend'den gelen permission listesi üzerinden çalışır (cache: TanStack Query, `staleTime: 5min`).
- **Frontend permission kontrolü sadece UX içindir.** Asıl güvenlik backend'de — bu kuralı atlatma.

### 9.3 404 ve 403 Sayfaları

`pages/error/NotFoundPage.tsx`, `pages/error/ForbiddenPage.tsx`. Her zaman mount, fallback route.

---

## 10. Charts (ApexCharts)

### 10.1 Wrapper Pattern

Her chart tipi için `components/feature/charts/<ChartType>.tsx`:

```tsx
interface FunnelChartProps {
  data: FunnelStep[];
  loading?: boolean;
  onStepClick?: (step: FunnelStep) => void;
}

export function FunnelChart({ data, loading, onStepClick }: FunnelChartProps) {
  const theme = useChartTheme();
  if (loading) return <ChartSkeleton type="funnel" />;
  if (data.length === 0) return <EmptyState message={t('charts.no_data')} />;

  const options: ApexOptions = {
    ...theme,
    chart: {
      events: { dataPointSelection: (_, __, config) => onStepClick?.(data[config.dataPointIndex]) },
    },
    // ...
  };
  return <ReactApexChart options={options} series={[{ data }]} type="bar" />;
}
```

### 10.2 Zorunlu State'ler

Her chart wrapper **3 durumu** ele almalı:
- Loading (skeleton)
- Empty (`data.length === 0` → `<EmptyState>`)
- Error (üst component handle eder, chart render edilmez)

### 10.3 Cross-filter Eventleri

Chart üzerine tıklama → `useFiltersStore` güncelle → diğer chart'lar otomatik refetch (TanStack Query key filter'a bağlı).

---

## 11. Date Handling

### 11.1 dayjs Konfigürasyonu

```tsx
// lib/dayjs.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Europe/Istanbul');

export { dayjs };
```

### 11.2 Format Kuralları

```tsx
// Backend UTC → kullanıcıya İstanbul saati
dayjs.utc(apiTimestamp).tz('Europe/Istanbul').format('DD.MM.YYYY HH:mm');

// Locale-aware
const lang = useLanguageStore((s) => s.lang);
dayjs(date).locale(lang).format('LLL');
```

### 11.3 Yasaklı Pattern'lar

```tsx
new Date('2026-05-03')        // ❌ TZ sorunları, parser belirsiz
Date.parse(...)                // ❌ Aynı
moment(...)                    // ❌ Moment kullanılmıyor, dayjs
```

---

## 12. Error Handling

### 12.1 Root Error Boundary

```tsx
// App.tsx
<ErrorBoundary FallbackComponent={ErrorPage} onError={logError}>
  <Routes>...</Routes>
</ErrorBoundary>
```

### 12.2 Network Hatası Akışı

1. Axios interceptor 401 → refresh token → otomatik retry.
2. Refresh başarısız → `clearAuth()` + `/login`'e yönlendirme.
3. 403 → toast + `/403` sayfası.
4. 404 → component-local handling (örn: "Kullanıcı bulunamadı" mesajı).
5. 422 (validation) → form alanına hata göster (RHF setError).
6. 500 → toast + Sentry/log servisi (varsa).

### 12.3 Toast Bildirimleri

```tsx
import { toast } from 'sonner';

toast.success(t('users.created'));
toast.error(t(`errors.${err.code}`));
toast.promise(saveAsync(), {
  loading: t('common.saving'),
  success: t('common.saved'),
  error: (e) => t(`errors.${e.code}`),
});
```

---

## 13. Accessibility (a11y)

shadcn/Radix tabanlı olduğu için temel a11y otomatik gelir, ama **şunlar manuel**:

- **Form alan label'ı:** `<Label htmlFor="email">` + `<Input id="email">`. Label yoksa `aria-label`.
- **Buton ikon-only:** `<Button aria-label={t('common.delete')}><Trash2 /></Button>`.
- **Modal açıldığında focus:** Radix Dialog otomatik yapar, ama özel modal yazıyorsan `useEffect` ile ilk focusable'a focus ver.
- **Klavye navigasyonu:** Tab order doğal DOM sırasını takip etsin. `tabIndex` manuel set etme (özel durum hariç).
- **Renk kontrast:** Dark mode'da metin/arkaplan kontrastı WCAG AA (4.5:1) sağlamalı. Theme token'ları zaten uyumlu.
- **`alt` attribute:** Tüm `<img>`'lerde. Dekoratif ise `alt=""`.

---

## 14. Test Disiplini

`docs/overview/12-testing.md` referans.

### 14.1 Vitest + React Testing Library

```tsx
// tests/components/KPICard.test.tsx
import { render, screen } from '@testing-library/react';
import { KPICard } from '@/components/feature/KPICard';

describe('KPICard', () => {
  it('shows skeleton when loading', () => {
    render(<KPICard kpiId="revenue" value={null} previousValue={null} unit="currency" trendDirectionPositive="up" loading />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when value is null and not loading', () => {
    render(<KPICard kpiId="revenue" value={null} previousValue={null} unit="currency" trendDirectionPositive="up" />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
```

### 14.2 Test Kapsamı

- **Critical user flow başına 1 integration testi:**
  - Login → Dashboard
  - Filter değiştir → KPI güncellenir
  - User create → listede görünür
  - Permission'sız sayfaya gitme → 403

- **shadcn primitive'leri test ETME** — zaten test edilmiş.
- **Custom hook'ları test et** (`renderHook` ile).
- **Pure util'leri test et** (formatters, validators).

### 14.3 Mock Stratejisi

- API çağrıları → `msw` (Mock Service Worker) ile intercept.
- Zustand store → test'te `useAuthStore.setState({ user: ... })` ile inject.
- TanStack Query → her test fresh `QueryClient` (`<QueryClientProvider>` wrapper).

---

## 15. Lint / Format / Type Safety

### 15.1 TypeScript Strict Mode

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- **`any` yasak.** Kullanmak için PR description'da gerekçe + `// eslint-disable-next-line` yorumu.
- **`unknown`** belirsiz tip için OK; sonra type narrow.
- Component prop'ları her zaman explicit interface.

### 15.2 ESLint + Prettier

- Pre-commit hook: `eslint --fix` + `prettier --write`.
- CI'da `npm run lint` ve `npm run typecheck` fail ederse merge edilemez.

### 15.3 Import Düzeni

```tsx
// 1. React ve framework
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. 3rd party
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Absolute (proje içi)
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';

// 4. Relative
import { KPICardSkeleton } from './KPICardSkeleton';

// 5. Tipler (varsa ayrı)
import type { KPIResult } from '@/types/kpi';
```

ESLint plugin (`eslint-plugin-import`) bu sırayı otomatik enforcement.

---

## 16. Sık Komutlar

```bash
# Dev server (HMR)
npm run dev                  # http://localhost:5173

# Production build
npm run build                # dist/ klasörüne
npm run preview              # build çıktısını lokalde test

# Test
npm test                     # watch mode
npm run test:run             # tek seferlik (CI)
npm run test:coverage        # coverage raporu

# Lint / Format / Typecheck
npm run lint
npm run lint:fix
npm run format
npm run typecheck            # tsc --noEmit

# shadcn primitive ekleme
npx shadcn@latest add dialog
npx shadcn@latest add command

# Bundle analizi
npm run build -- --mode analyze
```

---

## 17. Mutlak Yasaklar (Frontend)

| # | Yasak | Doğrusu |
|---|---|---|
| 1 | JWT access token'ı `localStorage`'a yazmak | In-memory (Zustand non-persisted) veya httpOnly cookie |
| 2 | `any` tipi (gerekçesiz) | `unknown` + narrow, veya doğru tip |
| 3 | Inline `style={{ color: '#xxx' }}` | Tailwind class veya CSS variable |
| 4 | Hardcoded renk (`bg-[#1a1a1a]`, `#fff`) | Semantic token (`bg-background`) |
| 5 | Hardcoded string (Türkçe veya İngilizce) | i18n key + `t()` |
| 6 | `useEffect` içinde async fonksiyon doğrudan çağırma | İç fonksiyon tanımla veya `useEffectEvent` |
| 7 | `console.log` production build'de | Pre-commit hook engeller; debug için `logger.debug()` |
| 8 | Manuel `useState` ile form yönetimi | React Hook Form |
| 9 | Server state'i Zustand store'da tutmak | TanStack Query |
| 10 | Tüm Zustand store'u almak (`useStore()`) | Selector (`useStore((s) => s.field)`) |
| 11 | `new Date(string)` ile parse | `dayjs(string, format)` |
| 12 | `moment` kullanımı | `dayjs` (tek date kütüphanesi) |
| 13 | Manuel shadcn primitive yazımı | `npx shadcn add ...` |
| 14 | `dangerouslySetInnerHTML` | Doğal React rendering — gerçekten gerekiyorsa sanitize (DOMPurify) + onay |
| 15 | Frontend'de KPI hesaplama | Backend'den çek, sadece formatla |
| 16 | Backend'de olmayan permission'a göre UI gizleme | Permission listesi backend'den; sapma yapma |
| 17 | `.env` değişkenini doğrudan koddan oku (Vite dışı yerden) | `import.meta.env.VITE_*` |
| 18 | Sensitive bilgi `.env`'de `VITE_` prefix ile (frontend bundle'a girer) | Backend'den expose et veya runtime config |
| 19 | Lazy loading olmadan büyük component import | `lazy()` + `Suspense` |
| 20 | İzin kontrolünü güvenlik amaçlı kullanmak | UX için OK; güvenlik backend'de |

---

*Bu dosya `/CLAUDE.md`'nin alt katmanıdır. Çelişki olursa kök dosya proje çapı kuralları için, bu dosya frontend implementasyon detayları için doğrudur.*
