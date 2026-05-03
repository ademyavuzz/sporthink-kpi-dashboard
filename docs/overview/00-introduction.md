# 0. YÖNETİCİ ÖZETİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, Sporthink Pazarlama ve E-Ticaret KPI Dashboard projesinin **yönetici düzeyinde** genel özetini sunmaktadır. Projenin **vizyonu, iş hedefleri, çözmeyi amaçladığı problem, ana fonksiyonları ve beklenen kazanımları** kuş bakışı ele alınmıştır. Teknik detaylara girmeden, projenin **neden** yapıldığını ve **ne sağlayacağını** anlatır. Detaylı teknik bilgiler için ilgili bölümlere referanslar verilmiştir.

---

## 0.1 Projeye Bir Bakış

**Sporthink Pazarlama ve E-Ticaret KPI Dashboard**, dijital pazarlama ve e-ticaret performansını ölçmek için ihtiyaç duyulan kritik metrikleri **tek bir merkezi panelde** toplayan, gerçek zamanlıya yakın veri akışını simüle eden ve **veri odaklı karar alma süreçlerini hızlandıran** profesyonel bir dashboard sistemidir.

Proje, **Sporthink** spor giyim ve ekipman e-ticaret işletmesinin pazarlama ve dijital ticaret operasyonlarında kullanmak üzere geliştirilmektedir. Sistem, **Google Analytics 4 (GA4), Meta Ads, Google Ads** ve **e-ticaret veritabanı** olmak üzere dört ayrı veri kaynağından gelen verileri **standart bir veri modelinde** birleştirmekte; bu veriler üzerinden **30'dan fazla KPI'yı** otomatik hesaplayarak yöneticilere ve pazarlama analistlerine **görselleştirilmiş içgörüler** sunmaktadır.

Proje, **Adem Yavuz** tarafından **Dokuz Eylül Üniversitesi Yönetim Bilişim Sistemleri Bölümü Bitirme Projesi** kapsamında, **Prof. Dr. Vahap Tecim** danışmanlığında, **11 hafta** süreyle Mart–Mayıs 2026 döneminde geliştirilmektedir.

---

## 0.2 Çözülmek İstenen Problem

Günümüzde dijital pazarlama ekipleri, performans analizlerini farklı platformlardan beslenen verilerle yapmak zorundadır:

- **Google Analytics:** Trafik kaynakları, kullanıcı davranışı, dönüşüm
- **Meta Business Suite (Facebook & Instagram Ads):** Kampanya performansı, demografik kırılım
- **Google Ads:** Arama ve alışveriş kampanyaları, anahtar kelime performansı
- **E-ticaret yönetim paneli:** Sipariş, ciro, müşteri verileri

Bu **dağınık veri kaynakları** üç temel problemi beraberinde getirmektedir:

### Problem 1: Veri Silosları
Her platform kendi raporlama arayüzüne sahiptir. Bir karar vermek için pazarlama yöneticisinin **4 farklı sekme açıp** verileri zihinde birleştirmesi gerekir. Bu durum:
- ❌ Karar alma süresini uzatır
- ❌ Veri tutarsızlıklarına yol açar (her platform farklı atribüsyon modeli kullanır)
- ❌ Cross-channel analiz (örn: kanal bazlı ROAS karşılaştırması) imkansızlaşır

### Problem 2: Manuel Raporlama Yükü
Haftalık veya aylık yönetim raporları genellikle **Excel'e manuel veri kopyalanarak** hazırlanır:
- ⏱️ Bir aylık rapor oluşturmak ortalama **3-4 saat** sürer
- 🔁 Aynı süreç her ay tekrarlanır
- ⚠️ İnsan hatasına açıktır (yanlış formül, eksik filtreleme)

### Problem 3: Analiz Derinliğinin Yetersizliği
Standart platform raporları **temel metriklerle sınırlıdır**:
- Cohort analizi (müşteri sadakati zaman içinde nasıl değişiyor?)
- Funnel analizi (ziyaretten satın almaya hangi adımda kayıp yaşanıyor?)
- Segment bazlı karşılaştırma (VIP müşteriler vs. yeni müşteriler)
- RFM analizi (Recency, Frequency, Monetary)

Bu tür **gelişmiş analitik** ihtiyaçları, hazır platform raporlarının ötesinde **özel dashboard** gerektirir.

---

## 0.3 Çözüm Yaklaşımı

Sporthink KPI Dashboard, yukarıda tanımlanan üç problemi şu yaklaşımlarla çözmektedir:

### 🎯 Tek Veri Merkezi (Single Source of Truth)
Tüm dijital pazarlama ve e-ticaret verileri, **MySQL 8.4 LTS** üzerinde normalize edilmiş **11 tabloda** birleştirilir. Bu sayede:
- Bir tıklama ile tüm kanallar birlikte analiz edilebilir
- Veri tutarlılığı (consistency) garanti edilir
- Cross-channel hesaplamalar (toplam ROAS, blended CPA) doğru yapılır

### ⚡ Otomatik KPI Hesaplama
Sistem **30+ KPI'yı** otomatik olarak hesaplar:
- Manuel raporlama süresi 3-4 saatten **30 saniyeye** iner
- Hesaplama formülleri sistemde **tek yerde** tanımlıdır (versiyon kontrollü)
- Tarih aralığı, kanal, kampanya filtreleri **anlık** uygulanır

### 📊 Profesyonel BI-Tool Seviyesinde Görselleştirme
**ApexCharts** ile yapılan görselleştirmeler şunları kapsar:
- KPI kartları (delta gösterimi: önceki dönem ile karşılaştırma)
- Zaman serisi grafikleri (line, area, bar)
- Donut chart (kanal/kategori dağılımı)
- Funnel grafikleri (dönüşüm adımları)
- Cohort heatmap (retention analizi)
- Karşılaştırmalı tablolar ve pivot view'lar

### 🔍 Gelişmiş Analitik Özellikler
- **Cross-Filter:** Bir grafikte yapılan seçim diğer tüm grafikleri etkiler
- **Segmentasyon:** Visual rule builder ile dinamik müşteri grupları
- **Saved Views:** Sık kullanılan filtre+layout kombinasyonlarını kaydetme
- **Cohort Analizi:** Kullanıcıların ilk ziyaret tarihine göre tekrar satın alma oranı

---

## 0.4 Teknoloji Tercihi — Kısa Özet

Proje, **modern, ölçeklenebilir ve endüstri-standardı** teknolojilerle inşa edilmektedir. Detaylı teknoloji kararları için bkz: **[Bölüm 02 - Teknoloji Stack](02-tech-stack.md)**.

| Katman | Teknoloji | Tercih Nedeni |
|---|---|---|
| **Frontend** | React 19 + Vite + TailwindCSS + shadcn/ui | Modern component mimarisi, hızlı geliştirme, profesyonel UI |
| **Backend** | FastAPI (Python 3.12) | Async destek, otomatik Swagger, yüksek performans |
| **Database** | MySQL 8.4 LTS | İlişkisel veri için endüstri standardı, güçlü partition desteği |
| **Cache** | Redis 7.4 | KPI sonuç önbellekleme, session yönetimi |
| **Background Jobs** | Celery + Redis | Async dosya import, scheduled tasks |
| **Auth** | JWT (Access + Refresh Token) | Stateless, ölçeklenebilir, modern güvenlik |
| **Deployment** | Docker Compose + Nginx + Let's Encrypt | Containerize edilmiş, otomatik SSL |
| **CI/CD** | GitHub Actions | Lint → Test → Build → Deploy pipeline |

---

## 0.5 Ana Fonksiyonel Modüller

Proje aşağıdaki **8 ana fonksiyonel modülden** oluşmaktadır:

### 1. 🔐 Kimlik Doğrulama ve Yetkilendirme (Auth & RBAC)
- JWT tabanlı kimlik doğrulama (access + refresh token)
- **Süper Admin** sistem rolü (silinemez, tüm yetkiler)
- **Rol Bazlı Erişim Kontrolü (RBAC):** 37 granüler izin
- Davet bazlı kullanıcı yönetimi (self-register kapalı)
- Brute force koruması, IP rate limit
- *Detaylar: [Bölüm 05](05-rbac-security.md)*

### 2. 📥 Veri Import Modülü
- 4 adımlı wizard: **Upload → Mapping → Validation → Commit**
- CSV, XLSX, JSON formatları
- Otomatik kolon eşleme (fuzzy matching)
- Async processing (Celery), büyük dosyalar için non-blocking
- Rollback desteği (her import bir batch ID ile takip edilir)
- *Detaylar: [Bölüm 08](08-import-system.md)*

### 3. 📊 Dashboard ve Görselleştirme
- 11 ana sayfa (Genel Özet, Trafik, Meta Ads, Google Ads, E-Ticaret, vb.)
- 30+ KPI kartı, zaman serisi grafikleri, funnel, cohort, heatmap
- Light/Dark tema desteği (sistem tercihi otomatik algılama)
- Türkçe/İngilizce dil desteği
- *Detaylar: [Bölüm 07](07-frontend-design.md) ve [Bölüm 09](09-kpi-formulas.md)*

### 4. 🔍 Filtreleme ve Segmentasyon
- Global filtreler (tarih, kanal, cihaz, şehir)
- Sayfa-spesifik filtreler (kampanya, ad set, kategori, vb.)
- **Cross-filter:** Bir grafiğin seçimi diğerlerini etkiler
- **Visual Segment Builder:** Dropdown'larla kural yazma (RFM destekli)
- *Detaylar: [Bölüm 10](10-filtering-segments.md)*

### 5. 🎯 KPI Hesaplama Motoru
- **4 ana kategori, 30+ KPI:**
  - Trafik (8): Sessions, Users, Bounce Rate, Conversion Rate, ...
  - Reklam (10): CTR, CPC, CPM, ROAS, Frequency, ...
  - Satış (8): Revenue, AOV, Repeat Purchase Rate, Refund Rate, ...
  - Pazarlama (5): Channel Revenue, Campaign Revenue, ...
- Aggregation tabloları ile **<50ms sorgu performansı**
- Önceki dönem karşılaştırma (period-over-period)
- *Detaylar: [Bölüm 09](09-kpi-formulas.md)*

### 6. 📤 Export ve Raporlama
- CSV, JSON, XLSX formatlarında dışa aktarma
- Filtreli raw data veya aggregated KPI özeti
- Büyük export'lar için async processing
- *Detaylar: [Bölüm 06](06-api-spec.md)*

### 7. ⚙️ Sistem Yönetimi
- Kullanıcı ve rol yönetimi
- Channel mapping (kanal eşleme) düzenleme
- Sistem ayarları
- Audit log görüntüleme
- *Detaylar: [Bölüm 05](05-rbac-security.md)*

### 8. 📋 Loglama ve Denetim
- API logları (rotating file, Nginx-level)
- Audit logları (kritik işlemler MySQL'de)
- Import logları (her import detayı)
- Hata logları
- *Detaylar: [Bölüm 11](11-deployment.md)*

---

## 0.6 Hedef Kullanıcılar

Sistem üç ana kullanıcı tipini desteklemektedir:

### 👨‍💼 Pazarlama Yöneticisi (Marketing Manager)
**Beklentiler:**
- Günlük/haftalık performans özeti
- Kampanya bazlı ROAS karşılaştırması
- Bütçe-performans dengelemesi

**Sıkça Kullanacağı Modüller:** Genel Özet, Kampanya Analizi, Export

### 📈 Pazarlama Analisti (Marketing Analyst)
**Beklentiler:**
- Detaylı segment analizi
- Cohort ve retention takibi
- Çapraz veri kaynağı korelasyonu (örn: GA4 trafiği vs Meta Ads dönüşümleri)

**Sıkça Kullanacağı Modüller:** Trafik, Meta Ads, Google Ads, Cohort, Funnel, Segmentasyon

### ⚙️ Sistem Yöneticisi (Süper Admin)
**Beklentiler:**
- Kullanıcı ve rol yönetimi
- Veri import operasyonları
- Sistem konfigürasyonu, log inceleme

**Sıkça Kullanacağı Modüller:** Veri Import, Kullanıcı/Roller, Log Sayfaları, Channel Mapping

---

## 0.7 Beklenen Kazanımlar (Business Impact)

Sistem operasyonel kullanıma alındığında aşağıdaki kazanımlar beklenmektedir:

### Operasyonel Verimlilik
| Metrik | Mevcut Durum | Hedef | İyileşme |
|---|---|---|---|
| **Aylık rapor hazırlama süresi** | 3-4 saat (manuel) | 30 saniye (otomatik) | **~%99** |
| **Karar alma için veri toplama süresi** | 15-20 dakika | <30 saniye | **~%97** |
| **Cross-channel analiz** | Mümkün değil (manuel pivot) | Anlık | **Yeni yetenek** |
| **Veri tutarlılığı** | Düşük (manuel hata) | Yüksek (sistem-tabanlı) | **Kalite artışı** |

### Stratejik Kazanımlar
- ✅ **Veri odaklı karar alma kültürü:** Tüm ekip aynı verilere bakar
- ✅ **Erken sinyal yakalama:** ROAS düşüşü, dönüşüm anomalileri saatler içinde fark edilir (önceden hafta/ay alıyordu)
- ✅ **Bütçe optimizasyonu:** Düşük performanslı kampanyalar daha hızlı durdurulur
- ✅ **Kanal ROI kıyaslaması:** Hangi kanala daha fazla yatırım yapılmalı, veri ile kanıtlanır

---

## 0.8 Proje Kapsamı — Kısa Özet

### Kapsam Dahilinde (In Scope) ✅
- 4 veri kaynağından dosya bazlı veri import
- 30+ KPI'nın otomatik hesaplanması ve görselleştirilmesi
- 11 ana sayfa, light/dark tema, TR/EN dil desteği
- RBAC (rol bazlı erişim) ve kullanıcı yönetimi
- Filtreleme, segmentasyon, cross-filter
- CSV/JSON/XLSX export
- VDS üzerine deployment, HTTPS, CI/CD

### Kapsam Dışında (Out of Scope) ❌
- Gerçek API entegrasyonları (canlı GA4, Meta, Google Ads bağlantısı) — *dummy data ile simülasyon*
- Mobil uygulama — *responsive web yeterli*
- Gerçek ödeme/e-ticaret işlemleri — *sadece veri analizi*
- Scheduled email reports — *future feature*
- PDF rapor exportu — *future feature*
- 2FA (İki Faktörlü Doğrulama) — *future feature*

*Detaylı kapsam tanımı için bkz: [Bölüm 01](01-project-scope.md)*

---

## 0.9 Proje Risk Profili — Kısa Özet

| Risk | Olasılık | Etki | Strateji |
|---|---|---|---|
| **Zaman kısıtlılığı** (11 hafta) | Yüksek | Yüksek | MVP odaklı, haftalık sprint takibi |
| **Sunucu hazır olmama** | Orta | Yüksek | Lokal geliştirme, erken IT talebi |
| **Performans sorunları** (büyük veri) | Orta | Orta | Redis cache + aggregation tabloları + partition |
| **Veri kalitesi (import hataları)** | Düşük | Orta | Multi-step validation, error report |
| **Kapsam kayması (scope creep)** | Orta | Yüksek | Net MVP tanımı, sonraki sürüme erteleme |

*Detaylı risk analizi: [Bölüm 14](14-risk-analysis.md)*

---

## 0.10 Proje Takvimi — Genel Görünüm

```
Mart 2026 ──────── Nisan 2026 ──────── Mayıs 2026
   │                  │                  │
   ├─ H1-H2: Analiz ve Tasarım           │
   │  ├─ H3: Proje Kurulumu              │
   │  ├─ H4-H5: Import Modülü            │
   │  ├─ H6: Normalizasyon & KPI         │
   │  ├─ H7: KPI API & Backend           │
   │  ├─ H8-H9: Dashboard Geliştirme     │
   │                  └─ H10: Test & Optimizasyon
   │                                     └─ H11: Final Teslim (29 Mayıs)
   ▼                                     ▼
Başlangıç                            FİNAL TESLİM
14 Mart 2026                         29 Mayıs 2026
```

| Hafta | Tarih Aralığı | Ana Odak |
|---|---|---|
| **H1** | 14–20 Mart | Analiz ve Gereksinim |
| **H2** | 21–27 Mart | Veri Modeli ve Teknik Tasarım |
| **H3** | 28 Mart – 03 Nisan | Proje Kurulumu ve Altyapı |
| **H4** | 04–10 Nisan | Import Modülü (Temel) |
| **H5** | 11–17 Nisan | Import Modülü (İleri) |
| **H6** | 18–26 Nisan | Normalizasyon ve KPI Altyapısı |
| **H7** | 27 Nisan – 03 Mayıs | KPI API ve Backend |
| **H8** | 04–10 Mayıs | Dashboard (Temel) |
| **H9** | 11–17 Mayıs | Dashboard (Gelişmiş) |
| **H10** | 18–24 Mayıs | Test ve Optimizasyon |
| **H11** | 25–29 Mayıs | Dokümantasyon ve Final Teslim |

*Detaylı haftalık görev dağılımı: [Bölüm 13](13-project-plan.md)*

---

## 0.11 Teslim Edilecekler (Deliverables)

Proje sonunda aşağıdaki çıktılar teslim edilecektir:

### Yazılım Çıktıları
- ✅ Çalışan ve deploy edilmiş **full-stack web uygulaması** (canlı URL)
- ✅ Backend API (FastAPI) — Swagger/OpenAPI ile dokümante edilmiş
- ✅ Frontend uygulaması (React + Vite build) — Production'da Nginx ile servis edilir
- ✅ Veritabanı schema dosyaları (DDL scripts, Alembic migrations)
- ✅ Docker Compose konfigürasyonu (tek komutla kurulum)
- ✅ GitHub Actions CI/CD pipeline

### Doküman Çıktıları
- ✅ **15 bölümlük teknik dokümantasyon** (bu doküman)
- ✅ **Kullanım kılavuzu** (kullanıcı odaklı, ekran görüntüleri ile)
- ✅ **API dokümantasyonu** (Swagger export, JSON formatında)
- ✅ **Final demo videosu** (sistem özellikleri tanıtımı)
- ✅ **Bitirme savunma sunumu** (slide deck)

### Veri ve Test
- ✅ **Dummy veri setleri** (4 kaynak için CSV dosyaları)
- ✅ **Test senaryoları** ve **test raporu**

---

## 0.12 Doküman Yapısı ve Okuma Rehberi

Bu dokümantasyon, farklı paydaşların farklı ihtiyaçları için **modüler bir yapıda** organize edilmiştir.

### 🎯 Kim, Hangi Bölümleri Okumalı?

**👨‍💼 Yönetici / Karar Verici** (Sporthink yöneticileri, akademik jüri)
- Bölüm 00 (bu bölüm) — Yönetici Özeti
- Bölüm 01 — Proje Kapsamı
- Bölüm 13 — Proje Planı
- Bölüm 14 — Risk Analizi
- Bölüm 15 — Future Roadmap

**👨‍💻 Yazılım Geliştirici / Bakımcı**
- Bölüm 02 — Teknoloji Stack
- Bölüm 03 — Sistem Mimarisi
- Bölüm 04 — Veri Modeli
- Bölüm 06 — API Spesifikasyonu
- Bölüm 11 — Deployment
- Bölüm 12 — Test Stratejisi

**🎨 Tasarımcı / Frontend Developer**
- Bölüm 07 — Frontend Tasarım
- Bölüm 10 — Filtreleme ve Segmentasyon

**📊 Veri Analisti / İş Analisti**
- Bölüm 08 — Veri Import
- Bölüm 09 — KPI Formülleri
- Bölüm 10 — Filtreleme ve Segmentasyon

**🔐 Güvenlik / DevOps Ekibi**
- Bölüm 05 — RBAC ve Güvenlik
- Bölüm 11 — Deployment ve DevOps

---

## 0.13 Sonuç

Sporthink Pazarlama ve E-Ticaret KPI Dashboard, **modern bir web teknoloji yığını** üzerinde inşa edilmiş, **profesyonel bir BI tool seviyesinde** kullanıcı deneyimi sunan, **ölçeklenebilir ve güvenli** bir kurumsal dashboard sistemidir.

Proje, hem **akademik bir bitirme projesi** olarak yazılım mühendisliği prensiplerini sergileme hedefi taşımakta, hem de **gerçek bir iş ihtiyacına çözüm** sunmak üzere Sporthink şirketinin operasyonel kullanımı için tasarlanmaktadır.

Sonraki bölümlerde, projenin **kapsamı**, **teknik mimarisi**, **veri modeli**, **güvenlik yaklaşımı** ve diğer tüm boyutları detaylı bir şekilde incelenecektir.

---

**Sonraki Bölüm:** [01 - Proje Kapsamı ve Hedefler](01-project-scope.md)

---

*Bölüm 00 sonu · Toplam 14 bölüm devam etmektedir.*
