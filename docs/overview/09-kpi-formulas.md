# 9. KPI HESAPLAMA MODELİ

> **Bu Bölümde Neler Var?**
> Bu bölüm, sistemde hesaplanan tüm KPI'ların (Key Performance Indicators) tanımlarını, hesaplama formüllerini, kullanılan veri kaynaklarını ve iş anlamlarını detaylı olarak ele almaktadır. 4 kategoride 30+ KPI, SQL implementasyon örnekleriyle birlikte belgelenmiştir.

## 9.1 KPI Genel Tanımı

KPI (Key Performance Indicator), bir organizasyonun belirlediği hedeflere ne ölçüde ulaştığını değerlendirmek amacıyla kullanılan ölçülebilir performans göstergeleridir. Dijital pazarlama ve e-ticaret alanında KPI'lar; trafik, reklam performansı, dönüşüm oranı ve satış gibi kritik metrikler üzerinden işletmelerin performansını analiz etmeyi mümkün kılar.

Sporthink KPI Dashboard, dört ana kategoride toplam 31 KPI hesaplamaktadır:

| Kategori | KPI Sayısı | Veri Kaynağı |
|---|---|---|
| Trafik (Traffic) | 8 | GA4 |
| Reklam (Advertising) | 10 | Meta Ads + Google Ads |
| Satış (Sales) | 8 | E-ticaret (orders) |
| Pazarlama Performansı | 5 | Çapraz kaynak |
| **Toplam** | **31** | |

## 9.2 Hesaplama Stratejisi

KPI'lar, sorgulama performansı için aggregation tabloları üzerinden hesaplanır. Ham veri tabloları doğrudan sorgulanmaz, çünkü 1 milyon+ satır içeren tablolar üzerinde anlık sorgu çok yavaş olur.

### 9.2.1 İki Katmanlı Hesaplama

**Katman 1: Aggregation Tablosu Hesaplama (Import sonrası)**

Veri import edildikten sonra Celery task ile `kpi_daily_aggregates`, `kpi_monthly_aggregates`, `kpi_campaign_aggregates` tabloları yeniden hesaplanır. Bu işlem dakikalar sürebilir, ama sadece import sonrası çalışır.

**Katman 2: Anlık KPI Hesaplama (Dashboard Sorgulamada)**

Kullanıcı dashboard'a baktığında, frontend KPI değerlerini istemek için `/api/v1/kpi/summary` endpoint'ini çağırır. Backend bu istekte:

1. Önce Redis cache'i kontrol eder. Aynı parametrelerle daha önce sorgu yapılmışsa, cache'ten anında döner (~5ms).

2. Cache'te yoksa, aggregation tablolarından SQL `SUM()`, `AVG()` gibi fonksiyonlarla hesaplama yapar (~30ms).

3. Sonucu Redis'te 5 dakika TTL ile cache'ler.

Bu strateji ile dashboard yükleme süresi 50ms altında kalır.

### 9.2.2 Karşılaştırma Periyodu

Çoğu KPI, kullanıcının seçtiği tarih aralığının yanı sıra önceki dönem için de hesaplanır. Bu sayede yüzde değişim (delta) gösterilebilir.

Örnek: Kullanıcı "Son 30 gün" seçtiyse:
- Mevcut Dönem: 1-30 Nisan 2026
- Önceki Dönem (default): 2 Mart - 31 Mart 2026 (önceki 30 gün)
- Önceki Dönem (alternatif): 1-30 Nisan 2025 (geçen yılın aynı dönemi - YoY)

Kullanıcı toggle ile hangi karşılaştırmayı tercih edeceğini seçer.

```sql
-- Mevcut dönem (örnek: revenue)
SELECT SUM(revenue) FROM kpi_daily_aggregates
WHERE date BETWEEN '2026-04-01' AND '2026-04-30';

-- Önceki dönem (otomatik: aynı gün sayısı geriye)
SELECT SUM(revenue) FROM kpi_daily_aggregates
WHERE date BETWEEN '2026-03-02' AND '2026-03-31';

-- Geçen yıl aynı dönem
SELECT SUM(revenue) FROM kpi_daily_aggregates
WHERE date BETWEEN '2025-04-01' AND '2025-04-30';
```

### 9.2.3 Trend Yönü (Direction)

Tüm KPI'lar için trend yönü (artış/azalış) hesaplanır. Bazı KPI'larda artış pozitiftir (revenue, sessions), bazılarında negatiftir (bounce rate, CPC).

```python
def calculate_trend(current: float, previous: float, kpi_id: str) -> dict:
    """KPI'nın trendini ve iyi/kötü yorumunu döndürür."""
    if previous == 0:
        change = None
    else:
        change = ((current - previous) / previous) * 100

    direction = 'up' if current >= previous else 'down'

    # Bazı KPI'lar düşük olduğunda iyi
    inverse_kpis = {'bounce_rate', 'cpc', 'cpm', 'cost_per_conversion', 'refund_rate'}
    is_positive = (direction == 'up') if kpi_id not in inverse_kpis else (direction == 'down')

    return {
        'value': current,
        'previous_value': previous,
        'change_percentage': round(change, 1) if change else None,
        'direction': direction,
        'is_positive': is_positive,
    }
```

## 9.3 Trafik KPI'ları (8 KPI)

Bu kategoride GA4'ten gelen web sitesi trafik verileri üzerinde hesaplanan metrikler bulunur.

### 9.3.1 Toplam Oturum (Sessions)

**Tanım:** Belirlenen tarih aralığında siteye yapılan toplam ziyaret sayısı. Trafik hacmini anlamak ve kampanya etkisini ölçmek için temel metriktir.

**Formül:** Seçilen tarih aralığındaki tüm oturumların toplamı.

```sql
SELECT SUM(sessions) AS total_sessions
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Adet (sayı)

**İdeal Trend:** Yukarı (artış olumlu)

### 9.3.2 Tekil Kullanıcı (Users)

**Tanım:** Belirli dönemde siteyi ziyaret eden benzersiz kullanıcı sayısı. Gerçek erişimi ölçmek için oturum sayısından daha anlamlıdır.

**Formül:** Aynı kullanıcı tekrar ziyaret etse bile tek sayılarak toplam benzersiz kullanıcı sayısı.

```sql
SELECT SUM(users) AS total_users
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

Not: GA4 API'den gelen `total_users` zaten unique olarak hesaplanmıştır. Aggregation tablosunda günlük unique user'ların toplamı alınır. (Cross-day unique user için ayrı bir hesap gerekirdi, MVP kapsamında değil.)

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.3.3 Yeni Kullanıcı (New Users)

**Tanım:** Daha önce siteyi ziyaret etmemiş kullanıcıların sayısı. Yeni müşteri kazanım performansını ölçer.

**Formül:** İlk kez ziyaret eden kullanıcıların toplamı.

```sql
SELECT SUM(new_users) AS total_new_users
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.3.4 Hemen Çıkma Oranı (Bounce Rate)

**Tanım:** Tek sayfa görüntüleyip çıkan kullanıcı oranı. İçerik kalitesi ve trafik uygunluğunu analiz etmek için kullanılır.

**Formül:** (Tek sayfa görüntülenen oturumlar ÷ toplam oturumlar) × 100

```sql
SELECT
    (SUM(bounce_sessions) / NULLIF(SUM(sessions), 0)) * 100 AS bounce_rate
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Yüzde (%)

**İdeal Trend:** Aşağı (düşük olması iyi)

### 9.3.5 Oturum Başına Sayfa (Pages per Session)

**Tanım:** Kullanıcıların site içinde ne kadar gezindiğini gösterir. Etkileşim seviyesi hakkında fikir verir.

**Formül:** Toplam sayfa görüntüleme ÷ Toplam oturum

```sql
SELECT
    SUM(total_page_views) / NULLIF(SUM(sessions), 0) AS pages_per_session
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Adet (ortalama)

**İdeal Trend:** Yukarı

### 9.3.6 Ortalama Oturum Süresi (Average Session Duration)

**Tanım:** Kullanıcıların sitede geçirdiği ortalama süre. İçerik ve deneyim kalitesiyle doğrudan ilişkilidir.

**Formül:** Toplam oturum süresi ÷ Toplam oturum

```sql
SELECT
    SUM(total_session_duration) / NULLIF(SUM(sessions), 0) AS avg_session_duration
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Saniye (UI'da "2dk 35sn" formatına çevrilir)

**İdeal Trend:** Yukarı

### 9.3.7 Trafikten Siparişe Dönüşüm Oranı (Traffic Conversion Rate)

**Tanım:** Oturumların siparişe dönüşme oranı. E-ticaret performansının en kritik göstergelerindendir.

**Formül:** (Toplam sipariş ÷ Toplam oturum) × 100

```sql
SELECT
    (SUM(orders) / NULLIF(SUM(sessions), 0)) * 100 AS conversion_rate
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** Yüzde (%)

**İdeal Trend:** Yukarı

### 9.3.8 Trafik Büyüme Oranı (Traffic Growth Rate)

**Tanım:** Önceki dönemle kıyaslandığında trafik artış veya azalışını ölçer.

**Formül:** ((Mevcut dönem oturum − önceki dönem oturum) ÷ önceki dönem oturum) × 100

Bu KPI doğrudan ana KPI tablosunda gösterilmez, diğer KPI'ların delta hesabıyla zaten gösterilir. Trend grafiklerinde belirtilebilir.

## 9.4 Reklam KPI'ları (10 KPI)

Bu kategoride Meta Ads ve Google Ads platformlarından gelen reklam performans verileri kullanılır.

### 9.4.1 Toplam Harcama (Ad Spend)

**Tanım:** Belirli dönemde reklam platformlarına yapılan toplam harcama.

**Formül:** Seçilen tarih aralığındaki toplam reklam harcaması (Meta + Google).

```sql
SELECT SUM(spend) AS total_spend
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** TL (₺)

**İdeal Trend:** Bağlama göre (artış kötü değil, ama getirisi olmalı)

### 9.4.2 Toplam Gösterim (Impressions)

**Tanım:** Reklamların kaç kez görüntülendiğini ifade eder.

**Formül:** Tüm kampanyalardaki toplam gösterim sayısı.

```sql
SELECT SUM(impressions) AS total_impressions
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** Adet

**İdeal Trend:** Yukarı (marka görünürlüğü için)

### 9.4.3 Toplam Tıklama (Clicks)

**Tanım:** Kullanıcıların reklamlara yaptığı toplam tıklama.

**Formül:** Tüm kampanyalardaki toplam tıklama.

```sql
SELECT SUM(clicks) AS total_clicks
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.4.4 Tıklama Oranı (CTR - Click-Through Rate)

**Tanım:** Gösterim başına tıklama oranı. Reklamın dikkat çekiciliğini ölçer.

**Formül:** (Toplam tıklama ÷ Toplam gösterim) × 100

```sql
SELECT
    (SUM(clicks) / NULLIF(SUM(impressions), 0)) * 100 AS ctr
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** Yüzde (%)

**İdeal Trend:** Yukarı

### 9.4.5 Tıklama Başına Maliyet (CPC - Cost Per Click)

**Tanım:** Bir tıklama elde etmek için yapılan ortalama harcama.

**Formül:** Toplam harcama ÷ Toplam tıklama

```sql
SELECT
    SUM(spend) / NULLIF(SUM(clicks), 0) AS cpc
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** TL

**İdeal Trend:** Aşağı (düşük maliyet iyi)

### 9.4.6 Bin Gösterim Başına Maliyet (CPM - Cost Per Mille)

**Tanım:** Marka görünürlüğü açısından önemli bir metriktir. Bin kişiye ulaşmanın maliyetini gösterir.

**Formül:** (Toplam harcama ÷ Toplam gösterim) × 1000

```sql
SELECT
    (SUM(spend) / NULLIF(SUM(impressions), 0)) * 1000 AS cpm
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** TL

**İdeal Trend:** Aşağı

### 9.4.7 Reklam Kaynaklı Sipariş (Ad Conversions)

**Tanım:** Reklamdan gelen satış sayısı.

**Formül:** Reklam kaynaklı siparişlerin toplamı.

```sql
SELECT SUM(ad_conversions) AS total_ad_conversions
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.4.8 Dönüşüm Başına Maliyet (Cost per Conversion / CPA)

**Tanım:** Bir sipariş elde etmek için yapılan ortalama harcama.

**Formül:** Toplam harcama ÷ Toplam dönüşüm

```sql
SELECT
    SUM(spend) / NULLIF(SUM(ad_conversions), 0) AS cost_per_conversion
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** TL

**İdeal Trend:** Aşağı

### 9.4.9 Reklam Getirisi (ROAS - Return on Ad Spend)

**Tanım:** Reklam harcamasına karşı elde edilen geliri gösterir. En kritik performans metriklerinden biridir.

**Formül:** Reklam kaynaklı gelir ÷ Toplam harcama

```sql
SELECT
    SUM(ad_revenue) / NULLIF(SUM(spend), 0) AS roas
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform IN ('meta', 'google');
```

**Birim:** Çarpan (örn: 4.5x)

**İdeal Trend:** Yukarı

**Yorum:** ROAS = 4.5x demek "1 TL reklam harcamasından 4.5 TL gelir elde edildi" demektir. Genellikle 3x altı zayıf, 5x üzeri çok iyi sayılır.

### 9.4.10 Gösterim Frekansı (Frequency)

**Tanım:** Kullanıcı başına ortalama reklam gösterim sayısı. Fazla olması doygunluğu gösterir.

**Formül:** Toplam gösterim ÷ Erişilen kullanıcı sayısı (reach)

```sql
SELECT
    SUM(impressions) / NULLIF(SUM(reach), 0) AS frequency
FROM meta_ads
WHERE date_start BETWEEN :date_from AND :date_to;
```

Not: Frequency yalnızca Meta Ads'te direkt vardır. Google Ads'te farklı hesaplanır (impression_share + reach yoktur).

**Birim:** Çarpan

**İdeal Trend:** 1.5-3.0 arası optimal. 4+ ise kullanıcı doygunluğu (ad fatigue) yaşanıyor demektir.

## 9.5 Satış KPI'ları (8 KPI)

Bu kategoride e-ticaret sipariş verileri üzerinde hesaplanan metrikler bulunur.

### 9.5.1 Toplam Ciro (Revenue)

**Tanım:** Belirli dönemde elde edilen toplam satış tutarı.

**Formül:** Seçilen tarih aralığındaki toplam satış tutarı.

```sql
SELECT SUM(revenue) AS total_revenue
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce';
```

**Birim:** TL

**İdeal Trend:** Yukarı

### 9.5.2 Sipariş Sayısı (Orders)

**Tanım:** Toplam işlem hacmini gösterir.

**Formül:** Toplam sipariş sayısı.

```sql
SELECT SUM(orders) AS total_orders
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce';
```

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.5.3 Satılan Ürün Adedi (Items Sold)

**Tanım:** Operasyon hacmini ölçmek için kullanılır. Bir siparişte birden fazla ürün olabilir.

**Formül:** Siparişlerdeki toplam ürün adedi.

```sql
SELECT SUM(items_sold) AS total_items_sold
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce';
```

Veya doğrudan:

```sql
SELECT SUM(quantity) AS total_items_sold
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_date BETWEEN :date_from AND :date_to;
```

**Birim:** Adet

**İdeal Trend:** Yukarı

### 9.5.4 Ortalama Sepet Tutarı (Average Order Value - AOV)

**Tanım:** Sipariş başına ortalama harcamayı gösterir.

**Formül:** Toplam ciro ÷ Toplam sipariş

```sql
SELECT
    SUM(revenue) / NULLIF(SUM(orders), 0) AS aov
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce';
```

**Birim:** TL

**İdeal Trend:** Yukarı

### 9.5.5 Kullanıcı Başına Gelir (Revenue per User)

**Tanım:** Kullanıcı kalitesini ölçmek için kullanılır.

**Formül:** Toplam ciro ÷ Toplam kullanıcı

```sql
SELECT
    SUM(revenue) / NULLIF(SUM(users), 0) AS revenue_per_user
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to;
```

**Birim:** TL

**İdeal Trend:** Yukarı

### 9.5.6 Tekrar Satın Alma Oranı (Repeat Purchase Rate)

**Tanım:** Sadakati ölçmek için en önemli metriklerden biridir.

**Formül:** (Birden fazla sipariş veren müşteri sayısı ÷ Toplam müşteri) × 100

```sql
SELECT
    (
        SELECT COUNT(*)
        FROM customers
        WHERE total_orders >= 2
          AND first_order_date BETWEEN :date_from AND :date_to
    ) / NULLIF((
        SELECT COUNT(*)
        FROM customers
        WHERE first_order_date BETWEEN :date_from AND :date_to
    ), 0) * 100 AS repeat_purchase_rate;
```

**Birim:** Yüzde (%)

**İdeal Trend:** Yukarı

### 9.5.7 İade Oranı (Refund Rate)

**Tanım:** Operasyonel kaliteyi ve ürün memnuniyetini gösterir.

**Formül:** (Toplam iade tutarı ÷ Toplam ciro) × 100

```sql
SELECT
    (SUM(refund_total) / NULLIF(SUM(revenue), 0)) * 100 AS refund_rate
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce';
```

**Birim:** Yüzde (%)

**İdeal Trend:** Aşağı

### 9.5.8 Ciro Büyüme Oranı (Revenue Growth Rate)

**Tanım:** Önceki dönemle karşılaştırmalı performansı gösterir.

**Formül:** ((Mevcut ciro − önceki ciro) ÷ önceki ciro) × 100

Bu KPI doğrudan ayrı kart olarak gösterilmez, Revenue KPI'sının delta yüzdesi olarak gösterilir.

## 9.6 Pazarlama Performans KPI'ları (5 KPI)

Bu kategoride çapraz veri kaynağından (GA4 + e-ticaret) hesaplanan stratejik metrikler bulunur.

### 9.6.1 Kanal Bazlı Ciro (Revenue by Channel)

**Tanım:** Hangi kanalın daha verimli olduğunu gösterir.

**Formül:** Kanal bazlı toplam satış tutarı.

```sql
SELECT
    channel,
    SUM(revenue) AS revenue
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
  AND platform = 'ecommerce'
GROUP BY channel
ORDER BY revenue DESC;
```

**Birim:** TL

**Görselleştirme:** Donut chart veya horizontal bar chart.

### 9.6.2 Kanal Bazlı Dönüşüm Oranı (Conversion Rate by Channel)

**Tanım:** Trafik kalitesini analiz eder. Hangi kanalın getirdiği trafiğin satışa dönüşme oranı en yüksek?

**Formül:** (Kanal bazlı sipariş ÷ Kanal bazlı oturum) × 100

```sql
SELECT
    channel,
    (SUM(orders) / NULLIF(SUM(sessions), 0)) * 100 AS conversion_rate
FROM kpi_daily_aggregates
WHERE date BETWEEN :date_from AND :date_to
GROUP BY channel
ORDER BY conversion_rate DESC;
```

**Birim:** Yüzde (%)

**Görselleştirme:** Bar chart.

### 9.6.3 Kampanya Bazlı Gelir (Revenue by Campaign)

**Tanım:** Kampanya performansını ölçer.

**Formül:** Kampanya kaynaklı toplam satış tutarı.

```sql
SELECT
    c.campaign_name,
    c.platform,
    SUM(o.net_revenue) AS revenue
FROM orders o
LEFT JOIN campaigns c ON o.campaign_name = c.campaign_name
WHERE o.order_date BETWEEN :date_from AND :date_to
  AND c.campaign_name IS NOT NULL
GROUP BY c.campaign_name, c.platform
ORDER BY revenue DESC;
```

**Birim:** TL

**Görselleştirme:** Sıralanmış tablo, kampanya bazlı bar chart.

### 9.6.4 Yeni vs Geri Dönen Müşteri Geliri (New vs Returning Revenue)

**Tanım:** Büyüme modelini analiz etmek için kullanılır. Gelirin yüzde kaçı yeni müşterilerden, yüzde kaçı tekrarlayan müşterilerden geliyor?

**Formül:** Yeni müşterilerden gelen ciro ve mevcut müşterilerden gelen cironun ayrı hesaplanması.

```sql
SELECT
    CASE
        WHEN c.first_order_date >= :date_from THEN 'new'
        ELSE 'returning'
    END AS customer_type,
    SUM(o.net_revenue) AS revenue,
    COUNT(DISTINCT o.order_id) AS orders
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date BETWEEN :date_from AND :date_to
GROUP BY customer_type;
```

**Birim:** TL ve adet

**Görselleştirme:** Stacked bar chart veya donut.

### 9.6.5 Günlük Performans Değişimi (Daily Performance Change)

**Tanım:** Gün bazlı performans dalgalanmalarını gösterir.

**Formül:** ((Bugünkü değer − Dünkü değer) ÷ Dünkü değer) × 100

```sql
SELECT
    date,
    revenue,
    LAG(revenue) OVER (ORDER BY date) AS previous_day_revenue,
    ((revenue - LAG(revenue) OVER (ORDER BY date)) /
     NULLIF(LAG(revenue) OVER (ORDER BY date), 0)) * 100 AS change_percentage
FROM (
    SELECT date, SUM(revenue) AS revenue
    FROM kpi_daily_aggregates
    WHERE date BETWEEN :date_from AND :date_to
    GROUP BY date
) daily_summary;
```

**Birim:** Yüzde (%)

**Görselleştirme:** Trend grafiği veya tablo.

## 9.7 İleri Analitik Hesaplamaları

Yukarıdaki 31 standart KPI dışında, sayfalarda kullanılan ileri analitikler:

### 9.7.1 Funnel Analizi

E-ticaret dönüşüm akışı (ürün görüntüleme → sepete ekleme → ödeme başlatma → satın alma).

```sql
SELECT
    SUM(items_viewed) AS step1_view,
    SUM(items_added_to_cart) AS step2_add_to_cart,
    SUM(items_checked_out) AS step3_checkout,
    SUM(items_purchased) AS step4_purchase,

    -- Bırakma oranları
    (1 - SUM(items_added_to_cart) / NULLIF(SUM(items_viewed), 0)) * 100 AS drop1_view_to_cart,
    (1 - SUM(items_checked_out) / NULLIF(SUM(items_added_to_cart), 0)) * 100 AS drop2_cart_to_checkout,
    (1 - SUM(items_purchased) / NULLIF(SUM(items_checked_out), 0)) * 100 AS drop3_checkout_to_purchase
FROM ga4_item_engagement
WHERE date BETWEEN :date_from AND :date_to;
```

**Görselleştirme:** Funnel chart (ApexCharts).

### 9.7.2 Cohort Analizi

Kullanıcıların ilk siparişinin yapıldığı aya göre gruplandırılması ve sonraki aylarda kaçının tekrar sipariş verdiğinin izlenmesi.

```sql
WITH cohort_users AS (
    SELECT
        DATE_FORMAT(first_order_date, '%Y-%m') AS cohort_month,
        customer_id
    FROM customers
    WHERE first_order_date BETWEEN :date_from AND :date_to
),
user_orders AS (
    SELECT
        cu.cohort_month,
        cu.customer_id,
        DATE_FORMAT(o.order_date, '%Y-%m') AS order_month,
        TIMESTAMPDIFF(MONTH, STR_TO_DATE(CONCAT(cu.cohort_month, '-01'), '%Y-%m-%d'), o.order_date) AS month_offset
    FROM cohort_users cu
    JOIN orders o ON cu.customer_id = o.customer_id
)
SELECT
    cohort_month,
    month_offset,
    COUNT(DISTINCT customer_id) AS customer_count
FROM user_orders
WHERE month_offset >= 0 AND month_offset <= 12
GROUP BY cohort_month, month_offset
ORDER BY cohort_month, month_offset;
```

**Görselleştirme:** Heatmap (cohort × ay matrisi).

### 9.7.3 RFM (Recency, Frequency, Monetary) Skoru

Müşteri segmentasyonu için klasik bir model.

```sql
WITH customer_rfm AS (
    SELECT
        customer_id,
        DATEDIFF(:reference_date, last_order_date) AS recency_days,
        total_orders AS frequency,
        total_revenue AS monetary
    FROM customers
)
SELECT
    customer_id,
    NTILE(5) OVER (ORDER BY recency_days ASC) AS r_score,
    NTILE(5) OVER (ORDER BY frequency DESC) AS f_score,
    NTILE(5) OVER (ORDER BY monetary DESC) AS m_score
FROM customer_rfm;
```

R skoru düşük = uzun süre alışveriş yapmamış (kötü).
F skoru yüksek = sık alışveriş yapan (iyi).
M skoru yüksek = çok harcayan (iyi).

**Skor segmentleri:**
- 555: Champions (en iyi müşteriler)
- 511: New customers (yeni başlayanlar)
- 155: At risk (kayıp riski olan eski müşteriler)
- 111: Lost (kaybedilmiş müşteriler)

### 9.7.4 Müşteri Yaşam Boyu Değeri (CLV - Customer Lifetime Value)

MVP'de basit yaklaşım kullanılır:

```sql
SELECT
    customer_id,
    total_revenue / NULLIF(DATEDIFF(NOW(), first_order_date) / 365, 0) AS annual_clv_estimate
FROM customers
WHERE first_order_date < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

Daha gelişmiş modeller (Pareto/NBD, BG/NBD) future feature olarak değerlendirilir.

### 9.7.5 Top Performans Listeleri

**En çok satan ürünler:**

```sql
SELECT
    p.sku,
    p.product_name,
    p.brand,
    SUM(oi.quantity) AS total_sold,
    SUM(oi.line_total) AS total_revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN products p ON oi.item_id = p.sku
WHERE o.order_date BETWEEN :date_from AND :date_to
GROUP BY p.sku, p.product_name, p.brand
ORDER BY total_revenue DESC
LIMIT 20;
```

**En çok harcayan müşteriler:**

```sql
SELECT
    c.customer_id,
    c.city,
    c.gender,
    c.age_group,
    SUM(o.net_revenue) AS total_revenue,
    COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_date BETWEEN :date_from AND :date_to
GROUP BY c.customer_id, c.city, c.gender, c.age_group
ORDER BY total_revenue DESC
LIMIT 50;
```

## 9.8 KPI Değer Yorumlama

Her KPI için anlamlı yorumlar yapılabilmesi için referans aralıklar tanımlıdır. Bu aralıklar dashboard'da renk kodlamasında kullanılabilir (future feature).

| KPI | Zayıf | Orta | İyi | Mükemmel |
|---|---|---|---|---|
| Bounce Rate | >70% | 50-70% | 30-50% | <30% |
| Conversion Rate | <1% | 1-2% | 2-4% | >4% |
| ROAS | <2x | 2-3x | 3-5x | >5x |
| CTR (Search) | <1% | 1-2% | 2-5% | >5% |
| CTR (Display) | <0.5% | 0.5-1% | 1-2% | >2% |
| Repeat Purchase Rate | <10% | 10-20% | 20-30% | >30% |
| Refund Rate | >10% | 5-10% | 2-5% | <2% |

Bu değerler sektör ortalamalarıdır; Sporthink'in spor giyim sektörü için spesifik değerler farklı olabilir.

## 9.9 Cache Stratejisi

KPI sorgularının hızlı olması için Redis cache kullanılır.

### 9.9.1 Cache Key Yapısı

```python
def generate_cache_key(endpoint: str, params: dict) -> str:
    """Parametre kombinasyonundan deterministik cache key üretir."""
    sorted_params = sorted(params.items())
    param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
    hash_str = hashlib.md5(param_str.encode()).hexdigest()
    return f"kpi:{endpoint}:{hash_str}"
```

Örnek key: `kpi:summary:a1b2c3d4...`

### 9.9.2 TTL (Time to Live)

| Cache Tipi | TTL |
|---|---|
| KPI summary | 5 dakika |
| Dashboard trend | 5 dakika |
| Filter options (kanal, şehir listesi) | 30 dakika |
| User permissions | 5 dakika |

### 9.9.3 Cache Invalidation

Yeni veri import edildiğinde, ilgili tarih aralıklarındaki KPI cache'leri temizlenir:

```python
async def invalidate_kpi_cache_for_dates(date_from: date, date_to: date):
    pattern = "kpi:*"
    async for key in redis.scan_iter(match=pattern):
        # Cache'in metadata'sından tarih aralığını çıkart, çakışıyorsa sil
        # Basit yaklaşım: tüm KPI cache'lerini temizle
        await redis.delete(key)
```

MVP'de basit yaklaşım: yeni import sonrası tüm KPI cache'leri temizlenir.

## 9.10 Sonraki Bölüm

Bu bölümde sistemin tüm KPI'ları, hesaplama formülleri ve SQL implementasyonları detaylı olarak ele alındı. Sonraki bölümde, kullanıcıların bu KPI'ları farklı boyutlarda görüntülemesini sağlayan filtreleme ve segmentasyon sistemi incelenecektir.

**Sonraki Bölüm:** [10 - Filtreleme ve Segmentasyon](10-filtering-segments.md)

*Bölüm 09 sonu.*
