# 7. FRONTEND TASARIM VE UI/UX

> **Bu Bölümde Neler Var?**
> Bu bölüm, sistemin görsel tasarımını, kullanıcı arayüzü prensiplerini, component library kullanımını, sayfa yapılarını, tema ve dil sistemini detaylı olarak ele almaktadır. shadcn/ui component library, TailwindCSS yapılandırması, ApexCharts entegrasyonu ve responsive tasarım stratejisi belgelenmiştir.

## 7.1 Tasarım Felsefesi

Sporthink KPI Dashboard'un görsel tasarımı üç temel ilke etrafında şekillenmiştir.

**Veri Önceliği.** Dashboard'un asıl amacı veriyi anlaşılır şekilde sunmaktır. Görsel süslemeler, gereksiz animasyonlar veya dikkat dağıtıcı öğeler bilinçli olarak minimize edilmiştir. Veri, ana karakterdir.

**Profesyonel Sadelık.** Tasarım, modern BI tool'larından (Tableau, Power BI, Looker, Mixpanel, Amplitude) ilham alır. Renkler ölçülü, tipografi okunaklı, boşluklar dengelidir. Kurumsal bir izlenim verir.

**Kullanıcı Verimliliği.** Yöneticiler ve analistler günlük olarak bu sisteme bakacaktır. Sık yapılan işlemler az tıklamayla erişilebilir olmalıdır. Klavye kısayolları, hızlı filtre kombinasyonları, kayıtlı görünümler bu amaca hizmet eder.

## 7.2 Renk Paleti

### 7.2.1 Brand Renkler

Sporthink'in marka kimliğine uygun olarak ana renk olarak canlı kırmızı seçilmiştir.

**Primary (Ana Renk):**

| Token | Light Mode | Dark Mode | Kullanım |
|---|---|---|---|
| `--primary` | `#e94560` | `#e94560` | Logo, CTA butonları, aktif menü, vurgu |
| `--primary-hover` | `#c81d33` | `#f45b69` | Hover durumu |
| `--primary-soft` | `#fee5e8` | `#3d1418` | Selected row, badge background |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Primary buton üzerindeki metin |

### 7.2.2 Neutral Renkler (Slate Ailesi)

Arayüzün ana yapısı slate (gri-mavi) tonlarında oluşturulmuştur. Bu sayede dashboard yorucu olmaz, uzun süre bakılabilir.

| Token | Light Mode | Dark Mode |
|---|---|---|
| `--background` | `#f1f4f9` | `#0d0f14` |
| `--surface` | `#ffffff` | `#151821` |
| `--surface-2` | `#f8fafc` | `#1c2030` |
| `--surface-3` | `#edf0f7` | `#232840` |
| `--border` | `#e2e8f0` | `#2a3040` |
| `--text` | `#0d1526` | `#e8eaf0` |
| `--text-muted` | `#64748b` | `#8b92a8` |
| `--text-dim` | `#94a3b8` | `#5a6180` |

`--background` ana sayfa arka planıdır. `--surface` kart, modal, sidebar gibi yüzeylerin rengidir. `--surface-2` form input, ikincil yüzeyler için kullanılır.

### 7.2.3 Semantic Renkler

KPI delta gösterimi, alert ve durum belirteçleri için kullanılır.

| Token | Renk | Anlam |
|---|---|---|
| `--success` | `#10b981` | Pozitif değişim, başarılı işlem |
| `--warning` | `#f59e0b` | Uyarı, dikkat gerektiren durum |
| `--error` | `#ef4444` | Hata, negatif değişim |
| `--info` | `#3b82f6` | Bilgi, nötr durum |

Önemli not: `--error` brand kırmızısı `--primary` ile farklıdır. Brand kırmızısı vurgu ve markalaşma için, error kırmızısı hata mesajları için kullanılır.

### 7.2.4 Chart Palette

Grafiklerde kullanılan kategorik renk paleti, 10 renkten oluşur. Birbirine karışmayan, dark mode'da da net görünen tonlar seçilmiştir.

```
1. #e94560 (Primary - Sporthink kırmızısı)
2. #3b82f6 (Mavi)
3. #10b981 (Yeşil)
4. #f59e0b (Sarı)
5. #8b5cf6 (Mor)
6. #06b6d4 (Cam göbeği)
7. #f97316 (Turuncu)
8. #ec4899 (Pembe)
9. #6366f1 (İndigo)
10. #14b8a6 (Teal)
```

Bu sıralama bilinçlidir. Pie chart'larda ilk dilim brand rengi olur (en önemli), diğerleri tamamlayıcı renklerle devam eder.

### 7.2.5 CSS Custom Properties

Tüm renkler CSS custom properties (variables) olarak tanımlanır. Tema değişimi `class="dark"` veya `class="light"` ile root element'te yapılır; tüm component'ler otomatik olarak yeni tema renklerini alır.

```css
:root {
  --background: #f1f4f9;
  --surface: #ffffff;
  --primary: #e94560;
  /* ... */
}

.dark {
  --background: #0d0f14;
  --surface: #151821;
  --primary: #e94560;
  /* ... */
}
```

TailwindCSS yapılandırması bu değişkenleri kullanır:

```javascript
// tailwind.config.js
colors: {
  background: 'var(--background)',
  surface: 'var(--surface)',
  primary: {
    DEFAULT: 'var(--primary)',
    hover: 'var(--primary-hover)',
    soft: 'var(--primary-soft)',
  },
  // ...
}
```

## 7.3 Tipografi

### 7.3.1 Font Ailesi

Sistem font stack kullanılır. Ek font dosyası indirme yapılmaz, bu sayede ilk sayfa yükleme süresi optimum kalır.

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Bu stack her platformda doğal görünüm sağlar:
- macOS / iOS: SF Pro
- Windows: Segoe UI
- Android: Roboto
- Linux: Helvetica Neue / Arial

### 7.3.2 Tipografi Skala

```
text-xs    = 11px  → 1.4 line-height  (badge, label)
text-sm    = 13px  → 1.5 line-height  (body, button)
text-base  = 14px  → 1.5 line-height  (default)
text-lg    = 16px  → 1.5 line-height  (subtitle)
text-xl    = 18px  → 1.4 line-height  (section header)
text-2xl   = 22px  → 1.3 line-height  (page header)
text-3xl   = 26px  → 1.2 line-height  (KPI card value)
text-4xl   = 32px  → 1.1 line-height  (large KPI)
```

### 7.3.3 Font Weight Skala

```
font-light    = 300  (rare use)
font-normal   = 400  (body)
font-medium   = 500  (subtitle, label)
font-semibold = 600  (active state, emphasis)
font-bold     = 700  (KPI value, important)
font-extrabold = 800  (page title, hero)
```

### 7.3.4 Number Formatting

Sayısal değerler için tutarlı bir formatlama yaklaşımı uygulanır.

| Aralık | Format | Örnek |
|---|---|---|
| < 1.000 | Tam sayı, locale'a göre | 423 |
| 1.000 - 999.999 | K kısaltma (binlik) | 187,4K |
| 1.000.000+ | M kısaltma (milyon) | 4,87M |

Para birimleri her zaman ₺ sembolü ile gösterilir: `₺4,87M`, `₺1.250,50`.

Türkçe locale'de binlik ayırıcı nokta, ondalık virgüldür: `1.250,50`. İngilizce locale'de tam tersidir: `1,250.50`.

## 7.4 Layout Yapısı

### 7.4.1 Genel Layout

Tüm sayfalar aşağıdaki ana layout şablonunu paylaşır.

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │          │  │  TopBar (56px)                   │  │
│  │ Sidebar  │  │  Logo • Filters • Notifications │  │
│  │          │  │  • User Menu • Settings          │  │
│  │ (240px)  │  ├─────────────────────────────────┤  │
│  │          │  │                                   │  │
│  │  • Logo  │  │                                   │  │
│  │  • Nav   │  │   Main Content Area               │  │
│  │   Items  │  │   (Sayfa içeriği)                 │  │
│  │          │  │                                   │  │
│  │  • Role  │  │                                   │  │
│  │   Badge  │  │                                   │  │
│  │          │  │                                   │  │
│  └──────────┘  └─────────────────────────────────┘  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 7.4.2 Sidebar

Sol kenarda 240 piksel genişliğinde dikey navigasyon. Hamburger butonu ile 64 piksele daraltılabilir (collapse).

**Sidebar Bileşenleri:**

Üstte: Logo (Sporthink) + Site Adı (KPI Dashboard).

Ortada: Navigation Menu (11 ana sayfa). Her menü öğesi ikon ve metin içerir. Aktif sayfa primary renk ile vurgulanır.

Altta: Aktif Rol Badge'i. Kullanıcının rol adını ve rengini gösterir.

Collapsed durumda yalnızca ikonlar görünür, hover ile tooltip metni gösterilir.

### 7.4.3 TopBar

Üst kısımda 56 piksel yüksekliğinde sticky bar. Aşağıdan yukarıya scroll yapıldığında bile görünür kalır.

**TopBar Bileşenleri:**

**Sol:** Tarih aralığı seçici. Aktif tarih aralığını gösterir. Tıklayınca preset menüsü açılır (Bugün, Son 7 gün, Son 30 gün, vb.).

**Orta:** Aktif filtre chip'leri. Kullanıcı global filtre uyguladıkça chip'ler buraya eklenir. Her chip'in [×] butonu ile kapatılabilir. "+ Filtre" butonuyla daha fazla filtre modal'ı açılabilir.

**Sağ:** Settings butonu (⚙), bildirim ikonu (🔔), kullanıcı menüsü (avatar + isim).

### 7.4.4 Main Content Area

Ana içerik alanı. Padding 24 piksel. Maksimum genişlik 1600 piksel (ultra-wide ekranlarda merkezi).

İçerik flex column düzeninde, gap 20 piksel. Sayfa elemanları arasında dikey 20 piksel boşluk.

### 7.4.5 Settings Panel (Sağ Slide-in)

Settings butonuna tıklanınca sağdan slide-in animasyonu ile açılan 320 piksel genişliğinde panel. Backdrop overlay ile arka plan karartılır.

Settings panel içeriği:
- Tema seçici (Light / Dark, sistem tercihi de seçenek)
- Dil seçici (TR / EN)
- Versiyon bilgisi

## 7.5 Sayfa Yapıları

Sistem 11 ana sayfadan oluşmaktadır.

### 7.5.1 Genel Özet (Overview) Sayfası

Sistemin ana giriş sayfasıdır. En önemli KPI'ların kuş bakışı görünümü.

**İçerik:**
- 4-6 KPI kartı (toplam ciro, sipariş sayısı, ortalama sepet, dönüşüm oranı, ROAS, vb.)
- Ciro trend grafiği (Area chart, son 30 gün)
- Kanal dağılım grafiği (Donut chart)
- Oturum trend grafiği (Line chart)
- Kanal bazlı ROAS bar grafiği (Horizontal bar)

### 7.5.2 Trafik (GA4) Sayfası

Web sitesi trafik analizi.

**İçerik:**
- 4 KPI kartı (toplam oturum, tekil kullanıcı, yeni kullanıcı, bounce rate)
- Oturum-Kullanıcı trend grafiği (combo chart)
- Kanal bazlı trafik dağılımı (bar chart)
- Cihaz dağılımı (donut)
- Şehir bazlı trafik (horizontal bar)
- Landing page performans tablosu

### 7.5.3 Meta Ads Sayfası

Facebook ve Instagram reklam performansı.

**İçerik:**
- 5 KPI kartı (harcama, ROAS, CTR, CPC, dönüşüm)
- Kampanya performans tablosu (sıralama destekli)
- Kampanya ROAS bar grafiği
- Yaş-Cinsiyet dağılımı (heatmap veya stacked bar)
- Yerleşim performansı (Feed, Story, Reels)

### 7.5.4 Google Ads Sayfası

Google Ads kampanya performansı.

**İçerik:**
- 5 KPI kartı (harcama, ROAS, CTR, CPC, dönüşüm)
- Kampanya performans tablosu
- Kanal tipi dağılımı (Search / Shopping / PMax)
- Anahtar kelime performans tablosu (Search kampanyaları için)
- Ürün performansı (Shopping/PMax için)

### 7.5.5 E-Ticaret Sayfası

Sipariş ve satış analizi.

**İçerik:**
- 4 KPI kartı (toplam ciro, sipariş sayısı, ortalama sepet, iade oranı)
- Kategori dağılımı (donut)
- Cihaz dağılımı (donut)
- Şehir bazlı ciro (horizontal bar)
- En çok satan ürünler tablosu
- Ödeme yöntemi dağılımı

### 7.5.6 Kampanya Analizi Sayfası

Tüm platformların (Meta + Google) kampanyalarını birlikte gösterir.

**İçerik:**
- Platform karşılaştırma KPI'ları
- Kampanya tablosu (platform, harcama, dönüşüm, ROAS)
- Kampanya bazlı zaman serisi
- Kampanya karşılaştırma grafiği

### 7.5.7 Funnel Analizi Sayfası

Ziyaretten satın almaya dönüşüm akışı.

**İçerik:**
- Funnel grafiği (4 aşama: ürün görüntüleme → sepete ekleme → ödeme başlatma → satın alma)
- Her aşamadaki bırakma oranı
- Cihaz bazlı funnel karşılaştırma
- Kanal bazlı funnel karşılaştırma

### 7.5.8 Cohort/Retention Sayfası

Kullanıcı sadakati analizi.

**İçerik:**
- Cohort heatmap (haftalık veya aylık)
- Retention curve (line chart)
- Cohort filtreleri (yaş grubu, kayıt kanalı)

### 7.5.9 Ürün Performansı Sayfası

Ürün bazlı satış ve görüntüleme analizi.

**İçerik:**
- En çok satan ürünler (top 20)
- Marka bazlı dağılım
- Kategori bazlı performans
- Stok-satış oranı
- Kâr marjı analizi

### 7.5.10 Veri Import Sayfası

Veri yükleme arayüzü.

**İçerik:**
- 4 adımlı stepper (Upload → Mapping → Validate → Done)
- Her adım için ilgili UI (drag-drop alan, mapping interface, validation report)
- Import geçmişi tablosu (alt kısımda)

### 7.5.11 Kullanıcı/Roller Sayfası

Kullanıcı yönetimi (Süper Admin için).

**İçerik:**
- Tab navigation: Kullanıcılar / Roller
- Kullanıcılar tab: Liste, "Yeni Kullanıcı" butonu, edit/delete aksiyonları
- Roller tab: Rol kartları, izin sayısı, üye sayısı, edit butonu

## 7.6 Component Library (shadcn/ui)

### 7.6.1 Form Bileşenleri

| Bileşen | Kullanım Alanı |
|---|---|
| `Button` | CTA, aksiyon butonları |
| `Input` | Tek satırlık metin girişi |
| `Textarea` | Çok satırlı metin girişi |
| `Select` | Dropdown seçim |
| `Combobox` | Aranabilir dropdown |
| `Checkbox` | Tekli seçim |
| `RadioGroup` | Birden bire seçim |
| `Switch` | Boolean toggle |
| `DatePicker` | Tarih seçimi |
| `Slider` | Aralık seçimi |
| `Form` | RHF + Zod entegrasyonlu form wrapper |

### 7.6.2 Layout Bileşenleri

| Bileşen | Kullanım Alanı |
|---|---|
| `Card` | İçerik kartı |
| `Sheet` | Slide-in panel (Settings, Mobile menu) |
| `Tabs` | Sekme navigasyonu (Users / Roles) |
| `Accordion` | Genişletilebilir bölümler (Permission grupları) |
| `Separator` | Yatay/dikey ayırıcı çizgi |
| `ScrollArea` | Custom scrollbar |

### 7.6.3 Overlay Bileşenleri

| Bileşen | Kullanım Alanı |
|---|---|
| `Dialog` | Modal pencereler |
| `AlertDialog` | Confirmation dialog'ları |
| `Popover` | Tooltip benzeri açılır içerik |
| `Tooltip` | Hover ipucu metinleri |
| `Toast` (Sonner) | Bildirim mesajları |
| `DropdownMenu` | Context menü, user menü |

### 7.6.4 Veri Görüntüleme Bileşenleri

| Bileşen | Kullanım Alanı |
|---|---|
| `Table` | Düz veri tablosu |
| `DataTable` | Sıralama, sayfalama, filtreleme destekli tablo |
| `Badge` | Durum, etiket |
| `Avatar` | Kullanıcı profil resmi |
| `Skeleton` | Yükleme placeholder'ı |
| `Progress` | İlerleme çubuğu |

### 7.6.5 Navigation Bileşenleri

| Bileşen | Kullanım Alanı |
|---|---|
| `NavigationMenu` | Üst navigasyon menüsü |
| `Breadcrumb` | Kırıntı navigasyon |
| `Pagination` | Sayfa numaraları |
| `Command` | Cmd+K hızlı arama (future) |

## 7.7 KPI Card Tasarımı

KPI kartları sistemin görsel kimliğinin merkezindedir. Her sayfada KPI'lar bu standart kartlarla gösterilir.

### 7.7.1 KPI Card Anatomisi

```
┌──────────────────────────────────────┐
│  TOPLAM SESSİON              ◐ Sparkline │
│                                       │
│  187,4K                              │
│                                       │
│  ▲ 16,2% geçen aya göre              │
└──────────────────────────────────────┘
```

**Bileşenler:**

Üst etiket: KPI ismi (UPPERCASE, küçük punto, muted renk).

Ana değer: Büyük punto, bold (font-extrabold), `text-3xl`.

Delta gösterimi: Önceki dönemle karşılaştırmalı yüzde değişim. Yukarı ok yeşil, aşağı ok kırmızı (bazı KPI'lar için tersi - örn: Bounce Rate, CPC).

Mini sparkline: Son 7 günlük trend mini grafiği (opsiyonel, alt kısımda).

### 7.7.2 Renk Mantığı (Trend Direction)

Tüm KPI'larda yukarı ok = yeşil, aşağı = kırmızı değildir. Bazı KPI'lar düşük olduğunda iyi sayılır:

**Yukarı = İyi (Pozitif):**
Sessions, Users, Revenue, Orders, AOV, Conversion Rate, ROAS, Engagement Rate

**Aşağı = İyi (Negatif iyi):**
Bounce Rate, CPC, CPM, Cost per Conversion, Refund Rate, Ad Spend (her zaman değil, bağlama göre)

Bu mantık `KpiCard` component'inin `inverseTrend` prop'u ile kontrol edilir.

### 7.7.3 KPI Grid Layout

KPI kartları responsive grid içinde dizilir:

```css
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
gap: 12px;
```

Geniş ekranlarda 5-6 kart yan yana, dar ekranlarda otomatik olarak alt alta düşer.

## 7.8 Grafik Tasarımı

### 7.8.1 ApexCharts Kullanımı

Tüm grafikler ApexCharts ile render edilir. `react-apexcharts` wrapper kullanılır.

### 7.8.2 Standart Grafik Yapısı

Her grafik tipi için ortak ayarlar:

```javascript
const baseOptions = {
  chart: {
    fontFamily: 'inherit',
    foreColor: 'var(--text-muted)',
    toolbar: { show: false },
  },
  colors: PALETTE,  // 10 renkli paletten
  stroke: { curve: 'smooth', width: 2 },
  grid: { borderColor: 'var(--border)' },
  tooltip: {
    theme: theme,  // 'dark' veya 'light'
    style: { fontSize: '12px' },
  },
  legend: {
    position: 'bottom',
    fontSize: '11px',
    markers: { width: 8, height: 8 },
  },
};
```

### 7.8.3 Grafik Tipleri

**Line Chart:** Zaman serisi metrikler (sessions trend, revenue trend).

**Area Chart:** Cumulative değerler veya vurgulu trendler (revenue trend with gradient).

**Bar Chart (Vertical):** Kategorik karşılaştırma (kanal bazlı performans).

**Bar Chart (Horizontal):** Sıralanmış liste (en çok satan ürünler).

**Donut Chart:** Dağılım (kanal dağılımı, cihaz dağılımı).

**Funnel Chart:** Dönüşüm aşamaları (ziyaret → satın alma).

**Heatmap:** Cohort analizi, yaş-cinsiyet matrisi.

**Combo Chart:** Birden fazla metrik birlikte (oturum + kullanıcı, harcama + dönüşüm).

### 7.8.4 Tooltip Standartı

Tooltip'ler her zaman tutarlı format kullanır:

```
[Tarih veya kategori]
─────────────────────
■ Metric 1: Değer
■ Metric 2: Değer
```

Para değerleri ₺ ile, yüzdeler % ile, sayılar K/M kısaltmasıyla.

## 7.9 Tablolar

### 7.9.1 DataTable Component

Liste ekranlarında kullanılan ana tablo bileşeni. shadcn/ui DataTable üzerine inşa edilmiştir.

**Özellikler:**

Sıralama (her kolonun başlığına tıklanabilir).

Sayfalama (alt kısımda 1, 2, 3... butonları + "Toplam X kayıt").

Arama (üst kısımda search input).

Filtreleme (kolon bazlı dropdown filtreler).

Kolon görünürlük toggle (kullanıcı hangi kolonların görüneceğini seçebilir).

Row hover etkisi (background: surface-2).

Selectable rows (toplu işlem için checkbox).

### 7.9.2 Tablo Stili

```
┌──────────────────────────────────────────────┐
│ Kolon A ↑   │ Kolon B   │ Kolon C   │  Aksiyon │
├──────────────────────────────────────────────┤
│ Hücre 1     │ Hücre 2   │ ₺ 1.250   │  ⋮       │
│ Hücre 1     │ Hücre 2   │ ₺ 850     │  ⋮       │
│ ...                                              │
├──────────────────────────────────────────────┤
│  ‹ 1 2 3 ... 8 ›                          120 toplam │
└──────────────────────────────────────────────┘
```

**Detay:**
- Tablo başlığı uppercase, küçük punto, muted renk
- Sayısal kolonlar sağa hizalı
- Para sütunları primary renk ile vurgulanabilir
- Aksiyon kolonu üç nokta menü (Edit, Delete)

## 7.10 Tema Sistemi

### 7.10.1 Tema Algılama

İlk girişte sistem tarayıcının `prefers-color-scheme` tercihini algılar.

```typescript
// stores/themeStore.ts
const getInitialTheme = (): 'light' | 'dark' => {
  // 1. localStorage'da kaydedilmiş tercih varsa onu kullan
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;

  // 2. Yoksa sistem tercihini algıla
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};
```

### 7.10.2 Tema Değişimi

Kullanıcı Settings panelinden veya TopBar'dan tema değiştirebilir. Değişim anında yansır, sayfa yenilemeye gerek yoktur.

```typescript
const setTheme = (theme: 'light' | 'dark') => {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
  localStorage.setItem('theme', theme);
};
```

CSS custom properties bu sınıf değişiminde otomatik güncellenir.

### 7.10.3 Sistem Tercihi Modu

Kullanıcı isterse "Sistem tercihi" modunu seçebilir. Bu modda OS tema değişiklikleri otomatik takip edilir.

```typescript
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    if (themeMode === 'system') {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
```

## 7.11 Dil Sistemi (i18n)

### 7.11.1 Çeviri Dosya Yapısı

Çeviriler statik JSON dosyalarında saklanır.

```
public/locales/
├── tr/
│   ├── common.json         (Genel UI metinleri)
│   ├── nav.json            (Navigation menüleri)
│   ├── kpi.json            (KPI isimleri ve birimleri)
│   ├── pages.json          (Sayfa başlıkları, açıklamaları)
│   ├── forms.json          (Form etiketleri)
│   ├── errors.json         (Hata mesajları)
│   └── filters.json        (Filtre seçenekleri)
└── en/
    └── ... (aynı yapı)
```

### 7.11.2 Çeviri Kullanımı

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('kpi');

  return (
    <div>
      <h2>{t('totalSessions')}</h2>
      <span>{t('vsLastPeriod', { count: 16.2 })}</span>
    </div>
  );
}
```

`tr/kpi.json`:
```json
{
  "totalSessions": "Toplam Oturum",
  "vsLastPeriod": "{{count}}% geçen döneme göre"
}
```

### 7.11.3 Backend Hata Çevirisi

Backend hata kodları döner (`PASSWORD_TOO_SHORT`), frontend bu kodu çevirir:

`tr/errors.json`:
```json
{
  "PASSWORD_TOO_SHORT": "Şifre en az {{min}} karakter olmalıdır",
  "INVALID_CREDENTIALS": "Email veya şifre hatalı",
  "ACCOUNT_LOCKED": "Hesabınız {{minutes}} dakika kilitlendi"
}
```

```typescript
function translateError(error: ApiError): string {
  const { code, params } = error;
  return t(`errors:${code}`, params);
}
```

### 7.11.4 Tarih ve Sayı Formatlaması

```typescript
import dayjs from 'dayjs';
import 'dayjs/locale/tr';

// Locale ayarı
dayjs.locale(language);

// Tarih
dayjs(date).format('DD MMM YYYY');  // 15 Nis 2026 (TR) | Apr 15, 2026 (EN)

// Sayı
new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US').format(1250.50);
// "1.250,50" (TR) | "1,250.50" (EN)

// Para
new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(1250.50);
// "₺1.250,50"
```

## 7.12 Responsive Tasarım

### 7.12.1 Breakpoint'ler

TailwindCSS standart breakpoint'leri kullanılır.

| Breakpoint | Min Width | Cihaz |
|---|---|---|
| (default) | 0px | Mobile |
| `sm:` | 640px | Large mobile |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Laptop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

### 7.12.2 Mobile Strategy

Sistem mobile-first değil, **desktop-first** geliştirilir. Çünkü:
- Hedef kullanıcılar (yöneticiler, analistler) çoğunlukla masaüstü kullanır
- Dashboard tipi yoğun veri içeren ekranlar mobile'da zor görüntülenir
- 11 haftalık MVP içinde mobile optimization öncelik değil

Ancak mobil kullanım engellenmez. Aşağıdaki düzenlemeler yapılır:

**Sidebar:** Mobile'da varsayılan olarak gizli, hamburger butonu ile açılır.

**TopBar:** Mobile'da filtre chip'leri yatay scrollable olur.

**Grid'ler:** KPI kartları otomatik olarak alt alta düşer.

**Tablolar:** Yatay scroll olur, kolon gizleme yapılmaz.

**Charts:** ApexCharts otomatik olarak mobile'da legend pozisyonunu ve label rotation'ını ayarlar.

Tam mobile optimization (hamburger menü, touch gestures, mobile-specific layouts) future feature olarak değerlendirilir.

## 7.13 Yükleme Durumları (Loading States)

### 7.13.1 Skeleton

Tüm async veri yükleme durumları skeleton component ile gösterilir. Spinner kullanılmaz.

```tsx
{isLoading ? (
  <Skeleton className="h-32 w-full" />
) : (
  <KpiCard data={data} />
)}
```

### 7.13.2 Empty States

Veri olmadığında her sayfada açıklayıcı bir empty state gösterilir.

```
┌──────────────────────────────────────┐
│              📊                       │
│     Henüz Meta Ads verisi yok         │
│                                        │
│     Veri import etmek için              │
│     [Veri Import Et] butonuna basın   │
└──────────────────────────────────────┘
```

Empty state component'i:
- İkon (lucide-react'tan)
- Başlık (büyük punto)
- Açıklama (muted renk)
- Aksiyon butonu (yeni veri oluşturma yönlendirmesi)

### 7.13.3 Error States

Hata durumlarında benzer bir error state gösterilir.

```
┌──────────────────────────────────────┐
│              ⚠                         │
│     Bir hata oluştu                    │
│                                        │
│     Veri yüklenirken sorun oldu        │
│     [Tekrar Dene]                      │
└──────────────────────────────────────┘
```

## 7.14 Animasyon ve Geçişler

Animasyonlar minimum tutulur ve fonksiyonel amaçlıdır.

| Etki | Süre | Easing | Kullanım |
|---|---|---|---|
| Fade in | 350ms | ease | Sayfa girişi, modal açılma |
| Slide in | 300ms | ease | Sidebar, settings panel |
| Hover | 150ms | ease | Buton, link, kart hover |
| Tema geçişi | 200ms | ease | Light/Dark tema |
| Skeleton pulse | 1500ms | infinite | Loading durumu |

Karmaşık animasyonlar (parallax, scroll-triggered, vb.) kullanılmaz. Performance ve dikkat dağıtmama önceliklidir.

## 7.15 Erişilebilirlik (Accessibility)

shadcn/ui Radix UI tabanlı olduğu için erişilebilirlik standartları otomatik gelir.

**Klavye Navigasyonu:** Tüm interaktif elementler Tab ile erişilebilir. Modal açıkken focus trap aktif olur.

**Screen Reader Desteği:** ARIA label'lar, landmark'lar otomatik atanır.

**Renk Kontrastı:** WCAG 2.1 AA standardı (4.5:1) sağlanır. Önemli metinler 7:1 oranı (AAA) hedefler.

**Focus Visible:** Klavye ile gezinen kullanıcılar için focus ring her zaman görünür.

## 7.16 Sonraki Bölüm

Bu bölümde frontend tasarım ve UI/UX kararları detaylı olarak ele alındı. Sonraki bölümde, sistemin can damarı olan veri import sistemi tüm aşamalarıyla incelenecektir.

**Sonraki Bölüm:** [08 - Veri Import Sistemi](08-import-system.md)

*Bölüm 07 sonu.*
