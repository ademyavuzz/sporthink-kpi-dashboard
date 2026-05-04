# Sporthink KPI Dashboard — Kullanıcı Kılavuzu

> Pazarlama ve e-ticaret ekipleri için iç kullanım rehberi.
> Erişim: https://dashboard.sporthink.com.tr

## 1. Giriş (Login)

1. Tarayıcınızda dashboard URL'ini açın
2. Sporthink IT'den size verilen e-posta + geçici şifrenizi girin
3. İlk girişte şifrenizi değiştirmeniz istenecek

**Şifremi Unuttum:** Login ekranındaki "Şifremi Unuttum" → kayıtlı e-posta'ya
sıfırlama bağlantısı (15 dakika geçerli).

## 2. Genel Görünüm

### Sol Sidebar
11 modül + admin sayfaları (yetkinize göre görünür):

- **Genel Özet** — Tüm KPI'ların hızlı özeti
- **Trafik (GA4)** — Web sitesi ziyaretçi analitiği
- **Meta Ads** — Facebook/Instagram reklam performansı
- **Google Ads** — Google reklam performansı
- **E-Ticaret** — Satış, sipariş, müşteri
- **Kampanya Analizi** — Cross-platform ROAS karşılaştırma
- **Funnel** — Dönüşüm hunisi (görüntüleme → sepet → ödeme → satın alma)
- **Cohort/Retention** — Müşteri sadakat heatmap
- **Ürün Performansı** — Top satışlar, kategori/marka
- **Veri Import** — CSV yükleme (yöneticiler için)
- **Segmentler & RFM** — Müşteri segmentasyonu
- **Kullanıcı/Roller** — Yönetim (Süper Admin için)
- **Denetim Kayıtları** — Audit log (yöneticiler için)
- **Kanal Eşleme** — Channel mapping yönetimi

### Üst Bar
- **Tarih seçici** (sağ üst): 12 hazır preset (Bugün, Son 7/30/90 gün, Bu Ay, Geçen Yıl, Özel)
- **Tema:** Light/Dark
- **Dil:** TR/EN
- **Profil:** Çıkış

## 3. Veri Import (CSV Yükleme)

> Yetki: `imports.create` — sadece Süper Admin ve yetkili Pazarlama Müdürü.

### 4 Adımlı Wizard

**Adım 1 — Dosya Seç:**
- Veri kaynağını seç (10 seçenek): products, customers, orders, order_items,
  campaigns, ga4_traffic, ga4_items, meta_ads, meta_breakdowns, google_ads
- CSV dosyasını drag-drop veya tıkla-seç (max 50 MB)

**Adım 2 — Önizle:**
- Sistem dosyanın ilk 100 satırını parse eder
- Eksik zorunlu kolon → KIRMIZI alarm (yükleme engellenir)
- Tanınmayan kolon → SARI uyarı (atlanır)
- İlk 10 satır tablo halinde gösterilir
- Sayım: kaç geçerli, kaç hatalı

**Adım 3 — İşle:**
- "İmport Et" butonu → backend tüm satırları işler
- Spinner gösterilir (50k satır ~1-3 saniye)
- Aynı `sku`/`order_id`/`customer_id` zaten varsa **atlanır** (üstüne yazmaz)

**Adım 4 — Sonuç:**
- 6 metrik: total / valid / invalid / skipped (atlandı) / inserted / süre
- Hatalı satırlar listelenir, **"Hataları İndir"** butonu ile CSV indirebilirsin
- "Yeni Import" → wizard sıfırlanır

### Yükleme Sırası (Önemli!)
FK ilişkileri için sırayla yükle:

1. **products** (master)
2. **customers** (master)
3. **campaigns** (master)
4. **orders** (FK → customers)
5. **order_items** (FK → orders + products)
6. **ga4_traffic**
7. **ga4_items** (FK → products)
8. **meta_ads** (FK → campaigns)
9. **meta_breakdowns** (FK → campaigns)
10. **google_ads** (FK → campaigns)

### Geçmiş İmport'lar
"Geçmiş" sekmesinden son 50 import'u görebilir, sil butonuyla **rollback**
yapabilirsin (cascade ile raw satırlar da silinir).

## 4. Dashboard Sayfaları

Her sayfada üstte:
- **Tarih aralığı seçici** (yeniler kalıcı kaydolur)
- **Karşılaştırma modu:** Sequential (önceki dönem) / YoY (geçen yılın aynı dönemi)

KPI kartları:
- Mavi sayı = mevcut değer
- **Yeşil ↑** = iyiye gidiyor
- **Kırmızı ↓** = kötüye gidiyor
- *bounce_rate, CPC, CPM gibi KPI'larda **aşağı = iyi***

### Genel Özet Sayfası
Tek bakışta sağlık:
- 9 ana KPI (revenue, AOV, sessions, conversion rate, ROAS, vb.)
- Ciro & Sipariş trendi
- Kanal bazlı ciro donut
- Funnel breakdown
- Yeni vs tekrarlayan müşteri
- Top 10 ürün

## 5. Segmentler & RFM

### Özel Segmentler
"Yeni Segment" → Visual rule builder:
- Alanlar: Toplam ciro, sipariş sayısı, şehir, cinsiyet, yaş grubu, ...
- Operatörler: =, ≠, >, <, ≥, ≤, İçinde, İçeriyor
- AND / OR mantık
- **Önizle** → kuralı uygulamadan kaç müşteri eşleşiyor görür
- Kaydet → tabloda görünür, dashboard sayfalarında filtre olarak kullanılabilir

### RFM Analizi
Otomatik hesaplanan müşteri sınıflandırması:
- **Champions** (R≥4, F≥4, M≥4): En iyi müşteriler
- **Loyal** (F≥4, M≥3): Sadık alıcılar
- **At Risk** (R≤2, F≥3, M≥3): Geçmişte değerliydi, kaybolma riski
- **Lost** (R=1, F≤2, M≤2): Kayıp müşteri
- **New** (F=1, R≥4): Yeni başlayan
- **Potential Loyalist** (R≥3, F≥2, M≥3): Geliştirilmeli

## 6. Kullanıcı Yönetimi (Süper Admin)

"Yeni Kullanıcı" → e-posta + ad/soyad + rol seç:
- Sistem geçici şifre üretir, ekranda gösterir
- Kullanıcıya iletilir, ilk girişte değiştirir

**Pasifleştirme:** Toggle ile (soft delete, geri alınabilir).
**Kalıcı silme:** Sil butonu (yine soft delete — audit log'a yazılır).

## 7. Denetim Kayıtları (Audit Log)

Sistemdeki tüm kritik işlemler:
- Login / logout / hesap kilitleme
- User CRUD
- Import başarı/başarısızlık
- Permission değişikliği
- Settings güncelleme

Filtre: action prefix ile (örn `user.`, `import.`).

## 8. Kanal Eşleme (Admin)

`(source, medium)` → `channel_group` eşlemeleri. Yeni traffic source eklendiğinde
yöneticisi buradan ekleme yapar (örn: `tiktok` / `cpc` → `Paid Social`).

## 9. Kısa Yol Tuşları

- `Cmd/Ctrl + K` — Hızlı arama (planlanan v2 özelliği)
- `D` — Karanlık tema toggle
- `Esc` — Modal kapat

## SSS

**S: KPI değerleri yenilenmiyor.**
C: 5 dk Redis cache var. Kritik bir refresh için "Aggregations Rebuild" admin
butonunu kullan (`SETTINGS_UPDATE` izni gerekli).

**S: CSV yüklerken "Tanınmayan kolon" uyarısı geldi.**
C: Bilgilendirici uyarıdır — bu kolonlar parser'da yok, atlanır. Eğer önemliyse
DB schema değişikliği için IT ile konuş.

**S: Aynı CSV'yi yeniden yüklersem ne olur?**
C: Mevcut `sku`/`order_id`/`customer_id` üzerinden dedup yapılır → eskiler atlanır,
sadece yeniler yazılır. Sonuç ekranında "Atlandı (mevcut)" sayısını görürsün.

**S: Tarih filtresi nereye kayboldu?**
C: Sağ üstte takvim ikonu. Default "Son 30 Gün" — istersen "Tüm Dönem" butonuyla
veriyi geniş bir aralıkta gör.

**S: Türkçe karakterler bozuk görünüyor.**
C: Sistem UTF-8. Eğer CSV bozuksa Excel'de "UTF-8 ile kaydet" seç. Browser
karakter sorunu yaşıyorsa cache temizle (Ctrl+Shift+R).

---

Sorun yaşarsan IT (Sporthink) ile iletişime geç. Sistem teknik destek:
admin@sporthink.com.tr.
