# SPORTHINK PAZARLAMA VE E-TİCARET KPI DASHBOARD

## Proje Dokümantasyonu

---

<div align="center">

![Sporthink Logo](docs/assets/sporthink-logo.png)

**Sporthink İçin Özel Geliştirilmiş Dashboard Sistemi**

*Pazarlama ve E-Ticaret Performansının Tek Merkezde Görselleştirilmesi*

---

**Versiyon 1.0** · Mayıs 2026

</div>

---

## Proje Künyesi

| Bilgi | Detay |
|---|---|
| **Proje Adı** | Sporthink Pazarlama ve E-Ticaret KPI Dashboard |
| **Proje Tipi** | B2B Internal SaaS · Bitirme Projesi |
| **Müşteri** | Sporthink (sporthink.com.tr) |
| **Geliştirici** | Adem Yavuz |
| **Üniversite** | Dokuz Eylül Üniversitesi · Yönetim Bilişim Sistemleri (4. Sınıf) |
| **Danışman Hoca** | Prof. Dr. Vahap Tecim |
| **Başlangıç Tarihi** | 14 Mart 2026 |
| **Bitiş Tarihi** | 29 Mayıs 2026 |
| **Süre** | 11 Hafta |
| **Metodoloji** | Agile · Haftalık Sprint |
| **Doküman Versiyonu** | 1.0 |
| **Son Güncelleme** | Mayıs 2026 |

---

## İletişim

### Proje Geliştiricisi
**Adem Yavuz**
- 📧 ademyavuz093@gmail.com
- 📱 +90 531 451 6179
- 🔗 [linkedin.com/in/ademyavuztr](https://www.linkedin.com/in/ademyavuztr)

### Akademik Danışman
**Prof. Dr. Vahap Tecim**
- 📧 vahap.tecim@deu.edu.tr
- 🏛️ Dokuz Eylül Üniversitesi · İşletme Fakültesi · YBS Bölümü

### Sporthink Proje Ekibi
| Kişi | E-posta | Telefon |
|---|---|---|
| **Mert Gülseren** | mert.gulseren@sporthink.com.tr | 0539 925 11 94 |
| **Emre Yavşan** | emre.yavsan@sporthink.com.tr | 0541 896 59 48 |

---

## İçindekiler

Bu dokümantasyon **15 bölümden** oluşmaktadır. Her bölüm projenin farklı bir teknik veya fonksiyonel boyutunu detaylandırmaktadır.

| # | Bölüm | Açıklama |
|---|---|---|
| 00 | [Yönetici Özeti](docs/00-introduction.md) | Proje vizyonu, iş hedefleri ve genel özet |
| 01 | [Proje Kapsamı ve Hedefler](docs/01-project-scope.md) | Kapsam dahilindeki ve dışındaki özellikler, başarı kriterleri |
| 02 | [Teknoloji Stack ve Mimari Tercihler](docs/02-tech-stack.md) | Seçilen teknolojiler ve tercih sebepleri |
| 03 | [Sistem Mimarisi](docs/03-architecture.md) | 3-tier mimari, mikroservis yaklaşımı, deployment topolojisi |
| 04 | [Veri Modeli ve Veritabanı Tasarımı](docs/04-data-model.md) | 11 tablo, ER diyagramı, indexleme, partition stratejisi |
| 05 | [RBAC ve Güvenlik](docs/05-rbac-security.md) | Rol bazlı erişim, JWT auth, KVKK uyumu |
| 06 | [API Spesifikasyonu](docs/06-api-spec.md) | REST endpoint'leri, request/response yapıları |
| 07 | [Frontend Tasarım ve UI/UX](docs/07-frontend-design.md) | Component library, theming, sayfa yapısı |
| 08 | [Veri Import Sistemi](docs/08-import-system.md) | 4 adımlı wizard, async processing, validation |
| 09 | [KPI Hesaplama Modeli](docs/09-kpi-formulas.md) | 30+ KPI formülü ve hesaplama mantığı |
| 10 | [Filtreleme ve Segmentasyon](docs/10-filtering-segments.md) | Cross-filter, RFM analizi, kayıtlı görünümler |
| 11 | [Deployment ve DevOps](docs/11-deployment.md) | Docker, CI/CD, SSL, monitoring |
| 12 | [Test Stratejisi](docs/12-testing.md) | Unit, integration, E2E test yaklaşımı |
| 13 | [Proje Planı ve GANTT](docs/13-project-plan.md) | Haftalık görev dağılımı, sprint planı |
| 14 | [Risk Analizi ve Azaltma](docs/14-risk-analysis.md) | Risk matrisi, mitigation stratejileri |
| 15 | [Future Roadmap](docs/15-future-roadmap.md) | MVP sonrası yol haritası, geliştirme önerileri |

---

## Hızlı Başlangıç

### Sistem Gereksinimleri
- **OS:** Ubuntu 24.04 LTS (Production), macOS / Windows / Linux (Development)
- **Docker:** 27.0+
- **Docker Compose:** 2.30+
- **Node.js:** 22 LTS (development için)
- **Python:** 3.12+ (development için)

### Kurulum (Development)
```bash
# Repository'yi klonla
git clone https://github.com/<username>/sporthink-dashboard.git
cd sporthink-dashboard

# Environment variables
cp .env.example .env
# .env dosyasını düzenle (DB credentials, JWT secret, vb.)

# Docker Compose ile tüm servisleri başlat
docker compose up -d

# Frontend: http://localhost:5173
# Backend: http://localhost:8000
# Swagger: http://localhost:8000/api/docs
```

### Production Deployment
Detaylı deployment talimatları için bkz: [11. Bölüm - Deployment](docs/11-deployment.md)

---

## Proje İstatistikleri

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│   📊  11 Ana Sayfa                                    │
│   📈  30+ KPI                                         │
│   🗄️   11 Veri Tablosu + 3 Aggregation Tablosu       │
│   🔐  37 Granüler İzin                                │
│   🌐  2 Dil Desteği (TR / EN)                         │
│   🎨  2 Tema (Dark / Light)                           │
│   📥  4 Veri Kaynağı (GA4, Meta, Google Ads, ETic.)   │
│   ⚡  Async Job Processing (Celery + Redis)           │
│   🐳  Tam Containerize (Docker Compose)               │
│   🚀  GitHub Actions CI/CD                            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Lisans ve Telif Hakkı

Bu proje **Adem Yavuz** tarafından **Dokuz Eylül Üniversitesi Yönetim Bilişim Sistemleri Bölümü Bitirme Projesi** kapsamında geliştirilmektedir.

Sporthink şirketinin iç kullanımı için tasarlanmış olup, üçüncü taraflarla paylaşımı yazılı izne tabidir.

© 2026 Adem Yavuz · Sporthink. Tüm hakları saklıdır.

---

## Doküman Geçmişi

| Versiyon | Tarih | Değişiklik | Yazan |
|---|---|---|---|
| 1.0 | Mayıs 2026 | İlk yayın | Adem Yavuz |

---

*Bu doküman, projenin teknik ve fonksiyonel detaylarını içermekte olup, hem geliştirme sürecinde referans materyali, hem de teslim sonrası bakım dokümantasyonu olarak kullanılması amaçlanmıştır.*
