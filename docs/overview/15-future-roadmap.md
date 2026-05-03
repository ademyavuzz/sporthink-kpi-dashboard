# 15. GELECEK ROADMAP

> **Bu Bölümde Neler Var?**
> Bu bölüm, v1 (bitirme projesi sürümü) sonrası planlanmış geliştirmelerin yol haritasını sunmaktadır. v1.5, v2 ve v3 sürümleri için planlanan özellikler, tahmini geliştirme süreleri ve öncelik sıralamaları detaylandırılmıştır. Roadmap, proje sürecinde kapsamı dışında bırakılan özellikleri ve Sporthink'ten gelen "future" istekleri kapsar.

## 15.1 Roadmap Felsefesi

v1 sürümünün hedefi, **çalışan ve tüm temel KPI ihtiyaçlarını karşılayan bir minimum viable product (MVP) teslim etmektir**. v1 başarıyla tamamlandıktan sonra aşağıdaki sürümlerde kademeli iyileştirmeler ve genişlemeler planlanmıştır.

Her sürüm için aşağıdaki kriterler uygulanmıştır:

**v1.5 (Quick Wins):** v1 deploy edildikten sonra ilk 1-2 ay içinde eklenebilecek, görece düşük efor gerektiren ama yüksek değerli özellikler.

**v2 (Major Enhancement):** 3-6 ay süren önemli mimari iyileştirmeler ve yeni modüller. Genellikle production veriden öğrenilen ihtiyaçlara göre şekillenir.

**v3 (Transformative):** AI/ML, gerçek zamanlı veri akışı, mobil uygulama gibi büyük dönüşüm projeleri. 6+ ay sürer.

## 15.2 v1.5 - Quick Wins (Tahmini Süre: 4-6 hafta)

v1 sonrası eklenmesi en kolay ve etkili özellikler.

### 15.2.1 İki Faktörlü Kimlik Doğrulama (2FA)

**Açıklama:** Kullanıcılar TOTP (Time-based One-Time Password) tabanlı 2FA aktifleştirebilir. Google Authenticator, Authy gibi uygulamalarla uyumlu.

**Tahmini Efor:** 1 hafta

**Teknoloji:** `pyotp` kütüphanesi (backend), `qrcode.react` (QR code üretimi).

**Öncelik:** Yüksek (güvenlik kritik özellik)

### 15.2.2 PDF Rapor Çıktısı

**Açıklama:** Dashboard'daki KPI sayfaları PDF olarak indirilebilir. Marka renkleri ve logo ile profesyonel rapor üretimi.

**Tahmini Efor:** 1.5 hafta

**Teknoloji:** WeasyPrint (Python), HTML template tabanlı PDF generation.

**Öncelik:** Yüksek (yöneticilerden sık gelen istek)

### 15.2.3 E-posta ile Zamanlanmış Raporlar

**Açıklama:** Kullanıcı haftalık veya aylık zamanlanmış rapor tanımlayabilir. Belirlenen günde otomatik PDF üretilip belirtilen email adreslerine gönderilir.

**Tahmini Efor:** 1.5 hafta

**Teknoloji:** Celery Beat ile scheduling, SendGrid ile email teslimi.

**Öncelik:** Yüksek

**Örnek Kullanım:**
```
Rapor Adı: Haftalık Pazarlama Özeti
Sayfalar: Genel Özet, Trafik, Reklam Performansı
Frekans: Her Pazartesi 09:00
Alıcılar: ceo@sporthink.com.tr, marketing@sporthink.com.tr
Filtreler: Geçen hafta verisi
```

### 15.2.4 Dashboard Üzerinde Yorum / Annotation

**Açıklama:** Kullanıcılar herhangi bir KPI veya tarih noktasına yorum ekleyebilir. Örnek: "21 Mart - Big Sale kampanyası başladı".

**Tahmini Efor:** 1 hafta

**Teknoloji:** Yeni `annotations` tablosu, frontend annotation overlay.

**Öncelik:** Orta

### 15.2.5 Aktif Oturumlar (Session Management UI)

**Açıklama:** Kullanıcı kendi aktif oturumlarını (cihaz, IP, son aktivite) görebilir ve uzaktan logout yapabilir.

**Tahmini Efor:** 0.5 hafta

**Teknoloji:** Mevcut `refresh_tokens` tablosu üzerinde liste UI'ı.

**Öncelik:** Orta

### 15.2.6 Bulk Kullanıcı İşlemleri

**Açıklama:** Süper Admin birden fazla kullanıcıyı CSV ile toplu olarak ekleyebilir, role atayabilir, pasifleştirebilir.

**Tahmini Efor:** 0.5 hafta

**Öncelik:** Düşük

## 15.3 v2 - Major Enhancement (Tahmini Süre: 4-6 ay)

Mimari ve fonksiyonel olarak önemli genişlemeler.

### 15.3.1 Gerçek API Entegrasyonu

**Açıklama:** GA4, Meta Marketing, Google Ads ve e-ticaret API'lerinin doğrudan entegrasyonu. Manuel CSV import yerine zamanlanmış otomatik veri çekme.

**Tahmini Efor:** 6 hafta

**Teknoloji:**
- Google Analytics Data API v1 (`google-analytics-data` Python SDK)
- Meta Marketing API (`facebook-business` SDK)
- Google Ads API (`google-ads` SDK)
- OAuth 2.0 ile token yönetimi
- Celery scheduled tasks (her gece ETL)

**Öncelik:** Çok Yüksek

**Tahmini Etki:** Manuel import iş yükü %95 azalır, veri her zaman güncel.

### 15.3.2 Çoklu Şirket / Multi-Tenant Mimari

**Açıklama:** Birden fazla Sporthink alt markası veya bayisi için izole tenant'lar. Aynı uygulamada birden fazla şirketin verileri ayrı yönetilir.

**Tahmini Efor:** 8 hafta

**Teknoloji:**
- DB: Tenant ID kolonu tüm tablolara eklenir
- Row-level security policy
- Kullanıcı rol tanımları tenant-aware

**Öncelik:** Orta (Sporthink genişlerse aktif olur)

### 15.3.3 Tahminleme (Forecasting)

**Açıklama:** Geçmiş veriye dayanarak gelecek 7/30 günün satış, trafik ve harcama tahminleri.

**Tahmini Efor:** 6 hafta

**Teknoloji:**
- Prophet (Facebook) veya statsmodels SARIMA
- Python ML pipeline
- Backend API üzerinde tahmin endpoint'i

**Öncelik:** Yüksek (yöneticiler için stratejik karar destekleri)

### 15.3.4 Anomali Tespiti

**Açıklama:** KPI'larda olağandışı dalgalanma tespit edildiğinde otomatik uyarı. Örnek: "Bugün CTR %50 düştü, dikkat!"

**Tahmini Efor:** 4 hafta

**Teknoloji:**
- Statistical anomaly detection (Z-score, IQR)
- Slack/Email notification
- In-app notification center

**Öncelik:** Yüksek

### 15.3.5 Drag-and-Drop Custom Dashboard

**Açıklama:** Kullanıcılar kendi dashboard'larını düzenleyebilir. Widget'ları sürükle-bırak ile yerleştirebilir, KPI seçebilir, chart tipi değiştirebilir.

**Tahmini Efor:** 5 hafta

**Teknoloji:**
- `react-grid-layout` veya `dnd-kit`
- Dashboard layout JSON olarak DB'de saklanır
- Widget framework: her KPI/chart tipi bir widget

**Öncelik:** Orta

### 15.3.6 Sosyal Medya Entegrasyonu (Genişletme)

**Açıklama:** TikTok Ads, LinkedIn Ads, Twitter Ads gibi yeni platformların eklenmesi.

**Tahmini Efor:** 3 hafta (her platform için)

**Öncelik:** Düşük (Sporthink'in pazarlama bütçesine bağlı)

### 15.3.7 Audit Log Genişletilmiş Filtreler ve Export

**Açıklama:** Audit log sayfasında detaylı filtreler, JSON export, CSV export, audit log analitiği.

**Tahmini Efor:** 1.5 hafta

**Öncelik:** Orta

### 15.3.8 Webhooks

**Açıklama:** Belirli olaylar gerçekleştiğinde (örn: import tamamlandı, anomali tespit edildi) dış sistemlere HTTP POST ile bildirim.

**Tahmini Efor:** 2 hafta

**Öncelik:** Düşük

## 15.4 v3 - Transformative (Tahmini Süre: 6+ ay)

Büyük ölçekli dönüşüm projeleri.

### 15.4.1 Mobil Uygulama (iOS / Android)

**Açıklama:** React Native ile cross-platform mobil uygulama. Yöneticiler hareket halindeyken KPI'lara erişebilir.

**Tahmini Efor:** 12 hafta

**Teknoloji:**
- React Native + Expo
- Mevcut REST API'yi yeniden kullanır
- Push notifications (FCM)
- Biometric authentication (Face ID, Touch ID)

**Öncelik:** Orta

### 15.4.2 SSO Entegrasyonu

**Açıklama:** Google Workspace, Microsoft Azure AD, SAML 2.0 ile Single Sign-On.

**Tahmini Efor:** 4 hafta

**Teknoloji:**
- `python-social-auth`
- SAML için `python3-saml`
- IdP konfigürasyonu

**Öncelik:** Yüksek (kurumsal müşteriler için kritik)

### 15.4.3 AI Asistan / Doğal Dil Sorgu

**Açıklama:** Kullanıcı doğal dilde soru sorar, AI yanıt üretir. Örnek: "Bu hafta hangi kampanyanın ROAS'ı en yüksekti?"

**Tahmini Efor:** 8 hafta

**Teknoloji:**
- LLM API (OpenAI GPT-4, Anthropic Claude)
- Text-to-SQL pipeline
- Vector database (Pinecone, Weaviate) ile context retrieval

**Öncelik:** Düşük (gelişmiş feature, kullanıcı talebi belirsiz)

### 15.4.4 Real-Time Streaming Dashboard

**Açıklama:** Veriler dakikalık olarak güncellenir. Canlı satış akışı, gerçek zamanlı kampanya performansı.

**Tahmini Efor:** 10 hafta

**Teknoloji:**
- Apache Kafka veya RabbitMQ
- WebSocket (Socket.IO) ile frontend canlı update
- ClickHouse veya TimescaleDB (time-series için optimize)

**Öncelik:** Düşük (mevcut günlük güncelleme yeterli)

### 15.4.5 Marketing Mix Modeling (MMM)

**Açıklama:** Hangi pazarlama kanalının satışlara ne kadar katkı sağladığını istatistiksel olarak modelleyen analiz.

**Tahmini Efor:** 8 hafta

**Teknoloji:**
- LightweightMMM (Google) veya PyMC-Marketing
- Bayesian regression
- Visualization layer

**Öncelik:** Orta (büyük şirketler için yüksek değer)

### 15.4.6 Multi-Touch Attribution

**Açıklama:** Bir satışa ulaşan kullanıcı yolculuğunda tüm temas noktalarının (touchpoints) katkısının hesaplanması.

**Tahmini Efor:** 6 hafta

**Teknoloji:**
- Markov chains attribution
- Shapley value modeling

**Öncelik:** Düşük

## 15.5 Roadmap Önceliklendirme Matrisi

Tüm önerilen özellikler önceliğine göre sıralanmış:

| Sürüm | Özellik | Efor (hafta) | Öncelik | Değer |
|---|---|---|---|---|
| v1.5 | İki Faktörlü Auth (2FA) | 1 | Yüksek | Güvenlik |
| v1.5 | PDF Rapor Çıktısı | 1.5 | Yüksek | İş değeri |
| v1.5 | Zamanlanmış Email Raporlar | 1.5 | Yüksek | İş değeri |
| v1.5 | Aktif Oturumlar UI | 0.5 | Orta | UX |
| v1.5 | Annotations | 1 | Orta | Analiz |
| v1.5 | Bulk Kullanıcı İşlemleri | 0.5 | Düşük | Ops |
| v2 | Gerçek API Entegrasyonu | 6 | Çok Yüksek | İş değeri |
| v2 | Tahminleme (Forecasting) | 6 | Yüksek | Stratejik |
| v2 | Anomali Tespiti | 4 | Yüksek | Operasyonel |
| v2 | Drag-and-Drop Dashboard | 5 | Orta | UX |
| v2 | Multi-Tenant | 8 | Orta | Ölçeklenme |
| v2 | Yeni Reklam Platformları | 3 | Düşük | Genişleme |
| v2 | Audit Log Genişletme | 1.5 | Orta | Compliance |
| v2 | Webhooks | 2 | Düşük | Entegrasyon |
| v3 | SSO Entegrasyonu | 4 | Yüksek | Kurumsal |
| v3 | Mobil Uygulama | 12 | Orta | Erişilebilirlik |
| v3 | Marketing Mix Modeling | 8 | Orta | İleri analiz |
| v3 | AI Asistan | 8 | Düşük | Gelişmiş |
| v3 | Real-Time Streaming | 10 | Düşük | İleri |
| v3 | Multi-Touch Attribution | 6 | Düşük | İleri analiz |

## 15.6 Değer-Efor Matrisi

```
                    EFOR (hafta)
                  Az          Orta         Çok
              ┌──────────┬──────────┬──────────┐
              │ 2FA       │ Forecast│ Mobil App│
        Yük.  │ Sched.    │ Anomaly │ MMM      │
              │ Email     │ API     │          │
              │ PDF Rep.  │ Integ.  │          │
              ├──────────┼──────────┼──────────┤
        Orta  │ Annot.    │ Drag-   │ Multi-   │
DEĞER         │ Sessions  │ Drop    │ Tenant   │
              │ SSO (kis.)│         │          │
              ├──────────┼──────────┼──────────┤
        Düş.  │ Bulk      │ Webhook │ AI Asist.│
              │ Audit Ext │ Yeni    │ Real-Time│
              │           │ Platform│          │
              └──────────┴──────────┴──────────┘
                  ↑
                "Quick Wins" - bu kısma öncelik
```

**Quick Wins (sol-üst köşe):** v1.5 sürümüne dahil edilen özellikler. Az efor, yüksek değer.

**Strategic Bets (sağ-üst köşe):** v2-v3 sürümlerine yayılan büyük yatırımlar.

**Avoid / Defer (sol-alt köşe):** Kullanıcı talebi olmadıkça ertelenir.

## 15.7 Roadmap Versiyon Numaralama

Sürüm numaralandırma Semantic Versioning standardı kullanılır:

```
MAJOR.MINOR.PATCH

MAJOR  : Geriye dönük uyumluluğu bozan değişiklikler
MINOR  : Yeni özellik eklemeleri (geriye dönük uyumlu)
PATCH  : Bug fix ve küçük iyileştirmeler
```

| Versiyon | Kapsam | Tahmini Tarih |
|---|---|---|
| v1.0.0 | Bitirme projesi MVP | Mayıs 2026 |
| v1.0.x | Bug fix sürümleri | Mayıs-Haziran 2026 |
| v1.5.0 | Quick Wins (2FA, PDF, scheduled email) | Temmuz 2026 |
| v1.6.0 | Annotations, Sessions, Bulk Ops | Ağustos 2026 |
| v2.0.0 | Gerçek API entegrasyonu | Aralık 2026 |
| v2.1.0 | Forecasting | Şubat 2027 |
| v2.2.0 | Anomaly Detection | Mart 2027 |
| v2.3.0 | Drag-and-Drop Dashboard | Mayıs 2027 |
| v3.0.0 | SSO + Mobile App | Eylül 2027 |
| v3.1.0 | Marketing Mix Modeling | Aralık 2027 |
| v3.2.0 | AI Asistan | Mart 2028 |

Bu tarihler tahminidir; gerçek roadmap Sporthink'in stratejik öncelikleri ve kullanıcı geri bildirimine göre güncellenir.

## 15.8 Teknik Borç (Technical Debt) Yönetimi

Roadmap'in yanı sıra, biriktiği teknik borçların ödenmesi de planlanmıştır.

### 15.8.1 Beklenen Teknik Borçlar

| Borç | Açıklama | Çözüm Süresi |
|---|---|---|
| Test coverage düşük modüller | %75 altında kalan modüller var olabilir | 1 hafta |
| Type hint eksikliği | Bazı eski kodlarda type hint eksik | 0.5 hafta |
| Migration consolidation | 50+ Alembic migration var ise consolidate edilebilir | 0.5 hafta |
| Frontend bundle optimization | Lazy loading, code splitting iyileştirme | 1 hafta |
| Documentation update | Kod değişiklikleri sonrası doc güncelleme | Sürekli |
| Dependency updates | Kütüphane sürüm güncellemeleri | Aylık |

### 15.8.2 Tech Debt Sprint

Her v1.5+ döngüsünde 1 sprint (2 hafta) tamamen teknik borç ödemesine ayrılır. Bu sayede yeni özellik geliştirmesi sürdürülürken temel kalite korunur.

## 15.9 Topluluk ve Açık Kaynak Potansiyeli

İleride sistemin belirli modülleri açık kaynak olarak yayınlanabilir:

**Generic KPI Dashboard Framework:** Veri kaynağı agnostik bir KPI dashboard frameworku olarak GitHub'da paylaşılabilir.

**Reusable Components:** shadcn/ui üzerine inşa edilen KPI Card, Cohort Heatmap gibi bileşenler npm paketi olarak yayınlanabilir.

**API Connector Library:** GA4, Meta, Google Ads bağlayıcıları ortak bir kütüphane olarak paketlenebilir.

Bu olasılıklar uzun vadeli plan olup, projenin ilk önceliği değildir.

## 15.10 Sonuç ve Sonraki Adımlar

Bu roadmap, projenin v1 sonrası evrim yolunu sunmaktadır. v1'in başarıyla teslim edilmesi ve kullanıcı geri bildirimlerinin alınması, sonraki sürümlerin önceliklendirilmesinde belirleyici olacaktır.

**Sonraki Adımlar:**

1. **Mayıs 2026 (Bitirme):** v1.0 teslim ve savunma.
2. **Haziran 2026:** Sporthink'te 2-4 hafta canlı kullanım, geri bildirim toplama.
3. **Temmuz 2026:** İlk Quick Wins (v1.5) için planlama ve geliştirme başlangıcı.
4. **Q4 2026:** v2.0 öncesi mimari hazırlık (API entegrasyon araştırması).
5. **Sürekli:** Kullanıcı görüşmeleri, feature isteklerinin değerlendirilmesi.

## 15.11 Kapanış

Sporthink KPI Dashboard, bitirme projesi olarak başlamış ancak Sporthink'in gerçek iş ihtiyacını karşılayan, sürdürülebilir ve genişletilebilir bir ürün olma potansiyeline sahiptir. Bu dokümanın hedefi, projenin yalnızca "akademik bir çalışma" olarak değil, **uzun vadeli bir ürün** olarak yönetilebilmesi için gerekli yol haritasını ortaya koymaktır.

Roadmap canlı bir belgedir; öğrenildikçe ve ihtiyaçlar değiştikçe güncellenir. Her sürüm öncesi yeniden gözden geçirilmesi önerilir.

---

**Doküman Sonu.**

Bu doküman Sporthink Pazarlama ve E-Ticaret KPI Dashboard projesinin teknik tasarım ve planlama belgesidir. 15 bölüm boyunca proje kapsamı, teknoloji stack, mimari, veri modeli, güvenlik, API spesifikasyonu, frontend tasarımı, import sistemi, KPI formülleri, filtreleme, deployment, test, proje planı, riskler ve gelecek roadmap detaylı olarak ele alınmıştır.

**Hazırlayan:** Adem Yavuz
**Danışman:** Prof. Dr. Vahap Tecim
**Tarih:** Mayıs 2026
**Versiyon:** 1.0
**Lisans:** Sporthink Spor Malzemeleri Ticaret A.Ş. ve Dokuz Eylül Üniversitesi YBS Bölümü için hazırlanmıştır.

*Bölüm 15 sonu — Doküman tamamlanmıştır.*
