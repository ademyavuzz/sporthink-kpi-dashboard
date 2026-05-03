# 1. PROJE KAPSAMI VE HEDEFLER

> **Bu Bölümde Neler Var?**
> Bu bölüm, projenin **ne yapacağını ve ne yapmayacağını** net çizgilerle tanımlar. Kapsam dahilindeki fonksiyonel ve fonksiyonel olmayan gereksinimler, MVP (Minimum Viable Product) sınırı, başarı kriterleri ve kapsam dışı bırakılan özellikler detaylı olarak ele alınmıştır. Bu bölüm, proje süresince tüm taraflar (geliştirici, müşteri, danışman) için bağlayıcı bir referans noktası niteliğindedir.

## 1.1 Proje Vizyonu

Sporthink Pazarlama ve E-Ticaret KPI Dashboard, dijital pazarlama operasyonlarında karar alma süreçlerinin **veri odaklı, hızlı ve tutarlı** olmasını sağlayacak bir merkezi analiz platformu inşa etmeyi amaçlamaktadır.

Projenin uzun vadeli vizyonu şu üç ilkeyle özetlenir:

**Birleştirme:** Dağınık veri kaynaklarının (GA4, Meta Ads, Google Ads, e-ticaret veritabanı) **tek bir veri modelinde** standartlaştırılması ve sorgulanabilir hâle getirilmesi.

**Hızlandırma:** Manuel raporlama süresinin saatler düzeyinden **saniyeler düzeyine** indirilmesi. Karar vericilerin ihtiyaç duyduğu bilgiye en az tıklama ile erişebilmesi.

**Derinleştirme:** Standart platform raporlarının ötesinde **gelişmiş analitik** (cohort, funnel, RFM segmentasyon) yetenekleriyle, organizasyonun veri olgunluğunun bir üst seviyeye taşınması.

## 1.2 İş Hedefleri (Business Objectives)

Proje aşağıdaki ölçülebilir iş hedeflerine hizmet etmektedir:

### 1.2.1 Operasyonel Hedefler

| Hedef | Mevcut Durum | Hedeflenen | Ölçüm Yöntemi |
|---|---|---|---|
| Aylık performans raporu hazırlama süresi | 3-4 saat | 30 saniye | Stopwatch ile karşılaştırma |
| Karar destek için veri toplama süresi | 15-20 dakika | 30 saniye altı | Kullanıcı testi |
| Cross-channel analiz yapabilme | Mümkün değil | Tek tıkla mümkün | Fonksiyonel test |
| Veri tutarlılık oranı | Düşük (manuel hata) | %99+ (sistem-tabanlı) | Validation report |

### 1.2.2 Stratejik Hedefler

Bu hedefler doğrudan ölçülebilir olmasa da, projenin uzun vadeli başarısının göstergeleridir.

Pazarlama ekibinin **veri okuryazarlığını** artırmak; herkesin aynı tanımlanmış metriklere bakması ve aynı dilden konuşması.

Düşük performans gösteren kampanyaların **hızlı tespiti**; bütçe israfının azaltılması ve yüksek getirili kampanyalara kaynak yönlendirilmesi.

Müşteri segmentlerinin **net olarak tanımlanması**; pazarlama kampanyalarının daha etkili hedeflenmesi.

Gelecekte canlı API entegrasyonlarına **uygun bir altyapı** kurulması; sistemin "dummy veri" aşamasından "production veri" aşamasına geçişinin sancısız olması.

## 1.3 Fonksiyonel Gereksinimler

Bu bölüm, sistemin yapması beklenen tüm işlevleri kategorilere ayırarak listeler. Her gereksinim **FR-NN** formatında numaralandırılmıştır.

### 1.3.1 Kimlik Doğrulama ve Yetkilendirme

**FR-01.** Sistem, kullanıcıların e-posta ve şifre ile giriş yapabilmesini sağlamalıdır. Kimlik doğrulama JWT (Access + Refresh Token) yöntemiyle yapılmalıdır.

**FR-02.** Süper Admin sistem rolü, ilk kurulumda veritabanı seed işlemiyle otomatik oluşturulmalıdır. Süper Admin tüm yetkilere sahiptir, silinemez ve düzenlenemez.

**FR-03.** Süper Admin, yeni kullanıcı eklerken aynı ekranda kullanıcıya özel rol oluşturabilmeli, rol adı, rengi, ikonu ve yetkilerini tanımlayabilmelidir.

**FR-04.** Sistem, davet bazlı kullanıcı yönetimi modeli kullanmalıdır. Self-register (kendi kendine kayıt) açık olmamalıdır. Davet linkleri kullanıcının e-posta adresine gönderilir.

**FR-05.** Kullanıcı şifresini unuttuğunda, e-posta yoluyla 30 dakika geçerli tek kullanımlık link almalı; bu link üzerinden yeni şifre belirleyebilmelidir.

**FR-06.** Sistem, 5 yanlış şifre denemesi sonrasında hesabı 15 dakika kilitlemeli ve aynı IP'den dakikada en fazla 10 deneme kabul etmelidir.

**FR-07.** Kullanıcılar aynı anda birden fazla cihazdan giriş yapabilmelidir. Refresh token bazlı oturum yönetimi her cihaza ayrı oturum sağlamalıdır.

### 1.3.2 Rol Bazlı Erişim Kontrolü (RBAC)

**FR-08.** Sistem, modül-aksiyon bazlı 37 granüler izinli bir RBAC modeline sahip olmalıdır. İzin formatı `module.action` şeklindedir (örn: `imports.create`, `users.delete`).

**FR-09.** Süper Admin, rol oluştururken yetkileri modül bazlı accordion arayüzde seçebilmelidir. Her grup için "tümünü seç / kaldır" kısayolu bulunmalıdır.

**FR-10.** Bir rol silindiğinde, o role atanmış tüm kullanıcılar otomatik olarak pasifleşmelidir (`is_active=false`). Süper Admin manuel olarak yeni rol atayana kadar bu kullanıcılar giriş yapamaz.

**FR-11.** Permission değişiklikleri, kullanıcının bir sonraki API isteğinde devreye girmelidir. Backend her istekte güncel yetkileri DB'den (Redis cache ile hızlı şekilde) kontrol etmelidir.

### 1.3.3 Veri Import Modülü

**FR-12.** Sistem, dört farklı veri kaynağından (GA4 Trafik, Meta Ads, Google Ads, E-Ticaret) veri import edebilmelidir.

**FR-13.** Desteklenen dosya formatları: CSV, XLSX, JSON. Her dosyanın maksimum boyutu 50 MB ile sınırlıdır.

**FR-14.** Import süreci dört adımdan oluşmalıdır: (1) Dosya yükleme, (2) Kolon eşleme, (3) Doğrulama ve önizleme, (4) Veritabanına işleme.

**FR-15.** Sistem, kolon eşleme adımında otomatik öneri sunmalıdır. Fuzzy string matching ile kaynak ve hedef kolon adları arasında %80 üzeri benzerlik bulunduğunda otomatik eşleştirme önerilir.

**FR-16.** Veri doğrulama adımında sistem; veri tipi kontrolü, zorunlu alan kontrolü, duplicate kontrolü ve format kontrolü yapmalıdır. Hatalı satırlar listelenmeli, kullanıcıya CSV olarak indirme seçeneği sunulmalıdır.

**FR-17.** Import işlemi async (asenkron) olarak Celery + Redis altyapısı ile çalışmalıdır. Frontend, ilerleme durumunu her 2 saniyede bir polling yöntemiyle göstermelidir.

**FR-18.** Kullanıcı işlemekte olan bir import'u iptal edebilmelidir. İptal durumunda kısmen yazılmış veriler transaction rollback ile geri alınmalıdır.

**FR-19.** Aynı tarih ve eşleştirme anahtarına sahip duplicate veri tespit edildiğinde, sistem kullanıcıya üç seçenek sunmalıdır: (1) Üzerine yaz, (2) Atla, (3) İptal et.

**FR-20.** Her import bir benzersiz `import_id` ile takip edilmeli; veri tablolarındaki her satır bu ID'ye referans tutmalıdır. Bu sayede import rollback (geri alma) işlemi mümkün olmalıdır.

**FR-21.** Yüklenen orijinal dosyalar `/var/sporthink/uploads/{year}/{month}/` dizininde saklanmalıdır. 90 günden eski dosyalar otomatik temizlik cron job ile silinmelidir.

### 1.3.4 KPI Hesaplama ve Görselleştirme

**FR-22.** Sistem, dört kategoride toplam 30+ KPI'yı otomatik hesaplamalıdır: Trafik (8 KPI), Reklam (10 KPI), Satış (8 KPI), Pazarlama (5 KPI). Detaylı liste için bkz: Bölüm 09.

**FR-23.** KPI hesaplamaları, `kpi_daily_aggregates`, `kpi_monthly_aggregates` ve `kpi_campaign_aggregates` tablolarında önceden hesaplanmış olarak saklanmalı; sorgu süresi 50ms altında kalmalıdır.

**FR-24.** Sistem 11 ana sayfa içermelidir: Genel Özet, Trafik (GA4), Meta Ads, Google Ads, E-Ticaret, Kampanya Analizi, Funnel Analizi, Cohort/Retention, Ürün Performansı, Veri Import, Kullanıcı/Roller.

**FR-25.** Her sayfa, sayfanın amacına uygun KPI kartları, grafikler (line, bar, pie, funnel, heatmap) ve detaylı tablo görünümleri içermelidir.

**FR-26.** KPI kartları, seçili tarih aralığı için değer ve önceki dönemle karşılaştırmalı yüzde değişim (delta) göstermelidir. Pozitif/negatif değişim renk kodlamasıyla belirgin olmalıdır.

**FR-27.** Tüm grafikler ApexCharts kütüphanesiyle render edilmeli; tooltip, legend, zoom ve veri etkileşimi (hover, tıklama) desteklemelidir.

### 1.3.5 Filtreleme ve Segmentasyon

**FR-28.** Sistem, üst panelde global filtreler sunmalıdır: Tarih aralığı (preset + custom), Kanal, Cihaz, Şehir, Yeni vs. Geri Dönen Kullanıcı.

**FR-29.** Tarih aralığı için en az 12 hızlı preset bulunmalıdır: Bugün, Dün, Son 7 gün, Son 14 gün, Son 30 gün, Bu hafta, Geçen hafta, Bu ay, Geçen ay, Bu çeyrek, Bu yıl, Geçen yıl, Custom.

**FR-30.** Tarih filtresinde "Karşılaştırma" özelliği bulunmalı; kullanıcı önceki dönem veya geçen yılın aynı dönemi arasında seçim yapabilmelidir.

**FR-31.** Her sayfa kendi sayfa-spesifik filtrelerini sunmalıdır (örn: Meta Ads sayfasında Kampanya, Adset; E-Ticaret sayfasında Sipariş Durumu, Ödeme Yöntemi).

**FR-32.** Cross-filter özelliği aktif olmalıdır: Bir grafiğin bir parçasına tıklamak (örn: pie chart'ta Mobile dilimi), sayfadaki diğer grafiklerin filtrelenmesini sağlamalıdır. Aktif cross-filter chip olarak görünmeli ve kolayca kapatılabilmelidir.

**FR-33.** Filtre durumları URL parametrelerine yansıtılmalı (örn: `?dateFrom=2026-04-01&channel=Paid+Social`). Bu sayede filtre kombinasyonları paylaşılabilir ve bookmark'lanabilir olmalıdır.

**FR-34.** Sistem, "Saved Views" özelliğiyle kullanıcının filtre + layout kombinasyonlarını kaydetmesini ve sonradan tek tıkla yüklemesini sağlamalıdır. Kayıtlı görünümler kullanıcı bazlıdır (paylaşılabilir değildir, future feature).

**FR-35.** Visual segment builder ile kullanıcı; toplam sipariş, toplam ciro, ilk sipariş tarihi, son sipariş tarihi, şehir, cinsiyet, yaş grubu, kayıt kanalı gibi alanlar üzerinden dinamik müşteri segmentleri oluşturabilmelidir.

**FR-36.** Segment kuralları VE/VEYA mantıksal operatörlerle birleştirilebilmelidir. Sistem 500ms debounce ile anlık önizleme (eşleşen müşteri sayısı) göstermelidir.

### 1.3.6 Tema, Dil ve Kişiselleştirme

**FR-37.** Sistem light ve dark olmak üzere iki tema sunmalıdır. İlk girişte tarayıcının `prefers-color-scheme` tercihi otomatik algılanmalıdır.

**FR-38.** Sistem Türkçe ve İngilizce olmak üzere iki dil destekler. Varsayılan dil Türkçedir. Kullanıcı tercihi localStorage'da saklanır.

**FR-39.** Backend hata mesajları error code formatında dönmelidir (örn: `PASSWORD_TOO_SHORT`). Frontend bu kodları locale'ine göre çevirir. Backend i18n yapmaz.

**FR-40.** Tüm tarihler veritabanında UTC olarak saklanmalı; frontend tarafında Türkiye saatine (Europe/Istanbul) çevrilmelidir.

### 1.3.7 Export ve Raporlama

**FR-41.** Her sayfada veriyi CSV, JSON ve XLSX formatlarında dışa aktarma butonu bulunmalıdır. İki seçenek olmalıdır: (1) Görünen ham veriyi indir, (2) KPI özetini indir.

**FR-42.** Export edilecek veri 50.000 satır altındaysa sync olarak hemen indirilmelidir. 50.000 satır üstündeyse async (Celery) işlenmeli, hazır olduğunda kullanıcıya e-posta ile indirme linki gönderilmelidir.

### 1.3.8 Loglama ve Audit

**FR-43.** Tüm kritik kullanıcı işlemleri (login, logout, kullanıcı ekleme/düzenleme, rol değiştirme, import, export) audit log olarak MySQL'de saklanmalıdır.

**FR-44.** API logları ve hata logları rotating file sistemine yazılmalıdır. Loglar günlük rotasyona tabi tutulur, son 30 gün saklanır.

**FR-45.** Süper Admin yetkili kullanıcılar audit log sayfasından geçmiş işlemleri filtreleyerek görüntüleyebilmelidir.

### 1.3.9 Channel Mapping ve Veri Standartlaştırma

**FR-46.** Sistem, GA4 source ve medium bilgilerini standart channel_group değerlerine eşleyen bir mapping tablosu kullanmalıdır (örn: `google + organic` → `Organic Search`).

**FR-47.** Yeni bir source/medium kombinasyonu tespit edildiğinde, sistem otomatik olarak "Other" channel_group'una atamalı ve Süper Admin'i UI'da bilgilendirmelidir.

**FR-48.** Süper Admin, "Channel Mapping" yönetim sayfasından mevcut eşleştirmeleri düzenleyebilmeli, yeni mapping ekleyebilmeli ve atanmamış kanalları görebilmelidir.

## 1.4 Fonksiyonel Olmayan Gereksinimler (Non-Functional Requirements)

Fonksiyonel olmayan gereksinimler, sistemin **nasıl** davranması gerektiğini tanımlar. Performans, güvenlik, kullanılabilirlik, sürdürülebilirlik gibi kalite özelliklerini kapsar.

### 1.4.1 Performans

**NFR-01.** KPI sorguları 50ms altında yanıt vermelidir (aggregation tabloları + Redis cache ile).

**NFR-02.** Dashboard sayfa ilk yükleme süresi 2 saniyenin altında olmalıdır (3G mobile bağlantıda).

**NFR-03.** API endpoint'lerinin %95'i 200ms altında yanıt vermelidir.

**NFR-04.** 50 MB'lık bir CSV dosyasının import işlemi 5 dakika içinde tamamlanmalıdır.

**NFR-05.** Sistem en az 50 eşzamanlı kullanıcıyı performans kaybı olmadan desteklemelidir.

### 1.4.2 Güvenlik

**NFR-06.** Tüm iletişim HTTPS üzerinden TLS 1.2+ ile şifrelenmelidir (Let's Encrypt sertifikası).

**NFR-07.** Şifreler bcrypt (cost factor 12) ile hash'lenerek saklanmalıdır. Plaintext şifre hiçbir yerde tutulmaz.

**NFR-08.** JWT secret key minimum 256 bit (32 karakter) uzunluğunda olmalı; environment variable olarak tutulmalı, repository'ye commit edilmemelidir.

**NFR-09.** SQL injection saldırılarına karşı tüm sorgular SQLAlchemy ORM üzerinden parametrik olarak yapılmalıdır. Raw SQL kullanılmamalıdır.

**NFR-10.** Frontend tüm kullanıcı girdileri otomatik escape edilmeli (React varsayılan davranışı). XSS saldırılarına karşı `dangerouslySetInnerHTML` kullanılmamalıdır.

**NFR-11.** API endpoint'leri rate limit korumasına sahip olmalıdır: dakikada IP başına 100 istek, login endpoint için dakikada 5 istek.

**NFR-12.** Hassas alanlar (örn: kişisel ciro tutarları) Süper Admin dışındaki rollere maskelenebilir olmalıdır.

### 1.4.3 Kullanılabilirlik (Usability)

**NFR-13.** Tüm UI metinleri minimum WCAG 2.1 AA standardında okunabilirliği sağlamalıdır (kontrast oranları).

**NFR-14.** Sayfalarda anlık (real-time) feedback sağlanmalıdır: butonlara tıklama, form gönderimi, veri yükleme durumlarında loading state veya skeleton görüntülenmelidir.

**NFR-15.** Hata mesajları kullanıcı dostu olmalıdır. Teknik hata kodu yerine açıklayıcı mesaj sunulmalıdır (örn: "Bu e-posta adresi kullanılıyor" yerine "EMAIL_DUPLICATE" gösterilmemelidir).

**NFR-16.** Form validasyonu hem frontend (Zod) hem backend (Pydantic) tarafında çift katmanlı olmalıdır.

### 1.4.4 Bakım Yapılabilirlik (Maintainability)

**NFR-17.** Kod, ESLint (frontend) ve Ruff (backend) lint kurallarına uygun olmalıdır. CI pipeline'ında lint kontrolleri zorunlu olacaktır.

**NFR-18.** Her modül kendi unit testlerine sahip olmalı; toplam test coverage %70 üzerinde olmalıdır.

**NFR-19.** Kod commit mesajları Conventional Commits standardına uygun olmalıdır (örn: `feat(auth): add password reset endpoint`).

**NFR-20.** Frontend component'leri tek sorumluluk prensibine uygun olmalı; 200 satırı aşan component'ler bölünmelidir.

### 1.4.5 Ölçeklenebilirlik (Scalability)

**NFR-21.** Sistem mimarisi, ileride canlı API entegrasyonlarına geçiş için elverişli olmalıdır. Import katmanı soyutlanmış, yeni veri kaynağı eklemek için sadece yeni adapter eklenmesi yeterli olacak şekilde tasarlanmalıdır.

**NFR-22.** Büyük veri tabloları (`ga4_traffic`, `meta_ads`, `google_ads`, `orders`) tarih bazlı aylık partition kullanmalıdır. Bu sayede 1+ yıllık veri saklarken performans korunur.

**NFR-23.** Backend stateless olmalıdır. Session bilgisi server'da tutulmaz, JWT token üzerinden çalışır. Bu sayede ileride horizontal scaling (birden fazla backend instance) mümkün olur.

### 1.4.6 Erişilebilirlik (Accessibility)

**NFR-24.** Frontend, klavye navigasyonu desteklemeli; tüm interaktif elementler Tab ile erişilebilir olmalıdır.

**NFR-25.** Form elementleri label ile ilişkilendirilmiş olmalı, screen reader uyumluluğu sağlanmalıdır.

### 1.4.7 Uyumluluk (Compliance)

**NFR-26.** Sistem, KVKK (Kişisel Verilerin Korunması Kanunu) uyumlu olmalıdır. Müşteri verilerinin saklanma süresi, silinme talebi yönetimi, audit kayıtları KVKK gerekliliklerine uygun yapılandırılmalıdır.

**NFR-27.** Veri silme talebi (right to be forgotten) için manuel hard delete prosedürü tanımlanmış olmalıdır.

## 1.5 Kapsam Dışı (Out of Scope)

Aşağıdaki özellikler, projenin 11 haftalık MVP kapsamı dışında bırakılmıştır. Future Roadmap (Bölüm 15) içinde değerlendirilecektir.

### 1.5.1 Veri Entegrasyonu Sınırları

**Canlı API Entegrasyonları kapsam dışıdır.** Proje boyunca tüm veriler dosya bazlı (CSV, XLSX, JSON) import edilecektir. Google Analytics Data API, Meta Marketing Insights API, Google Ads API ile gerçek zamanlı bağlantı kurulmayacaktır. Ancak veri modeli bu API'lerin döndürdüğü alanlarla 1:1 uyumlu olacak şekilde tasarlanmıştır. Bu sayede gelecekte canlı entegrasyona geçiş, veri modelinde değişiklik gerektirmeyecektir.

**Otomatik veri çekme (scheduled import) kapsam dışıdır.** Sistem yalnızca kullanıcı tetiklemeli (manuel) import desteklemektedir. Belirli aralıklarla otomatik veri çekme özelliği MVP'de yer almayacaktır.

### 1.5.2 Kullanıcı Arayüzü Sınırları

**Mobil uygulama (native iOS/Android) kapsam dışıdır.** Sistem responsive web olarak tasarlanmaktadır; mobil tarayıcıda kullanılabilir olacaktır, ancak native mobil uygulama geliştirilmeyecektir.

**Drag-and-drop dashboard customization kapsam dışıdır.** Tüm sayfalar sabit layout ile sunulacaktır. Kullanıcının widget'ları sürükleyerek yer değiştirmesi, boyutlandırması veya kendi dashboard'unu inşa etmesi MVP'de yer almayacaktır.

**Kullanıcı bazlı özelleştirilmiş layout kaydetme kapsam dışıdır.** Saved Views özelliği yalnızca filtre kombinasyonu kaydeder, layout düzenini saklamaz.

### 1.5.3 İleri Güvenlik Sınırları

**İki Faktörlü Doğrulama (2FA) kapsam dışıdır.** Yalnızca e-posta + şifre kombinasyonu kullanılacaktır. TOTP (Google Authenticator) veya SMS bazlı 2FA MVP'ye dahil edilmeyecektir.

**Single Sign-On (SSO) kapsam dışıdır.** Google Workspace, Microsoft Azure AD veya Okta gibi kurumsal kimlik sağlayıcılarla entegrasyon yapılmayacaktır.

**IP whitelist veya geo-fencing kapsam dışıdır.** Belirli ülke veya IP'lerden erişim kısıtlaması bulunmayacaktır.

### 1.5.4 Raporlama Sınırları

**PDF rapor exportu kapsam dışıdır.** Yalnızca CSV, JSON, XLSX formatları desteklenecektir. Profesyonel görünümlü PDF rapor oluşturma future feature olarak değerlendirilecektir.

**Scheduled (zamanlanmış) raporlar kapsam dışıdır.** "Her Pazartesi 09:00'da haftalık özet raporunu emailime gönder" tipi otomatik raporlama MVP'de bulunmayacaktır.

**E-posta bazlı bildirim sistemi kapsam dışıdır.** KPI eşik değerleri aşıldığında otomatik uyarı e-postası gönderme özelliği yer almayacaktır.

### 1.5.5 Operasyonel Sınırlar

**Çoklu dil desteğinde sadece TR ve EN bulunacaktır.** Almanca, Arapça veya diğer diller için çeviri sağlanmayacaktır.

**Çoklu para birimi desteği kapsam dışıdır.** Tüm finansal değerler Türk Lirası (TRY) olarak saklanacak ve gösterilecektir.

**Multi-tenant (çoklu şirket) yapı kapsam dışıdır.** Sistem yalnızca Sporthink için tek bir tenant olarak yapılandırılacaktır. Aynı sistemin farklı şirketlere veri silosu içinde hizmet vermesi yapılmayacaktır.

**Audit log için ileri gelişmiş arama (full-text search, advanced filtering) kapsam dışıdır.** Sadece temel filtreleme (tarih aralığı, kullanıcı, işlem tipi) sunulacaktır.

### 1.5.6 İleri Analitik Sınırları

**Tahmin (Forecasting) modülü kapsam dışıdır.** Geçmiş veriden geleceğe yönelik trend tahmini (ARIMA, Prophet vb. modellerle) yapılmayacaktır.

**Anomali tespiti kapsam dışıdır.** Otomatik olarak "bu hafta CPC anormal şekilde yükseldi" tipi uyarılar üretilmeyecektir.

**A/B test analiz modülü kapsam dışıdır.** Kampanya varyantlarının istatistiksel anlamlılık testleri yapılmayacaktır.

**Customer Lifetime Value (CLV) hesaplaması kapsam dışıdır.** RFM analizi destekleniyor ancak ileri seviye CLV modelleri (Pareto/NBD, BG/NBD) bulunmayacaktır.

### 1.5.7 Kapsam Dışı Özet Tablo

| Kategori | Kapsam Dışı Özellik | Future Roadmap |
|---|---|---|
| Veri | Canlı API entegrasyonları | v2.0 |
| Veri | Scheduled import | v2.0 |
| UI | Mobil uygulama | v3.0 |
| UI | Drag-and-drop dashboard | v2.0 |
| Güvenlik | 2FA / SSO | v1.5 |
| Raporlama | PDF rapor | v1.5 |
| Raporlama | Scheduled email reports | v2.0 |
| Analitik | Forecasting | v3.0 |
| Analitik | Anomali tespiti | v3.0 |
| Operasyon | Multi-tenant | v3.0+ |

## 1.6 Başarı Kriterleri (Success Criteria)

Proje sonunda aşağıdaki kriterlerin tamamı karşılandığında başarılı sayılacaktır:

### 1.6.1 Fonksiyonel Başarı Kriterleri

Bu kriterler, sistemin temel işlevselliğinin çalıştığını gösterir.

Sistem üzerinden CSV/XLSX/JSON formatında dummy veri import edilebilmelidir. Import sonrası veri MySQL tablolarında doğru şekilde saklanmalı, KPI hesaplamaları otomatik tetiklenmelidir.

30 KPI'nın tamamı doğru hesaplanmalıdır. Manuel hesaplama ile sistemin döndürdüğü değerler karşılaştırıldığında %100 uyumlu olmalıdır.

11 ana sayfa erişilebilir ve fonksiyonel olmalıdır. Her sayfa, ilgili veri kaynağından beslenen anlamlı görselleştirmeler sunmalıdır.

Filtreleme sistemi global ve sayfa-spesifik düzeylerde çalışmalı; cross-filter etkileşimi sayfa içinde grafiklerin birbirini etkilemesini sağlamalıdır.

Süper Admin, sistem üzerinden yeni kullanıcı oluşturup, kullanıcıya özel rol tanımlayıp, yetkilerini düzenleyebilmelidir. Yetki değişiklikleri canlı kullanıcılarda bir sonraki istekte etkili olmalıdır.

### 1.6.2 Teknik Başarı Kriterleri

Bu kriterler, sistemin kalite hedeflerini karşıladığını gösterir.

Tüm API endpoint'leri Swagger/OpenAPI ile dokümante edilmiş olmalıdır. Swagger UI üzerinden her endpoint test edilebilir olmalıdır.

Backend test coverage %70 ve üzerinde olmalıdır (pytest + pytest-cov ile ölçülür). Kritik modüller (auth, KPI hesaplama, import) için bu oran %85 üzerinde olmalıdır.

CI/CD pipeline (GitHub Actions) çalışır durumda olmalıdır. Her commit'te lint, test ve build adımları otomatik tetiklenmelidir.

Sistem production sunucuya (VDS) deploy edilmiş, HTTPS üzerinden erişilebilir olmalıdır. Domain `dashboard.sporthink.com.tr` adresinde aktif olmalıdır.

KPI sorgularının ortalama yanıt süresi 50ms altında, dashboard sayfasının ilk yükleme süresi 2 saniye altında olmalıdır.

### 1.6.3 Dokümantasyon ve Teslim Kriterleri

15 bölümden oluşan teknik dokümantasyon tamamlanmış olmalıdır. Hem Markdown kaynak dosyalar, hem Word export'u teslim edilmelidir.

Kullanıcı kılavuzu (user guide), ekran görüntüleriyle desteklenmiş olarak hazırlanmalıdır.

Final demo videosu (5-10 dakika) hazırlanarak sistemin tüm temel özellikleri tanıtılmalıdır.

Bitirme savunma sunumu (slide deck) jüri için hazırlanmalıdır.

### 1.6.4 İş Senaryosu Başarı Kriterleri

Bu kriterler, projenin Sporthink ekibi için yarattığı somut değeri gösterir.

**Senaryo 1: Kanal Bazlı ROAS Düşüşü Tespiti**
Pazarlama yöneticisi, son 7 günde Meta Ads kanalının ROAS'ının önceki 7 güne göre düşüp düşmediğini, dashboard'a giriş yaptıktan sonra 30 saniye içinde fark edebilmelidir. KPI kartında negatif delta açık şekilde görünmelidir.

**Senaryo 2: Kampanya Performansı Karşılaştırma**
Pazarlama analisti, geçen ay yürütülen 5 kampanyanın CTR, CPC, ROAS ve dönüşüm oranlarını yan yana karşılaştırarak hangi kampanyanın en performanslı olduğunu tek bir tabloda görebilmelidir.

**Senaryo 3: Günlük Ciro Trendi**
Sporthink yönetimi, son 30 günlük ciro trendini grafikte görebilmeli; hangi günlerin pik olduğunu, hangi günlerin düşük olduğunu net şekilde okuyabilmelidir.

**Senaryo 4: Segment Bazlı Analiz**
Pazarlama analisti, "Son 90 günde en az 2 sipariş veren, Istanbul'lu, kadın müşteriler" segmentini visual rule builder ile oluşturabilmeli; bu segmentin toplam ciro katkısını ve ortalama sepet tutarını görebilmelidir.

**Senaryo 5: Yetki Bazlı Görünüm**
Sadece "Görüntüleyici" rolü atanmış bir kullanıcı sisteme giriş yaptığında; veri import sayfası, kullanıcı yönetimi sayfası ve sistem ayarları menülerini görmemelidir. Yalnızca kendisine atanmış view yetkilerine sahip sayfalar erişilebilir olmalıdır.

## 1.7 Proje Paydaşları (Stakeholders)

Projenin başarısını etkileyen ve etkilenecek tüm tarafları tanımlar.

### 1.7.1 Birincil Paydaşlar (Primary Stakeholders)

Bunlar projeye doğrudan katkı yapan veya doğrudan etkilenecek olan kişilerdir.

**Adem Yavuz — Geliştirici ve Proje Yöneticisi.** Projenin tasarım, geliştirme ve teslim süreçlerinden sorumlu. Tüm teknik kararları alır, danışman ve müşteri ile iletişimi yürütür. Tek geliştiriciden oluşan ekipte tüm rolleri (frontend, backend, DevOps, dokümantasyon) üstlenir.

**Prof. Dr. Vahap Tecim — Akademik Danışman.** Dokuz Eylül Üniversitesi YBS bölümünde proje danışmanı. Projenin akademik standartlara uygunluğunu denetler, periyodik geri bildirim sağlar, bitirme jürisinde değerlendirme yapar.

**Mert Gülseren ve Emre Yavşan — Sporthink İletişim Sorumluları.** Sporthink şirketinden proje boyunca ihtiyaç duyulacak iş gereksinimlerini, veri yapılarını ve operasyonel detayları sağlar. Ayrıca IT talebi (sunucu kurulumu) için Sporthink IT birimi ile koordinasyonu yürütür.

### 1.7.2 İkincil Paydaşlar (Secondary Stakeholders)

Bunlar projeden dolaylı olarak etkilenecek olan kişilerdir.

**Sporthink Pazarlama ve E-Ticaret Ekibi.** Sistem teslim sonrası operasyonel kullanıcılar olarak yer alacak. Doğrudan geliştirme sürecine dahil olmasalar da, sistemin sunduğu özellikler bu ekibin günlük iş akışını şekillendirecektir.

**Sporthink IT Birimi.** Sunucu (VDS) kurulumu, DNS yönlendirmesi, SSL sertifikası süreçlerinde teknik destek sağlar.

**DEU YBS Bölüm Başkanlığı ve Bitirme Jürisi.** Projenin akademik değerlendirmesini yapar. Bitirme savunmasında final not verilir.

### 1.7.3 Paydaş İletişim Planı

| Paydaş | İletişim Sıklığı | Yöntem | Konu |
|---|---|---|---|
| Danışman Hoca | Haftada 1 kez | E-posta + yüz yüze görüşme | İlerleme raporu, akademik geri bildirim |
| Sporthink Ekibi | İki haftada 1 kez | E-posta / WhatsApp / Online toplantı | İş gereksinimi netleştirme, demo |
| Sporthink IT | Gerektiğinde | E-posta + ticket sistemi | Sunucu, DNS, SSL talepleri |
| Pazarlama Ekibi | Final teslim öncesi | Demo sunumu | Kullanıcı kabul testi |

## 1.8 Varsayımlar ve Bağımlılıklar

### 1.8.1 Varsayımlar (Assumptions)

Projenin başarılı tamamlanması için doğru olduğu varsayılan unsurlar:

Sporthink IT biriminin VDS sunucu kurulumunu Hafta 3 sonuna kadar tamamlayacağı varsayılır. Aksi takdirde lokal geliştirme ortamında final teslim yapılır.

Dummy veri setlerinin Hafta 4 başına kadar Sporthink ekibinden veya örnek veri olarak hazırlanacağı varsayılır. Excel spec dosyası bu konuda yol göstericidir.

Geliştirici (Adem Yavuz) tek bir kişi olarak projeyi yürütecektir. Hastalık, askerlik, beklenmedik akademik yük gibi durumlarda zaman riski artar.

Üçüncü taraf kütüphaneler (React, FastAPI, MySQL, Redis) proje süresince kararlı sürümleriyle çalışmaya devam edecektir. Major version değişiklikleri sırasında breaking change beklenmemektedir.

Sporthink şirketinin proje gereksinimlerinde Hafta 5'ten sonra büyük kapsam değişikliği talep etmeyeceği varsayılır.

### 1.8.2 Bağımlılıklar (Dependencies)

Projenin diğer süreç veya sistemlere olan bağımlılıkları:

**Sunucu Bağımlılığı:** Proje Hafta 10-11'de canlı sunucuya deploy edilebilmesi için VDS kurulumunun Hafta 3-4 itibariyle hazır olması gerekir.

**Domain Bağımlılığı:** `dashboard.sporthink.com.tr` subdomain'inin DNS kayıtlarının Sporthink IT tarafından yönlendirilmesi gerekir.

**SSL Bağımlılığı:** Let's Encrypt sertifikasının domain üzerinde aktive edilmesi için DNS kayıtlarının doğru çalışması gerekir.

**E-posta Servisi Bağımlılığı:** Şifre sıfırlama linklerinin gönderilmesi için SendGrid, Mailgun veya AWS SES servislerinden birinin (free tier) hesabının açılmış olması gerekir.

**Veri Kaynağı Bağımlılığı:** Test ve demo amaçlı dummy veri setlerinin formatı, Excel spec dokümanına uygun olmalıdır.

## 1.9 Sonraki Bölüm

Bu bölümde projenin ne yapacağı (kapsam) ve ne yapmayacağı (kapsam dışı) net olarak tanımlandı. Sonraki bölümde, projenin teknik temellerini oluşturan teknoloji tercihleri ve bu tercihlerin gerekçeleri detaylı olarak ele alınacaktır.

**Sonraki Bölüm:** [02 - Teknoloji Stack ve Mimari Tercihler](02-tech-stack.md)

*Bölüm 01 sonu.*
