# Sporthink KPI Dashboard

> Pazarlama ve E-Ticaret performansını **31 KPI** üzerinden tek noktada izleyen,
> 9 dashboard sayfalı internal SaaS uygulaması — sporthink.com.tr için.

[![CI](https://img.shields.io/badge/tests-passing-green)]() [![Coverage](https://img.shields.io/badge/backend-44_tests-blue)]() [![License](https://img.shields.io/badge/license-Internal-yellow)]()

## Özet

- **4 veri kaynağı:** GA4 (trafik) + Meta Ads + Google Ads + E-Ticaret
- **31 KPI:** trafik, reklam, satış, pazarlama performansı (`docs/overview/09`)
- **9 dashboard sayfası:** Overview, Traffic, Meta, Google, E-Ticaret, Campaign, Funnel, Cohort, Products
- **CSV import wizard:** drag-drop, 4 adımlı, FK otomatik resolve, dedup, hata raporu CSV indirme
- **RBAC:** 43 izin, Süper Admin sistem rolü, audit log
- **Segmentasyon:** Visual rule builder + RFM-bazlı hazır segmentler
- **i18n:** TR (default) + EN, dayjs Europe/Istanbul TZ
- **Tema:** Light/Dark, semantic CSS variables

## Hızlı Başlangıç (Geliştirme)

```bash
# Repo'yu klonla
git clone git@github.com:ademyavuzz/sporthink-kpi-dashboard.git
cd sporthink-kpi-dashboard

# Env dosyasını hazırla
cp .env.example .env

# Tüm stack'i ayağa kaldır
docker compose -f docker-compose.dev.yml up -d

# Süper Admin oluştur (idempotent)
docker compose -f docker-compose.dev.yml exec backend python -m app.seed
```

Erişim:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api/docs
- **DB:** localhost:3306 (sporthink_dashboard)
- **Redis:** localhost:6379

Login: `admin@sporthink.local` / `.env`'deki `SUPER_ADMIN_PASSWORD`.

## Tech Stack

| Katman | Stack |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 (async) · Pydantic 2 · Celery 5 · Alembic |
| Veri | MySQL 8.4 LTS · Redis 7.4 |
| Frontend | React 19 · Vite 6 · TypeScript 5.7 (strict) · Tailwind 4 · shadcn/ui · ApexCharts |
| State | Zustand · TanStack Query · React Hook Form + Zod |
| Test | pytest · Vitest · Playwright (E2E hazır) |
| Lint | Ruff · ESLint 9 + Prettier |
| Altyapı | Docker 27 · Docker Compose 2.30 · Nginx · Let's Encrypt |

Detay: `docs/overview/02-tech-stack.md`.

## Klasör Yapısı

```
sporthink-kpi-dashboard/
├── CLAUDE.md              # Proje çapı kurallar (agent-driven dev)
├── README.md              # Bu dosya
├── docs/overview/         # 16 markdown spec — TEK doğru kaynak
├── backend/               # FastAPI + Celery + MySQL
│   ├── app/
│   │   ├── api/v1/        # Router'lar (HTTP)
│   │   ├── services/      # İş mantığı + KPI formülleri
│   │   ├── repositories/  # SQLAlchemy sorguları
│   │   ├── models/        # ORM
│   │   ├── schemas/       # Pydantic
│   │   ├── parsers/       # CSV parser + 10 source config
│   │   ├── tasks/         # Celery (aggregation rebuild)
│   │   └── core/          # permissions, security, cache_keys
│   ├── alembic/versions/
│   ├── db/init/01-baseline.sql
│   └── tests/             # 44 unit test
├── frontend/              # React 19 + Vite + Tailwind + shadcn
│   ├── src/
│   │   ├── pages/         # 9 dashboard + 4 admin + 2 import
│   │   ├── components/    # KPICard, charts, layout
│   │   ├── lib/api/       # Axios wrapper
│   │   ├── stores/        # Zustand (auth, theme, filters)
│   │   └── types/
│   └── public/locales/    # i18n (TR/EN)
├── nginx/                 # Production reverse proxy + SSL
├── mysql/my.cnf           # Production DB tuning
├── scripts/deploy.sh      # Production deploy script
├── docker-compose.dev.yml # Geliştirme stack
└── docker-compose.prod.yml # Production override
```

## 9 Dashboard Sayfası

| Sayfa | İçerik |
|---|---|
| **Overview** | 9 KPI summary + revenue trend + kanal donut + funnel + new/returning + top 10 ürün |
| **Traffic** | 7 GA4 KPI + günlük oturum trendi + kanal/cihaz/şehir kırılımları |
| **Meta Ads** | 8 Meta KPI + harcama vs gelir trendi + kampanya tablosu |
| **Google Ads** | 8 Google KPI + harcama vs gelir trendi + kampanya tablosu |
| **E-Ticaret** | 7 KPI + günlük ciro & sipariş + kanal donut + new/returning + top 20 müşteri |
| **Campaigns** | Tüm kampanyalar × ROAS/CTR/CPA, platform filtresi (Meta/Google) |
| **Funnel** | View → Cart → Checkout → Purchase huni + drop-off oranları |
| **Cohort** | Kayıt ayı × ay-N retention heatmap |
| **Products** | Top 20 ürün + kategori/marka kırılımı |

## Veri Akışı

```
[CSV Upload]
   ↓
[Parser (10 source config)] — header diff, type coerce, dedup, FK lookup
   ↓
[10 raw tablo] — products, customers, campaigns, orders, order_items,
                 ga4_traffic, ga4_item_engagement, meta_ads,
                 meta_ads_breakdowns, google_ads
   ↓
[Aggregation rebuild (Celery)] — UPSERT
   ↓
[3 aggregation tablosu] — kpi_daily/monthly/campaign
   ↓
[KPI Service] — 31 formül, NULL semantik, trend yönü
   ↓
[Redis cache (5dk TTL)] — kpi_summary, dashboard pages
   ↓
[Dashboard endpoints] — 9 page × full payload
   ↓
[Frontend] — KPI cards + ApexCharts + tablo
```

## Test

```bash
# Backend
docker compose -f docker-compose.dev.yml exec backend pytest -q
# 44 passed

# Frontend
docker compose -f docker-compose.dev.yml exec frontend npx vitest run
# 18 passed

# Type check
docker compose -f docker-compose.dev.yml exec frontend npx tsc --noEmit
docker compose -f docker-compose.dev.yml exec backend ruff check .
```

## Production Deployment

VDS (Ubuntu 24.04 LTS) üzerine:

```bash
# İlk kurulum
ssh prod-vds
cd /opt && git clone <repo>
cd sporthink-kpi-dashboard
cp .env.production.example .env  # değerleri doldur
./scripts/deploy.sh --init

# Sonraki güncellemeler
./scripts/deploy.sh --update
```

Detay: `DEPLOY.md`, `docs/overview/11-deployment.md`.

## Lisans

Sporthink Sport Apparel'a aittir. Internal kullanım. Akademik bitirme projesi
olarak DEÜ YBS bölümüne sunulmuştur.

## Katkı

Proje **single-developer agent-driven** olarak Claude Code ile geliştirilmiştir.
Yeni özellik veya bug fix için kök `CLAUDE.md` dosyasındaki kuralları takip et.

---

**Geliştirici:** Adem Yavuz · DEÜ YBS · Bitirme projesi · Mart-Mayıs 2026
**Akademik danışman:** Prof. Dr. Vahap Tecim
**Sektör sponsoru:** Sporthink Sport Apparel
