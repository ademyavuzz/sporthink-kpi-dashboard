# 10. FİLTRELEME VE SEGMENTASYON

> **Bu Bölümde Neler Var?**
> Bu bölüm, kullanıcıların KPI verilerini farklı boyutlarda analiz etmelerini sağlayan filtreleme ve segmentasyon sistemini detaylı olarak ele almaktadır. Global filtreler, sayfa içi filtreler, cross-filter etkileşimi, kayıtlı görünümler, görsel segment kural builder ve RFM tabanlı segmentasyon belgelenmiştir.

## 10.1 Filtreleme Sistemi Genel Bakış

Filtreleme, dashboard'un en önemli etkileşim mekanizmalarından biridir. Kullanıcı, geniş veri setini kendi ilgilendiği boyutlara göre daraltabilir. Sporthink KPI Dashboard'da filtreleme üç katmanda çalışır:

**Global Filtreler:** TopBar'da yer alır, tüm sayfaları aynı anda etkiler. Tarih aralığı, kanal, cihaz, şehir gibi her sayfa için anlamlı filtreler.

**Sayfa İçi Filtreler:** Sadece aktif sayfayı etkiler. Örneğin Meta Ads sayfasında "kampanya nesnesi" filtresi sadece o sayfada anlamlıdır.

**Cross-Filter (Etkileşimli Filtre):** Kullanıcı bir grafik üzerinde tıklayınca o seçim sayfa genelinde filtre olur. Örneğin pie chart'ta "Mobile" dilimine tıklayınca tüm sayfa "Mobile" filtresine girer.

Her üç katman da Zustand store üzerinden yönetilir, TanStack Query otomatik olarak ilgili verileri yeniden çeker.

## 10.2 Global Filtreler

### 10.2.1 Tarih Aralığı Filtresi

Tarih aralığı tüm sayfalarda en kritik filtredir. Kullanıcıya 12 hazır preset sunulur:

| Preset | Açıklama |
|---|---|
| Bugün | Yalnızca bugünkü veriler |
| Dün | Sadece dünkü veriler |
| Son 7 gün | Bugün dahil son 7 gün |
| Son 14 gün | Bugün dahil son 14 gün |
| Son 28 gün | Bugün dahil son 28 gün |
| Son 30 gün | Bugün dahil son 30 gün (default) |
| Son 90 gün | Bugün dahil son 90 gün |
| Bu hafta | Pazartesi'den bugüne |
| Geçen hafta | Önceki Pazartesi-Pazar |
| Bu ay | Ayın 1'inden bugüne |
| Geçen ay | Önceki ayın tamamı |
| Bu yıl (YTD) | 1 Ocak'tan bugüne |
| Özel aralık | Manuel başlangıç ve bitiş seçimi |

Aktif tarih aralığı TopBar'da gösterilir: "Son 30 gün (1 Nis - 30 Nis 2026)".

### 10.2.2 Karşılaştırma (Compare) Toggle

Tarih aralığı seçicisinin yanında bir "Karşılaştır" toggle'ı bulunur. Aktifleştirildiğinde KPI delta gösterimi devreye girer.

Karşılaştırma seçenekleri:

**Önceki Dönem (Default):** Aynı uzunlukta önceki dönem. Örnek: 1-30 Nisan ↔ 2-31 Mart.

**Geçen Yıl Aynı Dönem (YoY):** Yıllık karşılaştırma. Örnek: 1-30 Nisan 2026 ↔ 1-30 Nisan 2025.

KPI kartlarında karşılaştırma sonucu yüzde delta olarak gösterilir.

### 10.2.3 Diğer Global Filtreler

| Filtre | Tipi | Sayfalar |
|---|---|---|
| Kanal (Channel) | Multi-select dropdown | Tümü |
| Cihaz (Device) | Multi-select | Tümü |
| Şehir (City) | Multi-select aranabilir | Tümü |
| Müşteri Segmenti | Single-select | E-Ticaret, Cohort, Ürün |

Multi-select filtrelerinde seçimler **OR** (VEYA) mantığı ile çalışır. Örneğin "Mobile" + "Tablet" seçilirse, mobile veya tablet kullanıcılar gösterilir.

### 10.2.4 Aktif Filtre Chip'leri

Uygulanan tüm filtreler TopBar'da chip olarak gösterilir.

```
[Son 30 gün ×] [Kanal: Paid Search, Paid Social ×] [Cihaz: Mobile ×] [+ Filtre]
```

Her chip'te:
- Filtre adı ve değeri
- [×] butonu (filtreyi kaldırır)

"+ Filtre" butonuna tıklanınca tüm mevcut filtre seçeneklerinin listesi modal'da açılır.

### 10.2.5 Tüm Filtreleri Temizle

TopBar'da "Filtreleri Temizle" butonu bulunur. Tarih hariç tüm filtreler sıfırlanır (tarih default Son 30 güne döner).

## 10.3 Sayfa İçi Filtreler

Bazı filtreler yalnızca belirli sayfalarda anlamlıdır ve sayfa kontent alanının üst kısmında gösterilir.

| Filtre | Sayfa | Tipi |
|---|---|---|
| Kampanya Adı | Meta Ads, Google Ads, Kampanya | Multi-select aranabilir |
| Kampanya Nesnesi (Objective) | Meta Ads | Multi-select |
| Kanal Tipi (Search/Shopping/PMax) | Google Ads | Multi-select |
| Yaş Grubu | Meta Ads, Cohort, Ürün | Multi-select |
| Cinsiyet | Meta Ads, Cohort, Ürün | Multi-select |
| Marka | Ürün, E-Ticaret | Multi-select aranabilir |
| Kategori | Ürün, E-Ticaret | Multi-select |
| Sipariş Durumu | E-Ticaret | Multi-select |
| Ödeme Yöntemi | E-Ticaret | Multi-select |

## 10.4 Cross-Filter (Etkileşimli Filtre)

Cross-filter, modern BI tool'ların (Tableau, Looker, Mixpanel) standart özelliğidir. Kullanıcı bir grafik üzerinde bir öğeye tıklayınca o seçim aktif sayfanın diğer tüm grafiklerinde filtre olarak uygulanır.

### 10.4.1 Cross-Filter Davranışı

**Sert (Hard) Cross-Filter:** Sporthink projesinde sayfa içi cross-filter davranışı sert olarak tanımlanmıştır. Yani:

- Kullanıcı pie chart'ta "Mobile" dilimine tıklar
- Sayfa genelinde "Cihaz: Mobile" filtresi aktif olur
- TopBar'da yeni bir chip belirir
- Tüm KPI kartları, grafikler, tablolar bu filtreyle yeniden hesaplanır

Bu yaklaşımın avantajı: kullanıcı bir kez tıklayarak tüm sayfayı belirli bir boyuta odaklayabilir.

### 10.4.2 Cross-Filter Etki Alanı

Cross-filter **yalnızca aktif sayfayı** etkiler. Başka sayfaya geçilince temizlenir. (Global filtreler ise sayfalar arası taşınır.)

### 10.4.3 Cross-Filter İşareti

Cross-filter aktif olduğunda:

İlgili grafik öğesi vurgulanır (diğer dilimler soluklaşır).

TopBar'da chip olarak görünür.

Aynı öğeye tekrar tıklanınca filtre kaldırılır.

### 10.4.4 Implementation

Zustand store'da cross-filter state yönetimi:

```typescript
interface FiltersStore {
  globalFilters: Record<string, any[]>;
  pageFilters: Record<string, Record<string, any[]>>;
  crossFilters: Record<string, any[]>;  // Sadece aktif sayfa için

  addCrossFilter: (page: string, field: string, value: any) => void;
  removeCrossFilter: (field: string) => void;
  clearCrossFilters: () => void;
}

const useFiltersStore = create<FiltersStore>((set) => ({
  globalFilters: {},
  pageFilters: {},
  crossFilters: {},

  addCrossFilter: (page, field, value) => set((state) => ({
    crossFilters: {
      ...state.crossFilters,
      [field]: [...(state.crossFilters[field] || []), value],
    }
  })),

  removeCrossFilter: (field) => set((state) => {
    const { [field]: _, ...rest } = state.crossFilters;
    return { crossFilters: rest };
  }),

  clearCrossFilters: () => set({ crossFilters: {} }),
}));
```

Sayfa değiştiğinde cross-filters otomatik temizlenir:

```typescript
useEffect(() => {
  return () => {
    useFiltersStore.getState().clearCrossFilters();
  };
}, [location.pathname]);
```

## 10.5 URL Persistence

Filtre durumları URL query parameter'larına yansıtılır. Bu sayede:

- Kullanıcı sayfayı yenilese bile filtreler korunur
- Link kopyalayıp meslektaşa gönderebilir, aynı filtreli görünüm açılır
- Browser geri/ileri butonu ile filtre geçmişinde gezinebilir

URL örneği:

```
/dashboard/traffic?date_from=2026-04-01&date_to=2026-04-30&channel=paid_search,paid_social&device=mobile
```

### 10.5.1 URL Sync Implementation

```typescript
import { useSearchParams } from 'react-router-dom';

function useFilterUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useFiltersStore((state) => state.globalFilters);

  // URL'den state yükle (sayfa açılışında)
  useEffect(() => {
    const fromUrl = parseFiltersFromUrl(searchParams);
    if (Object.keys(fromUrl).length > 0) {
      useFiltersStore.getState().setGlobalFilters(fromUrl);
    }
  }, []);

  // State'ten URL güncelle (filtre değişince)
  useEffect(() => {
    const params = serializeFiltersToUrl(filters);
    setSearchParams(params, { replace: true });
  }, [filters]);
}
```

## 10.6 LocalStorage Persistence

URL persistence'a ek olarak, kullanıcının "son seçtiği" filtreler localStorage'da saklanır. Kullanıcı uygulamayı kapatıp tekrar açtığında, son filtreler otomatik geri yüklenir.

```typescript
// Tarih hariç filtreler localStorage'a yazılır (tarih her gün değişir)
const PERSIST_KEYS = ['channel', 'device', 'city'];

useEffect(() => {
  const toStore = Object.fromEntries(
    Object.entries(filters).filter(([key]) => PERSIST_KEYS.includes(key))
  );
  localStorage.setItem('lastFilters', JSON.stringify(toStore));
}, [filters]);
```

URL'de filtre yoksa, localStorage'dan yükle. URL'de filtre varsa, URL'i öncelikle.

## 10.7 Saved Views (Kayıtlı Görünümler)

Kullanıcılar sık kullandıkları filtre kombinasyonlarını "view" olarak kaydedebilir.

### 10.7.1 View Kaydetme Akışı

Kullanıcı filtreleri uygular. Sayfa üst kısmında "Görünümü Kaydet" butonuna basar. Açılan dialog'da:

- View adı (örn: "Pazartesi Sabah Raporu")
- Açıklama (opsiyonel)
- Default mu? (sayfayı her açışta otomatik yüklensin mi?)

Kayıt sonrası view, sol üst köşedeki "Görünümler" dropdown'ında listelenir.

### 10.7.2 View Yükleme

Kullanıcı dropdown'dan bir view seçer. Filtreler anında uygulanır, URL ve sayfa güncellenir.

### 10.7.3 View Sahipliği

View'lar **kullanıcı bazlıdır**. Kullanıcı sadece kendi view'larını görür. View paylaşımı (başka kullanıcıya açma) future feature olarak değerlendirilmiştir.

### 10.7.4 View Yönetimi

Her view için:

- Düzenle (filtre değişiklikleri yapıp güncelleme)
- Sil
- Default olarak işaretle

### 10.7.5 Default View

Bir view "default" olarak işaretlenirse, kullanıcı o sayfayı her açışta filtreler otomatik uygulanır. Sayfa başına bir default view olabilir.

## 10.8 Segmentasyon Sistemi

Segmentasyon, müşteri kümelerini tanımlama ve analiz etme yeteneğidir. Kullanıcılar belirli kriterlere uyan müşterileri "segment" olarak kaydedip, sonradan bu segmentlerin performansını karşılaştırabilir.

### 10.8.1 Segment Tanımı

Bir segment, belirli kuralları sağlayan müşteri kümesidir.

Örnekler:
- "İstanbul'da yaşayan, son 30 günde 2+ sipariş veren kadın müşteriler"
- "RFM 555 (Champions) - en sadık müşteriler"
- "Newsletter aboneliği olan, ama son 6 aydır sipariş vermemiş müşteriler"

### 10.8.2 Segment Kullanım Senaryoları

**1. Görüntüleme (Display):** "VIP Mobile İstanbul" segment'inin geçen ay performansı nedir?

**2. Filtre olarak (Filter):** Sadece bu segmentteki müşterilerin metriklerini görmek istiyorum.

**3. Karşılaştırma (Compare):** Yeni vs geri dönen müşteriler nasıl davranıyor?

## 10.9 Visual Segment Rule Builder

Kullanıcının teknik bilgi gerektirmeden segment kuralları oluşturabilmesi için görsel bir editör tasarlanmıştır.

### 10.9.1 Rule Builder Anatomisi

```
┌──────────────────────────────────────────────────────┐
│ Segment Adı: [VIP Mobile İstanbul              ]      │
│ Açıklama:    [...                              ]      │
├──────────────────────────────────────────────────────┤
│                                                        │
│  TÜM kurallar sağlanmalı (VE):                        │
│                                                        │
│  ┌──────────────────────────────────────────┐        │
│  │ Toplam Sipariş ▼  >= ▼  [ 5 ]    [ × ]   │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  ┌──────────────────────────────────────────┐        │
│  │ Şehir ▼          = ▼   [ İstanbul ▼ ]  [ × ]│      │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  ┌──────────────────────────────────────────┐        │
│  │  ┌── HERHANGİ biri (VEYA): ──────────┐   │        │
│  │  │ Cinsiyet = Kadın        [ × ]      │   │        │
│  │  │ Newsletter Abonesi = Evet [ × ]    │   │        │
│  │  └────────────────────────────────────┘   │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  [ + Kural Ekle ]   [ + Grup Ekle (VEYA/VE) ]        │
│                                                        │
├──────────────────────────────────────────────────────┤
│ Önizleme: 247 müşteri eşleşiyor                       │
│                                                        │
│ [ İptal ]                              [ Kaydet ]     │
└──────────────────────────────────────────────────────┘
```

### 10.9.2 Kural Yapısı

Her kural üç bölümden oluşur:

**1. Alan (Field):** Hangi müşteri özelliği? (toplam sipariş, şehir, cinsiyet, son sipariş tarihi, vb.)

**2. Operatör (Operator):** Karşılaştırma türü (=, ≠, >, ≥, <, ≤, içerir, başlar, biter, arasında)

**3. Değer (Value):** Karşılaştırılacak değer (textbox, dropdown, datepicker, vb.)

### 10.9.3 İç İçe Mantıksal Gruplar

Kullanıcı VE / VEYA mantığını iç içe kurabilir:

```
TÜMÜ (AND):
  ├─ toplam_sipariş >= 5
  ├─ şehir = İstanbul
  └─ HERHANGİ BİRİ (OR):
      ├─ cinsiyet = Kadın
      └─ newsletter_aboneliği = TRUE
```

Bu yapı JSON formatında saklanır:

```json
{
  "logic": "AND",
  "conditions": [
    { "field": "total_orders", "operator": ">=", "value": 5 },
    { "field": "city", "operator": "=", "value": "İstanbul" },
    {
      "logic": "OR",
      "conditions": [
        { "field": "gender", "operator": "=", "value": "F" },
        { "field": "is_newsletter_subscriber", "operator": "=", "value": true }
      ]
    }
  ]
}
```

### 10.9.4 Filtrelenebilir Alanlar

Kural builder'da kullanılabilen tüm alanlar:

**Müşteri Demografi:**
- Şehir (city)
- Cinsiyet (gender)
- Yaş Grubu (age_group)
- Kayıt Kanalı (registration_source)
- Newsletter Abonesi (is_newsletter_subscriber)

**Müşteri Davranış:**
- Toplam Sipariş Sayısı (total_orders)
- Toplam Ciro (total_revenue)
- Ortalama Sepet (avg_order_value, hesaplanan)
- İlk Sipariş Tarihi (first_order_date)
- Son Sipariş Tarihi (last_order_date)
- Recency (gün, hesaplanan)

**RFM Skorları:**
- R Skoru (1-5)
- F Skoru (1-5)
- M Skoru (1-5)
- RFM Segment (örn: 555, 511, 155)

**Sipariş Bazlı:**
- Tercih Edilen Ödeme Yöntemi
- En Çok Alınan Kategori
- En Çok Alınan Marka

### 10.9.5 Operatör Listesi

| Operatör | Sembol | Tipler |
|---|---|---|
| Eşittir | `=` | Tüm tipler |
| Eşit değildir | `≠` | Tüm tipler |
| Büyüktür | `>` | Sayı, tarih |
| Büyük eşittir | `≥` | Sayı, tarih |
| Küçüktür | `<` | Sayı, tarih |
| Küçük eşittir | `≤` | Sayı, tarih |
| Arasında | `between` | Sayı, tarih |
| İçerir | `contains` | Metin |
| İçermez | `not_contains` | Metin |
| Başlar | `starts_with` | Metin |
| Biter | `ends_with` | Metin |
| Listede | `in` | Multi-select |
| Listede değil | `not_in` | Multi-select |
| Boş | `is_null` | Tüm tipler |
| Dolu | `is_not_null` | Tüm tipler |

## 10.10 Segment Önizleme

Kullanıcı kural eklerken/değiştirirken anlık olarak eşleşen müşteri sayısını görür.

### 10.10.1 Debounced Preview

Performans için kullanıcı her tuş basışında değil, 500ms beklenip son değişiklikle preview yapılır:

```typescript
const debouncedRules = useDebounce(rules, 500);

const { data: preview } = useQuery({
  queryKey: ['segment-preview', debouncedRules],
  queryFn: () => api.previewSegment(debouncedRules),
  enabled: !!debouncedRules,
});
```

### 10.10.2 Preview Gösterimi

```
247 müşteri eşleşiyor
Toplam ciro: ₺428.500
Ortalama sepet: ₺1.234
```

Eşleşme sayısı 0 ise kullanıcıya uyarı gösterilir: "Bu kurallarla eşleşen müşteri yok. Kuralları gevşetmeyi deneyin."

### 10.10.3 Limit Yok

Segment kapsamı için bir üst limit konulmamıştır. Tüm müşteri tabanı (10.000+) bile bir segment olabilir. Performans Redis cache ile yönetilir.

## 10.11 Segment Hesaplama

### 10.11.1 Backend Sorgu Üretimi

JSON kural ağacı, dinamik SQL sorgusuna çevrilir:

```python
def build_segment_query(rules: dict) -> Select:
    """JSON kuralları SQLAlchemy sorgusuna çevirir."""
    base_query = select(Customer)
    where_clause = build_where_clause(rules)
    return base_query.where(where_clause)

def build_where_clause(rules: dict) -> ClauseElement:
    """Recursive olarak WHERE clause üretir."""
    if 'conditions' not in rules:
        return build_single_condition(rules)

    sub_clauses = [build_where_clause(c) for c in rules['conditions']]

    if rules['logic'] == 'AND':
        return and_(*sub_clauses)
    elif rules['logic'] == 'OR':
        return or_(*sub_clauses)

def build_single_condition(condition: dict) -> ClauseElement:
    field = condition['field']
    operator = condition['operator']
    value = condition['value']

    column = getattr(Customer, field)

    op_map = {
        '=': column == value,
        '!=': column != value,
        '>': column > value,
        '>=': column >= value,
        '<': column < value,
        '<=': column <= value,
        'in': column.in_(value),
        'not_in': ~column.in_(value),
        'contains': column.like(f'%{value}%'),
        'starts_with': column.like(f'{value}%'),
        'is_null': column.is_(None),
        'is_not_null': column.is_not(None),
    }

    return op_map[operator]
```

### 10.11.2 Cache Stratejisi

Segment'e ait müşteri listesi ve toplam sayı Redis'te cache'lenir. TTL: 30 dakika. Yeni veri import edildiğinde tüm segment cache'leri invalidate edilir.

```python
@cached(ttl=1800)  # 30 dk
async def get_segment_customers(segment_id: int) -> list[int]:
    segment = await db.get(Segment, segment_id)
    query = build_segment_query(segment.rules)
    result = await db.execute(query)
    return [c.id for c in result.scalars()]
```

## 10.12 Segment Bazlı KPI Hesaplama

Bir segment seçildikten sonra tüm KPI'lar o segment'teki müşterilerin verisi üzerinde hesaplanır.

```python
async def get_segment_kpis(segment_id: int, date_from: date, date_to: date) -> dict:
    customer_ids = await get_segment_customers(segment_id)

    # Bu müşterilerin siparişlerinden KPI hesapla
    result = await db.execute(text("""
        SELECT
            COUNT(*) AS orders,
            SUM(net_revenue) AS revenue,
            AVG(net_revenue) AS avg_order_value
        FROM orders
        WHERE customer_id IN :customer_ids
          AND order_date BETWEEN :date_from AND :date_to
    """), {
        'customer_ids': tuple(customer_ids),
        'date_from': date_from,
        'date_to': date_to,
    })

    return result.first()._asdict()
```

## 10.13 Hazır Segmentler (Future)

MVP'de yer almasa da, gelecekte sistem tarafından otomatik oluşturulan hazır segmentler eklenebilir:

| Segment | Kural |
|---|---|
| Champions | RFM 555 (R≥4 ve F≥4 ve M≥4) |
| Loyal Customers | F≥4 ve M≥3 |
| New Customers | İlk siparişten 30 gün geçmemiş |
| At Risk | R≤2 ve F≥3 (son uzun süre alışveriş yapmamış eski müşteriler) |
| Lost | R=1 ve F=1 (uzun süredir kayıp müşteriler) |
| Big Spenders | M=5 (en çok harcayanlar) |
| One-Time Buyers | F=1 (sadece bir kez alışveriş yapanlar) |

Bu otomatik segmentler sistem tarafından her import sonrası yeniden hesaplanabilir.

## 10.14 Sonraki Bölüm

Bu bölümde filtreleme ve segmentasyon sistemi detaylı olarak ele alındı. Sonraki bölümde, sistemin VDS sunucuya nasıl deploy edileceği ve operasyonel detaylar ele alınacaktır.

**Sonraki Bölüm:** [11 - Deployment ve DevOps](11-deployment.md)

*Bölüm 10 sonu.*
