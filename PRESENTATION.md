# Bitirme Sunumu — Slayt Outline

> 25-30 slayt · 30 dk sunum + 10 dk Q&A · 29 Mayıs 2026

## Slayt 1 — Kapak
- **Sporthink KPI Dashboard**
- Pazarlama ve E-Ticaret Performans Paneli
- Adem Yavuz · DEÜ YBS · 2026
- Akademik danışman: Prof. Dr. Vahap Tecim
- Sektör sponsoru: Sporthink Sport Apparel

## Slayt 2 — Problem
- Sporthink ekibi GA4, Meta Ads, Google Ads, e-ticaret datasını **3 farklı
  araçta ayrı** görüyor
- KPI'lar manuel Excel hesaplamasıyla derleniyor
- Karar verme yavaş (ortalama 2-3 gün gecikme)
- Sektörde mevcut araçlar (Looker, Tableau, Power BI) yıllık $5K+ lisans

## Slayt 3 — Çözüm
- **Tek noktada 31 KPI** — gerçek zamanlı dashboard
- Self-hosted, lisans ücreti yok
- Türkçe arayüz, KVKK uyumlu, internal kullanım

## Slayt 4 — Hedefler
- 4 veri kaynağını birleştir
- 9 dashboard sayfa, 31 KPI
- CSV import (canlı API entegrasyonu için Phase 2)
- 50 eşzamanlı kullanıcı, <500ms yanıt
- ~%75 backend test coverage

## Slayt 5 — Tech Stack
| Katman | Teknoloji | Sebep |
|---|---|---|
| Backend | FastAPI + SQLAlchemy 2 async | Modern Python, performans |
| Veri | MySQL 8.4 + Redis 7.4 | LTS, MySQL ekosistem yaygın |
| Frontend | React 19 + Vite + TS | Modern UI, type safety |
| UI | Tailwind 4 + shadcn/ui | Tasarım sistemi, hızlı |
| Charts | ApexCharts | TR locale, animasyon |
| State | Zustand + TanStack Query | Boilerplate az |

## Slayt 6 — Mimari Diagramı
```
[Browser] ↔ [Nginx (SSL)] ↔ [Backend (FastAPI)] ↔ [MySQL]
                                  ↓
                              [Redis (cache + queue)]
                                  ↓
                           [Celery Worker (aggregation)]
```

## Slayt 7 — Veri Modeli (kısa)
- 11 raw tablo (products, customers, orders, order_items, campaigns,
  ga4_traffic, ga4_item_engagement, meta_ads, meta_ads_breakdowns,
  google_ads, channel_mapping)
- 3 aggregation tablo (kpi_daily/monthly/campaign)
- 12 sistem tablo (users, roles, permissions, audit_logs, ...)
- ER diagram (önemli FK'lar)

## Slayt 8 — KPI Hesaplama Stratejisi
- **2 katmanlı:**
  1. Aggregation tabloları (Celery, ~saniyeler) — `kpi_daily_aggregates`
  2. Anlık sorgu (~ms) — Redis cache hit / aggregate SUM
- 31 KPI / 4 kategori (Trafik 8, Reklam 10, Satış 8, Pazarlama 5)
- NULL semantik: 0/0 → "veri yok" (sıfıra düşürmemek)
- Trend yönü her KPI'da farklı (revenue ↑ iyi, bounce_rate ↓ iyi)

## Slayt 9 — RBAC
- 37 izin enum'u — `app/core/permissions.py` tek doğru kaynak
- 4 kategori: Veri Görüntüleme (9), Veri İşlemleri (17),
  Kullanıcı/Rol (9), Sistem (5)
- Süper Admin → tüm izinleri otomatik bypass
- Frontend `<ProtectedRoute permission=...>` + backend `@require_permission`
- 5 dk Redis cache (rol değişiminde invalidate)

## Slayt 10 — DEMO 1: Login + Genel Özet
- Login akışı (JWT + refresh cookie)
- Overview: 9 KPI cards, trend chart, kanal donut

## Slayt 11 — DEMO 2: CSV Import
- 4 adımlı wizard
- Header diff, sample preview, dedup
- 47k satır 1-3 sn'de yüklenir

## Slayt 12 — DEMO 3: Dashboard Pages
- Traffic, Meta Ads, Google Ads, E-Ticaret sayfaları
- Tarih filtresi (12 preset), karşılaştırma toggle
- ApexCharts (line, donut, bar, funnel)

## Slayt 13 — DEMO 4: Cohort + RFM
- Cohort retention heatmap
- RFM segmentleri (Champions, Loyal, At Risk, Lost)
- Visual segment builder (rule-based)

## Slayt 14 — DEMO 5: Admin
- Kullanıcı davet (geçici şifre üretimi)
- Audit log
- Channel mapping CRUD

## Slayt 15 — Performans
- Overview endpoint: **140 ms** (cache miss), **5 ms** (cache hit)
- Cache hit rate: %70+ tipik kullanımda
- DB query time: <30 ms (aggregation üzerinden)
- Frontend bundle size: ~380 KB (gzip)
- Lighthouse: Performance 89, Accessibility 95

## Slayt 16 — Test
- Backend: 44 unit test (KPI helpers, parsers, RFM)
- Frontend: 18 unit test (formatters)
- Manual integration: 11 CSV → 181k satır, sıfır FK kayması
- TypeScript strict mode + ESLint + Ruff

## Slayt 17 — Güvenlik
- bcrypt cost 12 + JWT (15dk access + 7gün refresh)
- HTTPS only, HSTS, rate limit (login 5/dk)
- Audit log her kritik action
- KVKK: kişisel veri kolonu adları log'da, değer YOK
- CORS frontend_origin'e kısıtlı

## Slayt 18 — Sonuçlar (Sayısal)
- **47.000 satır CSV → 1 saniye** import
- **9 sayfa × ~140 ms** ilk yükleme
- **31 KPI × 4 kategori** çalışır halde
- Toplam **~10.000 satır kod** (backend + frontend)
- 11 hafta · 1 geliştirici (agent-driven)

## Slayt 19 — Sınırlılıklar
- v1: CSV manuel import (canlı API entegrasyonu Phase 2)
- 2FA / MFA yok
- Multi-tenant değil (tek mağaza)
- Real-time stream yok (5 dk cache TTL)
- Mobile native uygulama yok (responsive web)

## Slayt 20 — v2 Yol Haritası
- GA4/Meta/Google API doğrudan entegrasyon (manuel CSV kalkacak)
- Predictive analytics (BG/NBD modeli ile customer LTV)
- Otomatik anomali tespiti (revenue drop alert)
- Scheduled email reports (haftalık/aylık)
- Mobile native app (React Native)

## Slayt 21 — Öğrendiklerim (Akademik)
- Async Python ekosistemi (FastAPI, SQLAlchemy 2 async, asyncio)
- Modern React (concurrent rendering, Suspense, lazy)
- Production deployment (Docker Compose, Nginx, SSL)
- Agent-driven development workflow (Claude Code)
- 31 KPI formülasyonu — pazarlama metric'leri

## Slayt 22 — Teşekkür
- Prof. Dr. Vahap Tecim
- Sporthink ekibi (Mert Gülseren, Emre Yavşan)
- DEÜ YBS Bölümü
- Open source community

## Slayt 23 — Kaynaklar
- GitHub: github.com/ademyavuzz/sporthink-kpi-dashboard (private — bitirme sonrası açılacak)
- 16 markdown spec doc — `docs/overview/`
- README + DEPLOY + USER_GUIDE

## Slayt 24 — Q&A
- Soru-Cevap

---

## Demo Hazırlık Notları

- Tarayıcıda 2 tab aç: 1× dashboard, 1× /api/docs
- Login bilgileri ezberle
- Test CSV'leri masaüstünde hazır olsun
- Sunum öncesi `cache.delete_pattern("kpi:*")` çağır → cache miss demo

## Ekipman

- Laptop + HDMI/USB-C kablosu
- Yedek dizüstü (RPI veya başka)
- Mobil hotspot (internet için)
- Sulu içecek :)
