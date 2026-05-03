# 8. VERİ IMPORT SİSTEMİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, sistemin verisinin geldiği import modülünü tüm boyutlarıyla ele almaktadır. 4 adımlı wizard akışı, async (Celery) işleme, dosya boyut limitleri, kolon eşleme (otomatik fuzzy matching), validasyon, duplicate kontrolü, normalizasyon, rollback ve hata yönetimi detaylı olarak incelenmiştir.

## 8.1 Import Sistem Mimarisi

Veri import modülü, sistemin en kritik bileşenlerinden biridir. Sistemde tüm KPI hesaplamaları ve dashboard görselleştirmeleri import edilen veriler üzerine kuruludur. Bu nedenle import sürecinin güvenilir, hızlı ve hata toleransı yüksek olması gereklidir.

Import sistemi async (asenkron) olarak Celery + Redis altyapısı üzerinden çalışır. Kullanıcı dosyayı yükler, backend hemen bir job ID döner ve gerçek işleme background worker tarafından yapılır. Bu sayede:

50 MB'a kadar büyük dosyalar HTTP timeout'a takılmaz.

Kullanıcı browser sekmesini değiştirebilir, başka işlemler yapabilir.

İmport süresi tahmin edilebilir, ilerleme polling ile takip edilir.

Worker hata aldığında otomatik retry mekanizması devreye girer.

## 8.2 Import Wizard Akışı

Kullanıcı arayüzünde import işlemi 4 adımdan oluşan bir stepper olarak sunulur.

```
ADIM 1            ADIM 2           ADIM 3           ADIM 4
┌────────┐       ┌────────┐       ┌────────┐       ┌────────┐
│ Upload │──────▶│Mapping │──────▶│Validate│──────▶│  Done  │
│        │       │        │       │        │       │        │
│ Dosya  │       │ Kolon  │       │ Önizle │       │  Veri  │
│ yükle  │       │ eşle   │       │ ve     │       │  yaz,  │
│        │       │        │       │ doğrula│       │  bitir │
└────────┘       └────────┘       └────────┘       └────────┘
```

Kullanıcı her adımda "Geri" butonuyla önceki adıma dönebilir. Aktif adım primary renkle vurgulanır, tamamlanmış adımlar yeşil tik (✓) ile gösterilir.

## 8.3 Adım 1: Dosya Yükleme (Upload)

### 8.3.1 Yükleme Arayüzü

Kullanıcı yükleme arayüzünde aşağıdaki seçeneklere sahiptir:

**Drag-and-Drop Alanı:** Dosyayı sürükleyip bırakabileceği geniş bir alan. Drag durumunda border rengi primary'e döner, "Bırakın!" mesajı gösterilir.

**Dosya Seç Butonu:** Klasik dosya seçim dialogu açar.

**Veri Tipi Seçici:** Dropdown ile manuel veri tipi seçilir veya "Otomatik tespit" işaretlenir.

### 8.3.2 Desteklenen Formatlar

| Format | Uzantı | Parser |
|---|---|---|
| CSV (Comma-Separated Values) | .csv | pandas + csv module |
| TSV (Tab-Separated) | .tsv | pandas (sep='\t') |
| Excel | .xlsx, .xlsm | openpyxl |
| Excel (legacy) | .xls | xlrd |
| JSON | .json | Python json module |
| JSONL (JSON Lines) | .jsonl | satır bazlı işleme |

CSV/TSV dosyaları için encoding otomatik tespit edilir (UTF-8, UTF-8 BOM, ISO-8859-9 Türkçe).

### 8.3.3 Dosya Boyutu Limiti

Tek dosya boyutu **maksimum 50 MB** ile sınırlıdır. Bu limit:

Frontend tarafında dosya seçildiğinde anında kontrol edilir, büyük dosyalar yüklemeden reddedilir.

Nginx tarafında `client_max_body_size 50M` ile zorlanır, byte düzeyinde garanti.

Backend tarafında multipart parser üst limit ile yapılandırılır.

50 MB üstü dosyalar için kullanıcıya öneri gösterilir: "Lütfen dosyayı bölüp birden fazla import yapın".

### 8.3.4 Veri Tipi Otomatik Tespit

Kullanıcı manuel seçim yapmazsa, sistem dosyanın ilk birkaç satırını okuyarak veri tipini tahmin eder.

```python
def detect_data_type(headers: list[str]) -> str:
    """Dosya başlıklarından veri tipini tespit eder."""
    headers_lower = {h.lower() for h in headers}

    # GA4 Trafik
    if {'sessionsource', 'sessions', 'totalusers'}.issubset(headers_lower):
        return 'ga4_traffic'

    # GA4 Item Engagement
    if {'itemid', 'itemsviewed', 'itemspurchased'}.issubset(headers_lower):
        return 'ga4_items'

    # Meta Ads
    if {'campaign_id', 'ad_id', 'spend', 'impressions'}.issubset(headers_lower):
        if 'age' in headers_lower or 'gender' in headers_lower:
            return 'meta_breakdowns'
        return 'meta_ads'

    # Google Ads
    if 'cost_micros' in headers_lower or 'segments.date' in headers_lower:
        return 'google_ads'

    # Orders
    if {'order_id', 'order_date', 'customer_id'}.issubset(headers_lower):
        return 'orders'

    # Order Items
    if {'order_id', 'item_id', 'quantity'}.issubset(headers_lower):
        return 'order_items'

    # Customers
    if {'customer_id', 'first_order_date'}.issubset(headers_lower):
        return 'customers'

    # Products
    if {'sku', 'product_name'}.issubset(headers_lower):
        return 'products'

    # Campaigns
    if {'campaign_name', 'platform', 'start_date'}.issubset(headers_lower):
        return 'campaigns'

    return 'unknown'
```

Tespit edilen tip kullanıcıya gösterilir, kullanıcı onaylar veya değiştirir.

### 8.3.5 Yükleme Süreci

Kullanıcı dosyayı yükledikten sonra:

1. Backend dosyayı `/var/sporthink/uploads/{year}/{month}/{import_id}_{filename}` yoluna kaydeder.
2. `imports` tablosuna yeni kayıt INSERT edilir, status `pending`.
3. Backend hemen `import_id` döner ve frontend Adım 2'ye geçer.

## 8.4 Adım 2: Kolon Eşleme (Mapping)

### 8.4.1 Mapping Arayüzü

Kullanıcı sol tarafta dosyadaki kolon isimlerini, sağ tarafta hedef veritabanı kolonlarını görür. Aralarındaki ilişkiyi dropdown veya drag-drop ile kurar.

```
┌──────────────────────┐  ──→  ┌──────────────────────┐
│ Dosyadaki Kolon      │       │ Hedef DB Kolonu      │
├──────────────────────┤       ├──────────────────────┤
│ date                 │  ──→  │ date              ▼  │
│ sessionSource        │  ──→  │ session_source    ▼  │
│ sessionMedium        │  ──→  │ session_medium    ▼  │
│ totalUsers           │  ──→  │ total_users       ▼  │
│ ...                  │       │ ...                  │
└──────────────────────┘       └──────────────────────┘
```

### 8.4.2 Otomatik Eşleme (Fuzzy Matching)

Sistem ilk açılışta otomatik öneri sunar. Python'un `difflib.SequenceMatcher` veya `rapidfuzz` kütüphanesi kullanılarak benzerlik skoru hesaplanır. %80 üzeri benzerlik bulunan eşleştirmeler otomatik atanır.

```python
from difflib import SequenceMatcher

def auto_map_columns(source_columns: list[str], target_columns: list[str]) -> dict:
    """Kaynak kolonları hedef kolonlarla otomatik eşleştirir."""
    mapping = {}

    for source in source_columns:
        # Tam eşleşme öncelikli
        if source in target_columns:
            mapping[source] = source
            continue

        # Snake_case ↔ camelCase normalize
        source_norm = normalize_column_name(source)

        best_match = None
        best_score = 0.0

        for target in target_columns:
            target_norm = normalize_column_name(target)
            score = SequenceMatcher(None, source_norm, target_norm).ratio()

            if score > best_score and score >= 0.8:
                best_score = score
                best_match = target

        if best_match:
            mapping[source] = best_match

    return mapping

def normalize_column_name(name: str) -> str:
    """sessionSource → session_source"""
    import re
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
```

### 8.4.3 Kullanıcı Düzeltmesi

Kullanıcı otomatik eşlemeyi onaylayabilir veya manuel olarak değiştirebilir. Kolon eşleştirmeleri yeşil çizgilerle gösterilir, eşleşmemiş kolonlar gri kalır.

Zorunlu alanlar (örneğin `ga4_traffic` için `date`, `session_source`, `sessions`) eşleştirilmediği sürece "İleri" butonu pasif kalır.

### 8.4.4 Mapping Validasyonu

İleri tıklandığında backend mapping'i validate eder:

Tüm zorunlu alanlar eşleştirilmiş mi?

Bir hedef kolona iki kaynak kolon eşleştirilmemiş mi (1:N olmamalı)?

Veri tipi uyumluluğu kontrol edilir (örn: `date` kolonuna metin alan atanmamalı).

## 8.5 Adım 3: Validasyon (Validate)

### 8.5.1 Doğrulama Türleri

Backend, tüm dosyayı okuyarak satır satır doğrulama yapar.

**Veri Tipi Doğrulaması:**
- `date`: ISO 8601 (YYYY-MM-DD) veya GA4 (YYYYMMDD) formatına uygun mu?
- `int`, `float`: Sayısal değer mi?
- `email`: Geçerli email formatı mı?
- `enum`: Tanımlı değerler arasında mı (örn: device: mobile/desktop/tablet)?

**Zorunlu Alan Kontrolü:** Boş veya null gelmemesi gereken kolonlar var mı?

**Format Kontrolü:** Tarih, telefon, IBAN gibi yapılı alanlar regex ile kontrol edilir.

**Duplicate Kontrolü:** Mevcut kayıtlarla çakışan duplicate'ler tespit edilir.

**Range Kontrolü:** `bounce_rate` 0-1 arası mı? `quantity` pozitif mi?

### 8.5.2 Hata Raporu

Doğrulama sonunda kullanıcıya özet gösterilir.

```
┌─────────────────────────────────────────┐
│  Doğrulama Tamamlandı                    │
├─────────────────────────────────────────┤
│                                           │
│   Toplam Satır:        8.420              │
│   Geçerli Satır:       8.411              │
│   Hatalı Satır:        9                  │
│   Duplicate Satır:     245                │
│                                           │
│   Hata Detayları:                         │
│   ▪ Geçersiz tarih formatı:    5 satır   │
│   ▪ Eksik zorunlu alan:        3 satır   │
│   ▪ Negatif değer (sessions):  1 satır   │
│                                           │
│   [Hata Raporunu CSV İndir]               │
└─────────────────────────────────────────┘
```

### 8.5.3 Hata Stratejisi Seçimi

Hatalı satırlar varsa kullanıcıya 3 seçenek sunulur:

**1. Hataları Atla (Skip Errors):** Sadece geçerli satırlar veritabanına yazılır. Hatalı satırlar `import_errors` tablosunda saklanır, audit için.

**2. Tüm Import'u İptal Et (Abort):** İşlem durur, hiçbir satır yazılmaz.

**3. Hata Raporunu İndir:** Hatalı satırlar orijinal verilerleriyle birlikte CSV olarak indirilir, kullanıcı düzeltip yeniden yükleyebilir.

### 8.5.4 Duplicate Stratejisi Seçimi

Duplicate kayıtlar tespit edildiğinde 3 seçenek sunulur:

**1. Üzerine Yaz (UPSERT):** Mevcut kayıtlar silinir, yenileri yazılır. SQL'de `INSERT ... ON DUPLICATE KEY UPDATE` veya `REPLACE INTO` kullanılır.

**2. Atla (Skip):** Mevcut kayıtlar korunur, sadece yeni tarihlerin verisi eklenir.

**3. İptal:** Tüm import iptal edilir.

### 8.5.5 Duplicate Tespit Anahtarları

Her veri tipi için duplicate sayılan kombinasyonlar:

| Tablo | Duplicate Anahtarı |
|---|---|
| `ga4_traffic` | (date, session_source, session_medium, device_category, city) |
| `ga4_item_engagement` | (date, item_id) |
| `meta_ads` | (date_start, ad_id) |
| `meta_ads_breakdowns` | (date_start, ad_id, age, gender, publisher_platform) |
| `google_ads` | (date, ad_group_id, device, ad_network_type) |
| `orders` | (order_id) |
| `order_items` | (order_id, line_id) |
| `products` | (sku) |
| `customers` | (customer_id) |
| `campaigns` | (campaign_name, platform) |

## 8.6 Adım 4: Veri Yazma (Commit)

### 8.6.1 Async İşleme

Kullanıcı "Veriyi Yaz" butonuna bastığında backend Celery'e job atar:

```python
@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(SQLAlchemyError,),
)
def commit_import(self, import_id: int, duplicate_strategy: str, error_strategy: str):
    try:
        process_import(import_id, duplicate_strategy, error_strategy)
    except Exception as e:
        logger.exception(f"Import {import_id} failed")
        raise
```

Frontend hemen yanıt alır ve polling moduna geçer.

### 8.6.2 İşlem Adımları

Worker tarafında yapılan işlem akışı:

```
1. Import durumu: parsing
   - Dosya tekrar parse edilir
   - Mapping uygulanır

2. Import durumu: validating
   - Veri tipi doğrulamaları yapılır
   - Hatalı satırlar import_errors tablosuna yazılır

3. Import durumu: normalizing
   - Tarih formatları standardize edilir
   - Channel mapping uygulanır
   - Para birimleri normalize edilir
   - Şehir isimleri düzeltilir

4. Import durumu: committing
   - Transaction başlatılır
   - Toplu INSERT yapılır (batch size 1000)
   - Customer total_orders, total_revenue güncellenir
   - import_id ile takip kaydı yapılır

5. Import durumu: aggregating
   - kpi_daily_aggregates yeniden hesaplanır
   - kpi_monthly_aggregates yeniden hesaplanır
   - kpi_campaign_aggregates yeniden hesaplanır

6. Import durumu: completed
   - imports tablosunda completed işaretlenir
   - duration_seconds hesaplanır
   - Audit log kaydı oluşturulur
   - Frontend'e sonuç bildirimi
```

### 8.6.3 İlerleme Takibi (Progress)

Frontend her 2 saniyede bir `GET /imports/{id}/status` endpoint'ini çağırır. Worker her batch sonrası `imports.progress_percentage` ve `current_step` alanlarını günceller.

```python
# Worker içinde
async def process_batch(batch_num: int, total_batches: int, import_id: int):
    progress = int((batch_num / total_batches) * 100)
    await db.execute(
        update(Import).where(Import.id == import_id).values(
            progress_percentage=progress,
            current_step=f"Yazılıyor: batch {batch_num}/{total_batches}"
        )
    )
    await db.commit()
```

Frontend'de gösterim:

```
┌──────────────────────────────────────────────┐
│ ga4_april_2026.csv                            │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 65%                       │
│ Yazılıyor: batch 33/52                        │
│ 5,460 / 8,420 satır işlendi                  │
│ Tahmini süre: 12 saniye                       │
│ [İptal]                                        │
└──────────────────────────────────────────────┘
```

### 8.6.4 İptal Etme (Cancel)

Kullanıcı "İptal" butonuna bastığında:

```python
@router.post("/imports/{import_id}/cancel")
async def cancel_import(import_id: int):
    import_record = await get_import(import_id)

    # Celery task'i revoke et
    celery_app.control.revoke(
        task_id=import_record.celery_task_id,
        terminate=True,
        signal='SIGTERM'
    )

    # Transaction rollback (Celery worker tarafında handle edilir)
    # Status update
    await db.execute(
        update(Import).where(Import.id == import_id).values(
            status='cancelled',
            error_message='Kullanıcı tarafından iptal edildi'
        )
    )

    return {"success": True}
```

Worker SIGTERM aldığında transaction'ı rollback eder, kısmen yazılmış veri otomatik silinir.

## 8.7 Veri Normalizasyonu

Import sırasında veriler standart bir formata dönüştürülür. Bu sayede sorgulama anında runtime hesaplama gerekmez, performans korunur.

### 8.7.1 Tarih Normalizasyonu

GA4 API'si tarihleri `YYYYMMDD` formatında döner (örn: `20260415`). Meta Ads `YYYY-MM-DD` formatında döner. Hepsi MySQL `DATE` formatına çevrilir:

```python
def normalize_date(value: str) -> date:
    """Çeşitli formatlardaki tarihleri MySQL DATE'e çevirir."""
    if isinstance(value, date):
        return value

    formats = [
        '%Y-%m-%d',      # ISO 8601
        '%Y%m%d',        # GA4 YYYYMMDD
        '%d/%m/%Y',      # Türk formatı
        '%d-%m-%Y',
        '%Y-%m-%dT%H:%M:%S',  # ISO datetime
    ]

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue

    raise InvalidDateFormatError(value)
```

### 8.7.2 Saat Dilimi Normalizasyonu

Tüm datetime alanları UTC'ye çevrilir.

```python
def normalize_datetime_to_utc(value: str, source_tz: str = 'Europe/Istanbul') -> datetime:
    naive_dt = parse_datetime(value)
    aware_dt = pytz.timezone(source_tz).localize(naive_dt)
    return aware_dt.astimezone(pytz.UTC).replace(tzinfo=None)
```

### 8.7.3 Kanal Normalizasyonu

GA4'ten gelen `session_source` ve `session_medium`, `channel_mapping` tablosu üzerinden `channel_group`'a çevrilir.

```python
def normalize_channel(source: str, medium: str, db: Session) -> str:
    """source + medium → channel_group"""
    mapping = db.execute(
        select(ChannelMapping)
        .where(ChannelMapping.source == source.lower())
        .where(ChannelMapping.medium == medium.lower())
    ).scalar_one_or_none()

    if mapping:
        return mapping.channel_group

    # Otomatik "Other" olarak ekle, admin sonra düzeltir
    new_mapping = ChannelMapping(
        source=source.lower(),
        medium=medium.lower(),
        channel_group='Other',
        is_auto_assigned=True,
    )
    db.add(new_mapping)
    return 'Other'
```

`derived_channel` kolonuna bu değer yazılır. Sorgularda `channel_mapping` join etmeden direkt bu kolon kullanılır.

### 8.7.4 Para Birimi Normalizasyonu

Google Ads `cost_micros` formatını TL'ye çevirir:

```python
def normalize_google_ads_cost(cost_micros: int) -> Decimal:
    """1 TL = 1,000,000 micro"""
    return Decimal(cost_micros) / Decimal(1_000_000)
```

Meta Ads STRING formatındaki sayıları parse eder:

```python
def parse_meta_value(value: str) -> Decimal:
    """Meta API tüm metrikleri string döner"""
    if value is None or value == '':
        return Decimal(0)
    return Decimal(str(value))
```

### 8.7.5 Şehir Adı Normalizasyonu (Opsiyonel)

GA4 İngilizce şehir adları döner (`Istanbul`, `Izmir`). Türkçe karakterli versiyonlar opsiyonel olarak normalize edilebilir:

```python
CITY_TR_MAP = {
    'Istanbul': 'İstanbul',
    'Izmir': 'İzmir',
    'Sanliurfa': 'Şanlıurfa',
    # ...
}

def normalize_city(city: str) -> str:
    return CITY_TR_MAP.get(city, city)
```

Bu normalizasyon opsiyoneldir; veritabanında ASCII formatında saklamak da uluslararası uyumluluk açısından tercih edilebilir.

### 8.7.6 String Trim ve Lowercase

Tüm string alanlar trim edilir. Kanal, source, medium gibi join key'i olan alanlar lowercase'e çevrilir.

## 8.8 Aggregation Yenileme

Veri yazıldıktan sonra aggregation tabloları yeniden hesaplanır. Bu işlem için iki strateji kullanılır.

### 8.8.1 Incremental Update (Tercih edilen)

Sadece etkilenen tarih aralığı yeniden hesaplanır. Hızlıdır.

```python
def rebuild_aggregations_for_date_range(
    date_from: date,
    date_to: date,
    db: Session
):
    # Etkilenen tarih aralığını sil
    db.execute(
        delete(KpiDailyAggregate).where(
            and_(
                KpiDailyAggregate.date >= date_from,
                KpiDailyAggregate.date <= date_to,
            )
        )
    )

    # Yeniden hesapla (SQL aggregation)
    db.execute(text("""
        INSERT INTO kpi_daily_aggregates (date, channel, sessions, users, ...)
        SELECT
            date,
            session_default_channel_group AS channel,
            SUM(sessions) AS sessions,
            SUM(total_users) AS users,
            ...
        FROM ga4_traffic
        WHERE date >= :date_from AND date <= :date_to
        GROUP BY date, session_default_channel_group
    """), {"date_from": date_from, "date_to": date_to})

    db.commit()
```

### 8.8.2 Full Rebuild (Sadece manuel tetiklemede)

Tüm aggregation'ları sıfırdan hesaplar. Normalde otomatik tetiklenmez, sadece Süper Admin "KPI'ları yeniden hesapla" butonuna bastığında çalışır.

## 8.9 Import Rollback (Geri Alma)

Bir import işlemi tamamlandıktan sonra geri alınabilir.

### 8.9.1 Rollback Akışı

```python
@router.delete("/imports/{import_id}")
async def rollback_import(import_id: int, current_user: User):
    import_record = await get_import(import_id)

    if import_record.status not in ['completed', 'cancelled']:
        raise BadRequestError("Sadece tamamlanmış importlar geri alınabilir")

    async with db.begin():
        # 1. Bu import_id'ye bağlı tüm satırları sil
        target_table = get_table_for_data_type(import_record.data_type)
        await db.execute(
            delete(target_table).where(target_table.import_id == import_id)
        )

        # 2. Aggregation'ları yeniden hesapla
        affected_dates = await get_affected_dates(import_id)
        await rebuild_aggregations_for_dates(affected_dates)

        # 3. Customer total_orders, total_revenue güncelle (eğer orders rollback edildiyse)
        if import_record.data_type == 'orders':
            await rebuild_customer_aggregates(import_id)

        # 4. Import durumunu güncelle
        await db.execute(
            update(Import).where(Import.id == import_id).values(
                status='rolled_back',
                rolled_back_at=datetime.utcnow(),
                rolled_back_by=current_user.id,
            )
        )

        # 5. Audit log
        await create_audit_log(
            user_id=current_user.id,
            action='import.rollback',
            resource_type='import',
            resource_id=import_id,
        )

    # 6. Orijinal dosya korunur (90 gün)
```

### 8.9.2 Rollback Süresi

Rollback işlemi süre sınırı olmadan yapılabilir. Yıl önceki bir import'u bile geri almak mümkündür. Ancak orijinal dosya 90 günden eskiyse silinmiş olabilir; bu durumda da rollback yapılır, sadece "yeniden import" için orijinal dosyaya erişilemez.

### 8.9.3 Cascade Rollback

Bir orders import'u rollback edildiğinde, bu siparişlerle ilişkili `order_items` da otomatik silinir (foreign key CASCADE).

`customers` tablosundaki `total_orders` ve `total_revenue` alanları yeniden hesaplanır.

## 8.10 Dosya Saklama ve Temizlik

### 8.10.1 Dosya Saklama Yapısı

Yüklenen dosyalar kalıcı olarak saklanır.

```
/var/sporthink/uploads/
├── 2026/
│   ├── 03/
│   │   ├── 1_ga4_march.csv
│   │   ├── 2_meta_march.xlsx
│   │   └── ...
│   ├── 04/
│   │   └── ...
│   └── 05/
└── 2027/
```

Dosya adı: `{import_id}_{original_filename}`. Bu sayede aynı isimde dosyalar çakışmaz.

### 8.10.2 Otomatik Temizlik

90 günden eski dosyalar her gün gece yarısı çalışan cron job ile silinir. DB'deki `imports` kayıtları korunur, sadece fiziksel dosya silinir.

```python
@celery_app.task
def cleanup_old_uploads():
    """Her gece 02:00'da çalışır."""
    cutoff_date = datetime.utcnow() - timedelta(days=90)
    base_path = Path('/var/sporthink/uploads')

    deleted_count = 0
    for import_record in db.query(Import).filter(Import.created_at < cutoff_date).all():
        if import_record.file_path:
            file_path = Path(import_record.file_path)
            if file_path.exists():
                file_path.unlink()
                deleted_count += 1
                # imports.file_path = NULL (dosya yok artık)
                import_record.file_path = None

    db.commit()
    logger.info(f"Cleanup: {deleted_count} old upload files deleted")
```

## 8.11 Eşzamanlı Import Yönetimi

Aynı kullanıcının aynı anda **yalnızca 1 import** işlemi olabilir. Bir import çalışırken yeni başlatılmaya çalışıldığında:

```python
@router.post("/imports")
async def create_import(file: UploadFile, current_user: User):
    # Aktif import var mı?
    active_count = await db.scalar(
        select(func.count(Import.id)).where(
            and_(
                Import.user_id == current_user.id,
                Import.status.in_(['pending', 'parsing', 'validating', 'committing']),
            )
        )
    )

    if active_count > 0:
        raise ConflictError(
            code='IMPORT_IN_PROGRESS',
            message='Aktif bir import var. Önce onun tamamlanmasını bekleyin veya iptal edin.'
        )

    # Yeni import başlat
    ...
```

Bu kısıtlama Süper Admin için de geçerlidir; tek seferde tek dosya import edilir, sırasıyla işlem yapılır.

## 8.12 Hata Senaryoları ve Çözümleri

### 8.12.1 Sık Karşılaşılan Hatalar

| Hata Kodu | Sebep | Çözüm |
|---|---|---|
| `INVALID_FILE_FORMAT` | Desteklenmeyen format (örn: PDF) | CSV/XLSX/JSON kullan |
| `FILE_TOO_LARGE` | 50 MB üzeri | Dosyayı böl |
| `INVALID_DATE_FORMAT` | Tanımsız tarih formatı | Tarihleri düzelt |
| `MISSING_REQUIRED_FIELD` | Zorunlu alan boş | Eksik alanları doldur |
| `INVALID_ENUM_VALUE` | Geçersiz enum değeri | Tanımlı değer kullan |
| `DUPLICATE_RECORD` | Mevcut kayıtla çakışma | Strateji seç |
| `ENCODING_ERROR` | UTF-8 değil | UTF-8 kaydet |
| `MEMORY_ERROR` | Çok büyük dosya | Dosyayı böl |

### 8.12.2 Worker Çökmesi

Celery worker bir görev çalışırken çökerse, görev otomatik olarak başka worker tarafından alınır (visibility timeout sonrası). 3 deneme sonrası başarısız olursa job `failed` durumuna geçer ve kullanıcıya bildirim gösterilir.

### 8.12.3 DB Bağlantı Kopması

Geçici DB bağlantı sorunlarında SQLAlchemy connection pool retry mekanizması devreye girer. Worker görev seviyesinde de retry yapar.

### 8.12.4 Dosya Bozulması

Yüklenen dosya bozuksa parser hata fırlatır. `imports.error_message` alanına detaylı hata mesajı yazılır, kullanıcıya gösterilir.

## 8.13 Performans İyileştirmeleri

### 8.13.1 Batch Insert

Büyük dosyalar için satır satır INSERT yapmak yavaştır. Toplu INSERT (batch) kullanılır.

```python
BATCH_SIZE = 1000

async def insert_in_batches(rows: list[dict], table):
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        await db.execute(insert(table), batch)
        await db.commit()

        # Progress update
        progress = int((i + len(batch)) / len(rows) * 100)
        await update_import_progress(import_id, progress)
```

### 8.13.2 Pandas ile Parse Hızı

CSV/XLSX parse işlemi pandas ile yapılır. C-tabanlı olduğundan saf Python'dan 10x hızlıdır.

```python
import pandas as pd

df = pd.read_csv(
    file_path,
    encoding='utf-8',
    chunksize=10000,  # 10K satırlık chunk'lar halinde
    on_bad_lines='warn',
)

for chunk in df:
    process_chunk(chunk)
```

### 8.13.3 Index Disable Trick

Çok büyük import'larda (1M+ satır) MySQL index'leri geçici olarak disable edip, INSERT sonrası rebuild etmek hızı artırır:

```sql
ALTER TABLE ga4_traffic DISABLE KEYS;
-- Bulk INSERT
ALTER TABLE ga4_traffic ENABLE KEYS;
```

Bu özellik MVP'de kullanılmaz, future optimization olarak değerlendirilir.

## 8.14 Sonraki Bölüm

Bu bölümde veri import sisteminin tüm boyutları detaylı olarak ele alındı. Sonraki bölümde, import edilen veriler üzerinden hesaplanan KPI formülleri detaylandırılacaktır.

**Sonraki Bölüm:** [09 - KPI Hesaplama Modeli](09-kpi-formulas.md)

*Bölüm 08 sonu.*
