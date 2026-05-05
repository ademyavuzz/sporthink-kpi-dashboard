# 13. PROJE PLANI VE ZAMAN ÇİZELGESİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, Sporthink KPI Dashboard projesinin 11 haftalık zaman planını, sprint detaylarını, görevleri, kilometre taşlarını ve teslim takvimini detaylı olarak ele almaktadır. Her hafta için planlanan işler, kabul kriterleri ve risk noktaları belgelenmiştir.

## 13.1 Proje Özeti

| Bilgi | Değer |
|---|---|
| Proje Adı | Sporthink Pazarlama ve E-Ticaret KPI Dashboard |
| Proje Tipi | Bitirme Projesi - Lisans |
| Geliştirici | Adem Yavuz (DEÜ YBS 4. Sınıf) |
| Akademik Danışman | Prof. Dr. Vahap Tecim |
| Sektör Sponsoru | Sporthink Sport Apparel |
| Başlangıç Tarihi | 14 Mart 2026 |
| Bitiş Tarihi | 29 Mayıs 2026 |
| Toplam Süre | 11 Hafta |
| Çalışma Modeli | Tek geliştirici, Agile (1 haftalık sprint'ler) |

## 13.2 Yüksek Seviye Yol Haritası

```
HAFTA  KONU                              KİLOMETRE TAŞI
────  ──────────────────────────────  ─────────────────────────────
1     Analiz, Tasarım, Setup            Spec finalize, Repo kuruldu
2     DB Tasarımı, Auth Backend         DB schema, JWT auth çalışır
3     RBAC, User Management Backend     43 izin, Süper Admin seed
4     Frontend Setup, Layout, Login     Login + Dashboard iskelet
5     Import Sistemi (Backend + UI)     CSV import çalışır
6     KPI Hesaplama, Aggregation        Aggregation tabloları aktif
7     Dashboard Sayfaları (1-5)         Overview, Traffic, Meta, Google, Ecom
8     Dashboard Sayfaları (6-9)         Campaign, Funnel, Cohort, Products
9     Filtreler, Segmentler, Cross      Cross-filter, RFM aktif
10    Test, Optimizasyon, Bug Fix       Coverage hedefleri, Performance
11    Deployment, Eğitim, Teslim        Production live, sunum
```

## 13.3 Sprint Bazlı Detaylı Plan

Her sprint 1 hafta sürmektedir. Pazartesi sprint planning, Cuma sprint review/retrospective.

### 13.3.1 Sprint 1 (14-20 Mart 2026): Analiz ve Setup

**Hedef:** Proje gereksinimlerinin netleştirilmesi, tasarım onayı, geliştirme ortamının kurulması.

**Görevler:**

| Gün | Görev | Çıktı |
|---|---|---|
| Pzt | Sporthink ile kickoff toplantı | Toplantı notu |
| Sal | Detaylı gereksinim analizi | Use case listesi |
| Çar | UI/UX wireframe tasarımı | Figma dosyaları |
| Per | Tech stack finalize, dokümantasyon | Bu doküman v1 |
| Cum | GitHub repo, geliştirme ortamı | Çalışan dev environment |

**Çıktılar:**
- Tüm dokümantasyon (15 bölüm)
- GitHub repository (private, branch protection rules)
- Local Docker dev environment
- Wireframe / mockup tasarımları

**Kabul Kriterleri:**
- Sporthink onayı alındı (gereksinim ve tasarım)
- Akademik danışman onayı alındı
- Geliştirici makinesinde `docker compose up` ile sistem ayağa kalkıyor

### 13.3.2 Sprint 2 (21-27 Mart 2026): Veritabanı ve Auth

**Hedef:** Veritabanı tasarımının uygulanması, JWT tabanlı kimlik doğrulamanın geliştirilmesi.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | MySQL schema, Alembic migration setup |
| Sal | 11 ana tablo + sistem tablolarının oluşturulması |
| Çar | JWT token mimarisi, login endpoint |
| Per | Refresh token, logout, brute force koruması |
| Cum | Şifremi unuttum akışı, SendGrid entegrasyonu |

**Çıktılar:**
- Çalışan DB migration sistemi
- `/api/v1/auth/*` endpoint'leri
- bcrypt şifre hash'leme
- Email gönderim altyapısı
- Auth unit + integration testleri

**Kabul Kriterleri:**
- POST /auth/login başarıyla token döner
- 5 yanlış denemede hesap kilitlenir
- Şifre sıfırlama email'i gönderilir
- Backend testleri %80+ coverage

### 13.3.3 Sprint 3 (28 Mart - 3 Nisan 2026): RBAC ve User Management

**Hedef:** Yetkilendirme sisteminin (RBAC) ve kullanıcı yönetimi modülünün tamamlanması.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | 37 permission seed, Süper Admin oluşturma |
| Sal | Role + permission CRUD endpoint'leri |
| Çar | Permission cache (Redis), require_permission decorator |
| Per | User management endpoint'leri (davet, edit, delete) |
| Cum | Audit log altyapısı, role silme cascade |

**Çıktılar:**
- `/api/v1/users/*`, `/api/v1/roles/*`, `/api/v1/permissions/*`
- Süper Admin sistem rolü
- 37 permission tam çalışıyor
- Audit log tablosu ve trigger'lar

**Kabul Kriterleri:**
- Süper Admin tüm yetkilere otomatik sahip
- Permission cache 5 dk sonra refresh oluyor
- Rol silindiğinde kullanıcılar pasifleşiyor
- Tüm kritik aksiyonlar audit log'a yazılıyor

### 13.3.4 Sprint 4 (4-10 Nisan 2026): Frontend Setup ve Login UI

**Hedef:** React + Vite + TailwindCSS frontend kurulumu, layout iskeletinin oluşturulması, login akışı.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | Vite + Tailwind + shadcn/ui kurulum |
| Sal | Theme system (light/dark), i18n setup |
| Çar | Layout (Sidebar + TopBar + MainContent) |
| Per | Login page, ForgotPassword page, ResetPassword page |
| Cum | Auth Zustand store, Axios interceptor (token refresh) |

**Çıktılar:**
- Çalışan React SPA
- Login akışı end-to-end
- Tema değiştirici, dil değiştirici
- 11 sayfa için boş iskelet (placeholder)

**Kabul Kriterleri:**
- Login → Dashboard yönlendirmesi
- Token expire olduğunda otomatik refresh
- Light/Dark tema sorunsuz değişiyor
- TR/EN dil değişimi tüm metinleri çeviriyor

### 13.3.5 Sprint 5 (11-17 Nisan 2026): Import Sistemi

**Hedef:** Veri import modülünün backend ve frontend olarak tamamlanması. Bu sprint en kritik ve riskli sprint'tir.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | Celery + Redis kurulumu, async job altyapısı |
| Sal | Dosya upload endpoint, parser (CSV/XLSX/JSON) |
| Çar | Veri tipi otomatik tespit, kolon eşleme (fuzzy) |
| Per | Validasyon, duplicate kontrolü, normalizasyon |
| Cum | Import wizard UI (4 adım), polling, progress |

**Çıktılar:**
- Çalışan Celery worker
- `/api/v1/imports/*` endpoint'leri
- 4 adımlı wizard UI
- 10 farklı veri tipi import'u

**Kabul Kriterleri:**
- 50 MB'lık CSV başarıyla import edilir
- Hatalı satırlar CSV olarak indirilir
- Rollback işlemi veriyi geri alır
- UI'da real-time progress gösterilir

**Risk:** Bu sprint planlanandan uzun sürebilir. Buffer olarak Sprint 6'nın bir kısmı gerekebilir.

### 13.3.6 Sprint 6 (18-24 Nisan 2026): KPI Hesaplama ve Aggregation

**Hedef:** KPI hesaplama servislerinin yazılması, aggregation tablolarının doldurulması.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | Aggregation tabloları (kpi_daily, kpi_monthly, kpi_campaign) |
| Sal | KPI service: trafik KPI'ları (8 KPI) |
| Çar | KPI service: reklam KPI'ları (10 KPI) |
| Per | KPI service: satış ve pazarlama KPI'ları (13 KPI) |
| Cum | Cache stratejisi (Redis), cache invalidation |

**Çıktılar:**
- Tüm 31 KPI hesaplama
- `/api/v1/kpi/*`, `/api/v1/dashboard/*` endpoint'leri
- Aggregation rebuild Celery task
- KPI cache layer

**Kabul Kriterleri:**
- KPI sorguları <500 ms
- Cache hit rate %70+
- Aggregation rebuild <2 dk (1 yıllık veri için)

### 13.3.7 Sprint 7 (25 Nisan - 1 Mayıs 2026): Dashboard Sayfaları (1-5)

**Hedef:** İlk 5 dashboard sayfasının tam implementasyonu.

**Görevler:**

| Gün | Sayfa |
|---|---|
| Pzt | Genel Özet (Overview) |
| Sal | Trafik (GA4) |
| Çar | Meta Ads |
| Per | Google Ads |
| Cum | E-Ticaret |

**Çıktılar:**
- 5 sayfa tam çalışır durumda
- KPI cards, line/bar/donut charts, tablolar
- Tüm sayfalarda loading skeleton, empty state

**Kabul Kriterleri:**
- Her sayfa <3 sn yüklenir
- Tüm grafikler dark/light tema uyumlu
- Mobil responsive en azından sorunsuz scroll yapıyor

### 13.3.8 Sprint 8 (2-8 Mayıs 2026): Dashboard Sayfaları (6-9)

**Hedef:** Geri kalan dashboard sayfalarının implementasyonu.

**Görevler:**

| Gün | Sayfa |
|---|---|
| Pzt | Kampanya Analizi |
| Sal | Funnel Analizi |
| Çar | Cohort/Retention |
| Per | Ürün Performansı |
| Cum | Bug fix, polish, edge case'ler |

**Çıktılar:**
- 9 dashboard sayfası tamamı çalışır
- Funnel chart, heatmap, pivot table component'leri

**Kabul Kriterleri:**
- Funnel %doğruluk testi geçti
- Cohort heatmap doğru tarih hesaplıyor
- Top ürünler sıralaması doğru

### 13.3.9 Sprint 9 (9-15 Mayıs 2026): Filtreler ve Segmentler

**Hedef:** Filtreleme sistemi, cross-filter ve segmentasyon modülü.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | Global filter store, URL persistence |
| Sal | Filter chip UI, filter modal |
| Çar | Cross-filter implementation (chart click → filter) |
| Per | Visual segment rule builder UI |
| Cum | Saved views, RFM hesaplama |

**Çıktılar:**
- 12 tarih preset
- Multi-select filtreler (kanal, cihaz, şehir)
- Cross-filter tüm sayfalarda
- Visual segment builder
- RFM segment hesaplama

**Kabul Kriterleri:**
- Filtre URL'e yansıyor
- Cross-filter <300 ms tepki veriyor
- Segment preview debounced (500 ms)
- Saved views çalışıyor

### 13.3.10 Sprint 10 (16-22 Mayıs 2026): Test ve Optimizasyon

**Hedef:** Test coverage hedeflerine ulaşma, performans optimizasyonu, bug fix.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | Backend test gap'leri kapatma |
| Sal | Frontend test gap'leri kapatma |
| Çar | E2E test senaryoları (Playwright) |
| Per | Performance optimization (DB index, cache) |
| Cum | UI polish, accessibility check |

**Çıktılar:**
- Backend coverage %70+
- Frontend coverage %60+
- 10 E2E senaryosu
- Performance benchmark raporu

**Kabul Kriterleri:**
- Tüm CI testleri yeşil
- Lighthouse performance >85
- Critical paths %100 covered

### 13.3.11 Sprint 11 (23-29 Mayıs 2026): Deployment ve Teslim

**Hedef:** Sistemin production'a alınması, kullanıcı eğitimi, dokümantasyon teslimi.

**Görevler:**

| Gün | Görev |
|---|---|
| Pzt | VDS sunucu hazırlığı, Docker deployment |
| Sal | DNS, SSL sertifikası, ilk deployment |
| Çar | Sporthink ekibi ile UAT (User Acceptance Test) |
| Per | Final dokümantasyon, kullanıcı eğitimi |
| Cum | Bitirme sunumu, proje teslimi |

**Çıktılar:**
- Production environment çalışır durumda (https://dashboard.sporthink.com.tr)
- Süper Admin hesabı Sporthink IT'ye teslim edildi
- Kullanıcı eğitim materyali (PDF + video)
- Bitirme sunumu hazır

**Kabul Kriterleri:**
- Production'da tüm fonksiyonlar çalışıyor
- Sporthink kullanıcıları sisteme login olabiliyor
- Akademik sunum onaylandı

## 13.4 Görev Önceliklendirmesi (MoSCoW)

### 13.4.1 Must Have (Mutlaka Olmalı)

Bunlar olmadan sistem teslim edilemez:

- JWT auth + RBAC + 37 permission
- Süper Admin sistem rolü
- 11 ana veri tablosu + 3 aggregation tablosu
- 4 adımlı veri import (CSV/XLSX/JSON)
- 31 KPI hesaplama
- 9 dashboard sayfası
- Tarih filtresi + 12 preset
- Light/Dark tema, TR/EN dil
- Production deployment

### 13.4.2 Should Have (Olmalı)

Bunlar olmadan sistem yetersiz görünür ama teknik olarak çalışır:

- Cross-filter
- Saved views
- Visual segment rule builder
- RFM hesaplama
- Audit log görüntüleme sayfası
- Channel mapping yönetimi
- Export (CSV/JSON/XLSX)
- Email bildirimleri (şifre sıfırlama)

### 13.4.3 Could Have (Olabilir)

Zaman kalırsa eklenir, eksikliği teslim engeli değil:

- Hazır segmentler (Champions, At Risk, vb.)
- Brand-bazlı detaylı analiz
- Top N ürün tablosunda detay popup
- Mobil optimizasyon
- Gelişmiş animasyonlar
- Cmd+K hızlı arama

### 13.4.4 Won't Have (Bu sürümde olmayacak)

Bilinçli olarak kapsam dışı bırakılanlar (future versiyonlara):

- 2FA / MFA
- SSO entegrasyonu
- Drag-and-drop dashboard customization
- Scheduled reports (otomatik email raporları)
- Mobile app (native)
- Real-time data streaming
- AI/ML tahmin modelleri
- Predictive analytics
- A/B test analiz modülü
- Otomatik anomali tespiti
- Multi-tenant (birden fazla mağaza)
- Public API (3rd party developer access)

## 13.5 Risk Buffer'ları

11 haftalık plan içinde 3 buffer mekanizması bulunmaktadır:

**Sprint 6'nın yarısı buffer:** Sprint 5'te (Import) gecikme olursa, Sprint 6'nın ilk 2-3 günü import bug fix'lerine ayrılabilir.

**Sprint 10 buffer ağırlıklı:** Test ve optimizasyon sprint'i aslında bir buffer'dır. Eğer önceki sprint'lerde gecikme olduysa, kapsamı daraltılır ve eksik feature'lar tamamlanır.

**Sprint 11 ilk yarı esnek:** Deployment Pazartesi-Salı tamamlanır, Çar-Per'ye buffer kalır. Acil bir bug çıkarsa düzeltme zamanı vardır.

## 13.6 Toplantı ve İletişim Düzeni

### 13.6.1 Sporthink ile İletişim

- **Haftalık check-in:** Her Cuma 14:00, Mert Gülseren ve Emre Yavşan ile online toplantı (15-30 dk)
- **Aylık demo:** Her ayın son haftası, ekipten gelecek geri bildirim için canlı demo
- **Slack/WhatsApp:** Acil sorular için anlık iletişim kanalı

### 13.6.2 Akademik Danışman ile İletişim

- **Aylık ilerleme raporu:** Prof. Dr. Vahap Tecim'e PDF rapor (her ayın 15'inde)
- **Yüz yüze toplantı:** Önemli kararlar veya engellerde randevu

### 13.6.3 Sprint Ritmi (Geliştirici Tarafı)

| Gün | Saat | Aktivite |
|---|---|---|
| Pzt | 09:00 | Sprint planning (1 saat, kendine) |
| Pzt-Per | 09:00-18:00 | Aktif geliştirme |
| Cum | 09:00-15:00 | Aktif geliştirme |
| Cum | 15:00-16:00 | Sprint review (kendine) + Sporthink toplantı |
| Cum | 16:00-17:00 | Sprint retrospective + sonraki sprint hazırlık |

## 13.7 Kilometre Taşları (Milestones)

| ID | Milestone | Tarih | Teslim Edilen |
|---|---|---|---|
| M1 | Spec Onaylandı | 20 Mart | Bu doküman v1 |
| M2 | Auth Sistemi Çalışır | 27 Mart | Login + JWT |
| M3 | RBAC Tamamlandı | 3 Nisan | 37 permission |
| M4 | Frontend İskelet Hazır | 10 Nisan | Login UI |
| M5 | Import Çalışır | 17 Nisan | CSV import end-to-end |
| M6 | KPI Hesaplama Hazır | 24 Nisan | 31 KPI çalışır |
| M7 | Dashboard 1-5 | 1 Mayıs | Overview, Traffic, Meta, Google, Ecom |
| M8 | Dashboard 6-9 | 8 Mayıs | Campaign, Funnel, Cohort, Products |
| M9 | Filter & Segment | 15 Mayıs | Cross-filter, RFM |
| M10 | Test & Optimize | 22 Mayıs | %70+ coverage |
| M11 | **Final Teslim** | **29 Mayıs** | **Production live + sunum** |

## 13.8 Effort Tahmini (Story Points)

Her sprint için tahmin edilen iş yükü (1 story point ≈ 1 saatlik geliştirici emeği):

| Sprint | Story Points | Karmaşıklık |
|---|---|---|
| Sprint 1 (Setup) | 25 | Düşük |
| Sprint 2 (DB + Auth) | 35 | Orta |
| Sprint 3 (RBAC) | 40 | Orta-Yüksek |
| Sprint 4 (Frontend Setup) | 35 | Orta |
| Sprint 5 (Import) | 50 | **Çok Yüksek** |
| Sprint 6 (KPI) | 45 | Yüksek |
| Sprint 7 (Pages 1-5) | 45 | Yüksek |
| Sprint 8 (Pages 6-9) | 40 | Orta-Yüksek |
| Sprint 9 (Filters/Segments) | 40 | Yüksek |
| Sprint 10 (Test/Optimize) | 35 | Orta |
| Sprint 11 (Deploy) | 30 | Orta |
| **Toplam** | **420** | |

Haftalık 40 saat çalışma varsayımıyla, toplam ~440 saat geliştirici emeği. Plan ~95% kapasite ile yapılmıştır, çok az boşluk vardır.

## 13.9 Çalışma Ortamı

### 13.9.1 Geliştirici Ekipmanı

- **Bilgisayar:** Adem Yavuz'un kişisel laptop (asgari 16GB RAM, SSD)
- **OS:** macOS / Linux / Windows (Docker desteği şart)
- **IDE:** VS Code (Python + TypeScript extension'ları)
- **Tarayıcı:** Chrome (geliştirme), Firefox (cross-browser test)
- **Tasarım:** Figma (mockup ve wireframe)

### 13.9.2 Çalışma Yeri

Hibrit model:
- **Yarı zaman:** Sporthink ofisi (gerekli durumlarda demo, toplantı)
- **Yarı zaman:** DEÜ kütüphanesi veya ev (yoğun kod yazımı)

### 13.9.3 Yedekleme

- **Code:** GitHub remote (her commit otomatik backup)
- **Lokal DB:** Docker volume (geliştirme verisi)
- **Doküman:** Google Drive + GitHub

## 13.10 Akademik Teslim

### 13.10.1 Teslim Edilecek Dokümanlar

- **Tez Dokümanı:** Bu dokümanın akademik formata uyarlanmış versiyonu (50-100 sayfa)
- **Sunum Slaytı:** 25-30 slayt, demo videoları gömülü
- **Kaynak Kodu:** GitHub repository linki (private, akademik komiteye geçici erişim)
- **Demo Videosu:** 5-10 dk, tüm önemli özellikleri gösteren

### 13.10.2 Sunum Tarihi

29 Mayıs 2026 - Cuma günü öğleden sonra. Bitirme jürisi önünde sunum + Q&A.

### 13.10.3 Sunum İçeriği

1. Problem Tanımı (3 dk)
2. Çözüm Yaklaşımı (3 dk)
3. Teknik Mimari (5 dk)
4. Demo - Login + Dashboard + Import (10 dk)
5. Sonuçlar ve Başarı Metrikleri (3 dk)
6. Soru-Cevap (10 dk)

## 13.11 Sonraki Bölüm

Bu bölümde projenin 11 haftalık planı ve tüm sprint'ler detaylı olarak ele alındı. Sonraki bölümde, projenin karşılaşabileceği riskler ve bu risklere karşı alınan önlemler incelenecektir.

**Sonraki Bölüm:** [14 - Risk Analizi](14-risk-analysis.md)

*Bölüm 13 sonu.*
