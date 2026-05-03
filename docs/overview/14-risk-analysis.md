# 14. RİSK ANALİZİ VE YÖNETİMİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, projenin karşılaşabileceği teknik, operasyonel ve süreçsel riskleri ele almaktadır. Her risk için olasılık-etki matrisi, mitigation (azaltma) stratejisi, contingency (acil durum) planı ve sorumlu taraf belirlenmiştir. Risk yönetimi proaktif bir yaklaşımla, riskler gerçekleşmeden önce önlem alınması amacıyla tasarlanmıştır.

## 14.1 Risk Yönetim Yaklaşımı

Projede risk yönetimi dört aşamalı bir süreçle yürütülür:

**Tanımlama (Identification):** Olası risklerin önceden tespit edilmesi. Sprint planlaması sırasında ekip beyin fırtınası yaparak yeni riskler eklenir.

**Değerlendirme (Assessment):** Her riskin olasılık (Probability) ve etki (Impact) açısından puanlanması. Yüksek puanlı riskler öncelikli takip edilir.

**Önlem (Mitigation):** Risk gerçekleşmeden önce yapılacak proaktif aksiyonlar. Kod, süreç veya altyapıya yansıyan iyileştirmeler.

**İzleme (Monitoring):** Riskin durumunun haftalık olarak gözden geçirilmesi. Yeni risk eklendiğinde veya bir risk gerçekleştiğinde liste güncellenir.

## 14.2 Risk Skorlama Matrisi

Her risk Olasılık × Etki formülü ile puanlanır:

| Olasılık | Skor | Açıklama |
|---|---|---|
| Çok Düşük | 1 | Gerçekleşmesi neredeyse imkânsız |
| Düşük | 2 | Nadiren gerçekleşir |
| Orta | 3 | Olabilir |
| Yüksek | 4 | Muhtemelen gerçekleşir |
| Çok Yüksek | 5 | Neredeyse kesin |

| Etki | Skor | Açıklama |
|---|---|---|
| Çok Düşük | 1 | İhmal edilebilir |
| Düşük | 2 | Küçük gecikme veya işlev kaybı |
| Orta | 3 | Sprint hedefini etkiler |
| Yüksek | 4 | Proje teslim tarihini etkiler |
| Çok Yüksek | 5 | Proje başarısızlığı tehlikesi |

**Risk Önceliği:**

| Toplam Skor | Öncelik | Renk Kodu | Aksiyon |
|---|---|---|---|
| 1 - 4 | Düşük | Yeşil | İzle, gerekirse not al |
| 5 - 9 | Orta | Sarı | Mitigation planı hazırla |
| 10 - 14 | Yüksek | Turuncu | Aktif takip, haftalık review |
| 15 - 25 | Kritik | Kırmızı | Acil aksiyon, günlük takip |

## 14.3 Teknik Riskler

### 14.3.1 R-T01: VDS Sunucu Geç Tahsis Edilmesi

| Alan | Değer |
|---|---|
| **Risk ID** | R-T01 |
| **Kategori** | Altyapı |
| **Olasılık** | 4 (Yüksek) |
| **Etki** | 4 (Yüksek) |
| **Skor** | 16 (Kritik) |
| **Sorumlu** | Sporthink IT, Adem Yavuz |

**Açıklama:** Sporthink IT departmanının VDS provisioning süreci tahmin edilenden uzun sürebilir. Bu durum Sprint 9-10'daki deployment çalışmalarını geciktirebilir.

**Mitigation:**

- VDS talebi Sprint 1 (14 Mart) içinde IT'ye iletilecek; provisioning için 5-7 iş günü pencere bırakılacak.
- Talep formu hazır şekilde hazırlanmıştır (bkz: Bölüm 11.3).
- Backup plan: Hetzner, DigitalOcean gibi hizmet sağlayıcılardan kişisel bir VDS (10-15 USD/ay) geçici olarak kiralanır. Demo süreci kişisel VDS üzerinde tamamlanır, Sporthink VDS'ine sonra göç ettirilir.

**Contingency:** VDS Sprint 9 başına kadar hazır olmazsa, kişisel VDS ile demo yapılır. Final teslim öncesi gerçek sunucuya geçiş yapılır.

### 14.3.2 R-T02: Domain DNS Yayılma Gecikmesi

| Alan | Değer |
|---|---|
| **Risk ID** | R-T02 |
| **Kategori** | Altyapı |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 2 (Düşük) |
| **Skor** | 4 (Düşük) |
| **Sorumlu** | Sporthink IT |

**Açıklama:** `dashboard.sporthink.com.tr` subdomain'inin DNS yayılması 24 saate kadar uzayabilir. Bu sürede SSL sertifikası alınamaz.

**Mitigation:**

- DNS kaydı Sprint 9 başında talep edilecek (deployment çalışmalarından önce).
- TTL düşük (300 saniye) ayarlanacak.
- IP bazlı geçici erişim ile testler yapılabilir.

### 14.3.3 R-T03: Üçüncü Parti API Değişiklikleri

| Alan | Değer |
|---|---|
| **Risk ID** | R-T03 |
| **Kategori** | Bağımlılık |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 3 (Orta) |
| **Skor** | 6 (Orta) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Bu projede gerçek API entegrasyonu **bulunmamaktadır** (dummy data ile çalışılır). Ancak veri yapısının GA4 / Meta / Google Ads API formatına uyumlu olması hedeflenir; API'lerde yapılacak değişiklikler ileride gerçek entegrasyon yapıldığında sorun yaratabilir.

**Mitigation:**

- Veri modelinde API alanları 1:1 mapping ile tasarlanmıştır (bkz: Bölüm 04).
- API versiyon notları takip edilir (örn: GA4 API v2 release notes).
- Veri parser'ları soyutlama katmanında yazılır; API formatı değişirse parser tek noktadan güncellenir.

### 14.3.4 R-T04: Performans Hedeflerine Ulaşamamak

| Alan | Değer |
|---|---|
| **Risk ID** | R-T04 |
| **Kategori** | Performans |
| **Olasılık** | 3 (Orta) |
| **Etki** | 3 (Orta) |
| **Skor** | 9 (Orta) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Büyük veri setlerinde KPI sorgularının 500ms altında dönmemesi mümkündür.

**Mitigation:**

- Aggregation tabloları kullanılır (Bölüm 04.4).
- Redis cache uygulanır.
- Tarih bazlı partition kullanılır.
- Index stratejisi optimize edilmiştir.
- Sprint 11 sonunda load test yapılır (k6 ile, Bölüm 12.8).

**Contingency:** Performans hedefine ulaşılamazsa: query rewrite, materialized view eklemesi, daha agresif caching stratejisi uygulanır. Çok büyük veri setleri için pagination zorunlu kılınır.

### 14.3.5 R-T05: Veri İçe Aktarma (Import) Hataları

| Alan | Değer |
|---|---|
| **Risk ID** | R-T05 |
| **Kategori** | Fonksiyonel |
| **Olasılık** | 4 (Yüksek) |
| **Etki** | 3 (Orta) |
| **Skor** | 12 (Yüksek) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Kullanıcının yüklediği CSV/XLSX dosyaları farklı encoding (Türkçe karakterler), farklı delimiter, eksik kolon vb. sorunlar içerebilir.

**Mitigation:**

- Encoding otomatik tespit (`chardet` kütüphanesi).
- Delimiter otomatik tespit (`csv.Sniffer`).
- Kolon mapping wizard ile manuel düzeltme imkânı.
- 100 satır önizleme ile kullanıcı doğrulaması.
- Validation hataları satır bazında raporlanır.
- Hatalı satırlar atlanır veya tüm import iptal edilir (kullanıcı tercihi).

### 14.3.6 R-T06: Database Korupsiyon veya Veri Kaybı

| Alan | Değer |
|---|---|
| **Risk ID** | R-T06 |
| **Kategori** | Veri |
| **Olasılık** | 1 (Çok Düşük) |
| **Etki** | 5 (Çok Yüksek) |
| **Skor** | 5 (Orta) |
| **Sorumlu** | Adem Yavuz, Sporthink IT |

**Açıklama:** Donanım arızası, MySQL crash veya yanlış DELETE ile veri kaybı yaşanabilir.

**Mitigation:**

- Günlük otomatik MySQL dump (cron, Bölüm 11.10).
- 7 gün local retention.
- Restore prosedürü dokümante edilmiştir.
- Tüm yıkıcı operasyonlar (DELETE, TRUNCATE) audit log'a yazılır.
- Soft delete kullanılır (kullanıcı/rol/segment için).
- Production DB'de doğrudan SQL erişimi yasaklanır; sadece uygulama üzerinden değişiklik yapılır.

**Contingency:** Veri kaybı durumunda en son backup'tan restore. Maximum 24 saatlik veri kaybı (RPO = 24 saat).

### 14.3.7 R-T07: Güvenlik Açığı Tespit Edilmesi

| Alan | Değer |
|---|---|
| **Risk ID** | R-T07 |
| **Kategori** | Güvenlik |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 5 (Çok Yüksek) |
| **Skor** | 10 (Yüksek) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** SQL injection, XSS, CSRF gibi yaygın güvenlik açıklarının üretim sürecinde gözden kaçması.

**Mitigation:**

- ORM (SQLAlchemy) parametrik sorgular ile SQL injection engellenir.
- React varsayılan XSS koruması.
- CSRF için SameSite cookie.
- Bcrypt cost 12 ile şifre hash'leme.
- JWT secret 64+ karakter rastgele.
- Dependency taraması (`pip-audit`, `npm audit`) CI'da otomatik.
- Sprint 11'de manuel güvenlik testi yapılır (OWASP Top 10 checklist).

### 14.3.8 R-T08: Tarayıcı Uyumsuzluğu

| Alan | Değer |
|---|---|
| **Risk ID** | R-T08 |
| **Kategori** | Frontend |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 2 (Düşük) |
| **Skor** | 4 (Düşük) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Eski Safari veya Internet Explorer kullanıcılarının uygulamayı görüntüleyememesi.

**Mitigation:**

- Modern tarayıcılar hedef alınmıştır (Chrome, Firefox, Safari, Edge - son 2 sürüm).
- IE 11 ve altı desteklenmemektedir (Microsoft tarafından da desteği bitti).
- Vite hedef tarayıcılar `browserslist` ile tanımlanır.

## 14.4 Operasyonel Riskler

### 14.4.1 R-O01: Tek Geliştirici Bağımlılığı (Bus Factor = 1)

| Alan | Değer |
|---|---|
| **Risk ID** | R-O01 |
| **Kategori** | Operasyonel |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 5 (Çok Yüksek) |
| **Skor** | 10 (Yüksek) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Proje tek geliştirici tarafından yürütülür. Geliştiricinin hastalanması, şahsi acil durum yaşaması veya başka nedenlerle çalışamaz hale gelmesi tüm projeyi etkiler.

**Mitigation:**

- Dokümantasyon eksiksiz tutulur (bu doküman dahil).
- Tüm kod GitHub'da versiyonlanır; başka bir geliştirici devralabilir.
- Sprint sonu commit'leri sık ve atomic tutulur.
- Önemli kararlar danışman ile yazılı paylaşılır.
- Acil durumlarda Sporthink'e bilgi verilir, gerekirse süre uzatma talep edilir.

**Contingency:** Süre uzatma talebi Üniversite ve Sporthink ile koordine edilir.

### 14.4.2 R-O02: Kapsam Genişlemesi (Scope Creep)

| Alan | Değer |
|---|---|
| **Risk ID** | R-O02 |
| **Kategori** | Operasyonel |
| **Olasılık** | 4 (Yüksek) |
| **Etki** | 3 (Orta) |
| **Skor** | 12 (Yüksek) |
| **Sorumlu** | Adem Yavuz, Danışman |

**Açıklama:** Proje sürecinde Sporthink'ten yeni feature talepleri gelmesi (örn: "Bunu da ekleyebilir misin?"). Kabul edilirse zaman planı aşılır.

**Mitigation:**

- Kapsam Bölüm 01'de net olarak belgelenmiştir.
- Yeni talepler "Future Roadmap" (Bölüm 15) olarak kaydedilir.
- Sprint planlaması haftalık yapılır; mevcut sprint'e iş eklenmez.
- Danışman (Vahap Tecim) ile haftalık takip toplantıları yapılır.

**Contingency:** Eklenmesi şart görülen feature için, var olan başka bir feature'ın "v1.5" sürümüne ertelenmesi müzakere edilir.

### 14.4.3 R-O03: Sporthink Geri Bildirim Gecikmesi

| Alan | Değer |
|---|---|
| **Risk ID** | R-O03 |
| **Kategori** | İletişim |
| **Olasılık** | 3 (Orta) |
| **Etki** | 3 (Orta) |
| **Skor** | 9 (Orta) |
| **Sorumlu** | Sporthink, Adem Yavuz |

**Açıklama:** Sprint sonu demo'larında Sporthink ekibinden geri bildirim alınamaması, sonraki sprint planlamasını etkileyebilir.

**Mitigation:**

- Demo toplantıları en az 1 hafta önceden planlanır.
- Demo öncesi yazılı agenda paylaşılır.
- Geri bildirim için 48 saat süre tanınır; süre dolmadan onay alındığı varsayılır.
- WhatsApp ve email ile iletişim sürekli açık tutulur (Mert Gülseren, Emre Yavşan).

### 14.4.4 R-O04: Üniversite Akademik Takvim Çakışması

| Alan | Değer |
|---|---|
| **Risk ID** | R-O04 |
| **Kategori** | Süreçsel |
| **Olasılık** | 3 (Orta) |
| **Etki** | 3 (Orta) |
| **Skor** | 9 (Orta) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Final sınavları, vize haftaları, diğer derslerin proje ödevleri proje süresi içinde geliştirme zamanını kısıtlayabilir.

**Mitigation:**

- 11 haftalık plan akademik takvimle senkronize edilmiştir.
- Vize haftası için Sprint 5 hafifletilmiştir.
- Final öncesi 1 hafta buffer bırakılmıştır.
- Yoğun günlerde ana fonksiyonlar bitirilmiştir, son hafta sadece dokümantasyon ve sunum hazırlığıdır.

## 14.5 Süreçsel Riskler

### 14.5.1 R-S01: Tahmini Sürenin Aşılması

| Alan | Değer |
|---|---|
| **Risk ID** | R-S01 |
| **Kategori** | Planlama |
| **Olasılık** | 4 (Yüksek) |
| **Etki** | 3 (Orta) |
| **Skor** | 12 (Yüksek) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Sprint hedeflerinin planlandığından uzun sürmesi.

**Mitigation:**

- Her sprint'te %20 buffer time bırakılır.
- Sprint sonunda retrospektif yapılır; sonraki sprint daha realistik planlanır.
- Kritik path görevler önce yapılır (auth, RBAC, KPI hesaplama).
- Cosmetic detaylar sona bırakılır.

**Contingency:** Çok ciddi sapmalarda "Future Roadmap"a aktarma kararı.

### 14.5.2 R-S02: Test Coverage Hedeflerinin Tutmaması

| Alan | Değer |
|---|---|
| **Risk ID** | R-S02 |
| **Kategori** | Kalite |
| **Olasılık** | 3 (Orta) |
| **Etki** | 2 (Düşük) |
| **Skor** | 6 (Orta) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Coverage hedefi (%75) tutturulamayabilir, kritik bug'lar tespit edilemeyebilir.

**Mitigation:**

- TDD/parallel test yazımı (kod ile birlikte).
- CI'da coverage threshold zorlanır; threshold altında PR merge edilmez.
- Sprint sonu code review.

### 14.5.3 R-S03: Dokümantasyon Yetersizliği

| Alan | Değer |
|---|---|
| **Risk ID** | R-S03 |
| **Kategori** | Süreçsel |
| **Olasılık** | 2 (Düşük) |
| **Etki** | 3 (Orta) |
| **Skor** | 6 (Orta) |
| **Sorumlu** | Adem Yavuz |

**Açıklama:** Bitirme projesi savunması için yetersiz dokümantasyon.

**Mitigation:**

- Bu doküman (15 bölüm) kapsamlı şekilde hazırlanmıştır.
- README, CONTRIBUTING.md, API Swagger docs ek olarak hazırlanır.
- Demo videoları çekilir.
- Sprint sonlarında dokümantasyon güncellenir.

## 14.6 Risk Özet Matrisi

Tüm risklerin tek bakışta görünür özeti:

| ID | Risk | Olasılık | Etki | Skor | Öncelik |
|---|---|---|---|---|---|
| R-T01 | VDS sunucu geç tahsis | 4 | 4 | 16 | KRİTİK |
| R-T05 | Import hataları | 4 | 3 | 12 | YÜKSEK |
| R-O02 | Scope creep | 4 | 3 | 12 | YÜKSEK |
| R-S01 | Süre aşımı | 4 | 3 | 12 | YÜKSEK |
| R-T07 | Güvenlik açığı | 2 | 5 | 10 | YÜKSEK |
| R-O01 | Bus factor = 1 | 2 | 5 | 10 | YÜKSEK |
| R-T04 | Performans yetersiz | 3 | 3 | 9 | ORTA |
| R-O03 | Sporthink geri bildirim | 3 | 3 | 9 | ORTA |
| R-O04 | Akademik takvim | 3 | 3 | 9 | ORTA |
| R-T03 | API değişikliği | 2 | 3 | 6 | ORTA |
| R-S02 | Test coverage | 3 | 2 | 6 | ORTA |
| R-S03 | Dokümantasyon | 2 | 3 | 6 | ORTA |
| R-T06 | DB korupsiyon | 1 | 5 | 5 | ORTA |
| R-T02 | DNS gecikmesi | 2 | 2 | 4 | DÜŞÜK |
| R-T08 | Tarayıcı uyumsuzluğu | 2 | 2 | 4 | DÜŞÜK |

## 14.7 Risk Dağılımı (Heat Map)

```
                    ETKİ
              1     2     3     4     5
        ┌─────┬─────┬─────┬─────┬─────┐
      5 │     │     │     │     │     │
        ├─────┼─────┼─────┼─────┼─────┤
      4 │     │     │ R-T05│ R-T01│     │
        │     │     │ R-O02│      │     │
        │     │     │ R-S01│      │     │
        ├─────┼─────┼─────┼─────┼─────┤
O     3 │     │ R-S02│ R-T04│     │     │
L       │     │     │ R-O03│     │     │
A       │     │     │ R-O04│     │     │
S       ├─────┼─────┼─────┼─────┼─────┤
I     2 │     │ R-T02│ R-T03│     │ R-T07│
L       │     │ R-T08│ R-S03│     │ R-O01│
I       ├─────┼─────┼─────┼─────┼─────┤
K     1 │     │     │     │     │ R-T06│
        └─────┴─────┴─────┴─────┴─────┘
```

## 14.8 Risk Takip Süreci

### 14.8.1 Haftalık Risk Review

Her sprint başlangıcında 15 dakikalık risk review yapılır:

1. Mevcut risklerin durumu güncellenir (skor değişti mi?).
2. Gerçekleşen riskler "Closed" olarak işaretlenir.
3. Yeni riskler eklenir.
4. Mitigation aksiyonları kontrol edilir.

### 14.8.2 Risk Sahipliği

Her risk için bir sorumlu kişi (Risk Owner) tanımlanmıştır. Risk Owner:

- Riskin durumunu izler
- Mitigation aksiyonlarını yürütür
- Risk gerçekleştiğinde contingency plan'ı tetikler
- Risk review toplantısında durum bildirir

### 14.8.3 Risk Eskalasyonu

Aşağıdaki durumlarda Vahap Hocam'a (danışman) bildirim yapılır:

- Yeni KRİTİK risk tespit edildiğinde
- Mevcut risk skoru artarak KRİTİK'e çıktığında
- Bir risk gerçekleştiğinde ve mitigation yetersiz kaldığında
- Süre uzatma veya kapsam değişikliği gerektiğinde

## 14.9 Sonraki Bölüm

Bu bölümde projenin riskleri ve yönetimi ele alındı. Sonraki bölümde, projenin v1 sonrası **gelecek roadmap'i** ve potansiyel iyileştirmeleri detaylandırılacaktır.

**Sonraki Bölüm:** [15 - Gelecek Roadmap](15-future-roadmap.md)

*Bölüm 14 sonu.*
