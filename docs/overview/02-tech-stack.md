# 2. TEKNOLOJİ STACK VE MİMARİ TERCİHLER

> **Bu Bölümde Neler Var?**
> Bu bölüm, projede kullanılan tüm teknolojileri ve bu teknolojilerin neden seçildiğini açıklar. Frontend, backend, veritabanı, cache, container, CI/CD ve diğer altyapı bileşenleri için yapılan tercihler ve bu tercihlerin alternatiflerle karşılaştırılması detaylı olarak ele alınmıştır.

## 2.1 Teknoloji Seçim Kriterleri

Her teknoloji tercihi yapılmadan önce aşağıdaki dört temel kriter değerlendirilmiştir:

**Olgunluk ve Topluluk Desteği.** Seçilen teknolojilerin geniş bir geliştirici topluluğuna sahip olması, bilgi paylaşımı, hata çözümü ve güncellemeler açısından kritik önem taşımaktadır. Yeni veya niş teknolojiler yerine, sektör standardı haline gelmiş seçenekler tercih edilmiştir.

**Performans ve Ölçeklenebilirlik.** Sistem 50 eşzamanlı kullanıcıyı ve 1+ yıllık geçmiş veriyi performans kaybı olmadan desteklemelidir. Bu nedenle her bileşenin yüksek yük altında nasıl davrandığı incelenmiştir.

**Geliştirme Hızı.** 11 haftalık dar zaman çerçevesinde, yüksek geliştirici verimliliği sunan ve hazır component / kütüphane ekosistemine sahip teknolojiler tercih edilmiştir.

**Sürdürülebilirlik.** Proje teslim sonrasında bakım yapılabilirlik, dokümantasyon kalitesi ve uzun vadeli destek sürekliliği değerlendirilmiştir.

## 2.2 Mimari Yaklaşım: 3-Tier Architecture

Sistem, klasik üç katmanlı (3-tier) mimari yaklaşımıyla tasarlanmıştır. Bu mimari, sunum, iş mantığı ve veri katmanlarının birbirinden net şekilde ayrılmasını sağlar.

```
┌─────────────────────────────────────────────────┐
│         SUNUM KATMANI (Presentation)             │
│  React 19 + Vite + TailwindCSS + shadcn/ui      │
│  ApexCharts + Zustand + TanStack Query           │
└─────────────────────────────────────────────────┘
                       │
                       │ HTTPS / JSON
                       ▼
┌─────────────────────────────────────────────────┐
│       İŞ MANTIĞI KATMANI (Business Logic)        │
│  FastAPI + SQLAlchemy + Pydantic                 │
│  Celery (Background Jobs) + Redis (Cache)        │
└─────────────────────────────────────────────────┘
                       │
                       │ SQL / Connection Pool
                       ▼
┌─────────────────────────────────────────────────┐
│           VERİ KATMANI (Data)                    │
│  MySQL 8.4 LTS (Ana DB) + Redis 7.4 (Cache)      │
│  Local File Storage (Uploaded Files)             │
└─────────────────────────────────────────────────┘
```

**Bu yaklaşımın avantajları:**

Her katman bağımsız olarak değiştirilebilir. Örneğin frontend Vue.js'e taşınmak istense, backend ve DB katmanları etkilenmez. Aynı şekilde MySQL'den PostgreSQL'e geçiş, ORM soyutlaması sayesinde minimum kod değişikliğiyle yapılabilir.

Test edilebilirlik artar. Her katman izole olarak test edilebilir; backend için API testleri, frontend için component testleri ayrı ayrı yazılır.

Ölçeklenebilirlik avantajı sağlar. Yük artışında her katman bağımsız olarak yatay (horizontal) ölçeklenebilir. Backend stateless olduğundan birden fazla instance çalıştırılabilir.

## 2.3 Frontend Teknolojileri

### 2.3.1 React 19

**Tercih:** React 19.x (en güncel kararlı sürüm).

**Gerekçe:** React, dünyanın en yaygın kullanılan frontend kütüphanesidir. Component bazlı mimarisi, sanal DOM (Virtual DOM) yaklaşımıyla yüksek performans, devasa ekosistem ve aktif topluluk desteği sunmaktadır. React 18'de gelen Concurrent Rendering, otomatik batching ve Suspense temellerine ek olarak React 19, Actions API'si, `useTransition` üzerinden async submit handler desteği, yeni `use()` hook'u ve `ref` prop'unun forwardRef gerektirmeden kullanılabilmesi gibi modern özellikler sunar. Bu özellikler dashboard tipi yoğun veri işleyen uygulamalar için önemli avantajlar sağlamaktadır.

**Alternatifler ve Neden Seçilmediği:**

| Alternatif | Neden Seçilmedi |
|---|---|
| Vue.js 3 | Topluluk büyüklüğü React'tan küçük, kurumsal projelerde React daha yaygın tercih edilir |
| Angular | Öğrenme eğrisi dik, RxJS karmaşıklığı 11 haftalık projeye uygun değil |
| Svelte | Henüz tam olgunlaşmamış, component kütüphane ekosistemi sınırlı |

### 2.3.2 Vite

**Tercih:** Vite 8.x build tool olarak kullanılmaktadır.

**Gerekçe:** Vite, geliştirme sürecinde Hot Module Replacement (HMR) açısından geleneksel webpack tabanlı araçlardan (Create React App) belirgin biçimde hızlıdır. ESBuild ve Rollup üzerine inşa edilmiş olması, soğuk başlatma süresini saniyeler düzeyine indirir. Production build'lerinde tree-shaking ve code splitting otomatik olarak optimize edilir.

**Alternatifler:**

Create React App (CRA) artık Meta tarafından "deprecated" olarak işaretlendi, yeni projelerde önerilmiyor. Next.js full-stack framework olduğu için sadece SPA dashboard için aşırı kapsamlı (overkill) olarak değerlendirildi. Webpack konfigürasyon karmaşıklığı nedeniyle tercih edilmedi.

### 2.3.3 TailwindCSS

**Tercih:** TailwindCSS 4.x utility-first CSS framework.

**Gerekçe:** TailwindCSS, utility class yaklaşımıyla CSS yazma süresini ciddi şekilde kısaltır. Geliştirici, ayrı bir CSS dosyası açıp class isimleri uydurmak yerine, doğrudan HTML/JSX içinde stillemeyi yapar. v4 ile gelen yeni Oxide engine sayesinde build süresi v3'e göre belirgin biçimde kısalır, kullanılmayan stiller otomatik elimine edilir ve production CSS dosyası küçük kalır. Konfigürasyon CSS-first yaklaşıma geçtiğinden tema değişkenleri doğrudan `@theme` bloğunda tanımlanabilir.

Tailwind'in dark mode desteği yapılandırılabilir, projemizde sınıf bazlı (`class` strategy) kullanılacaktır. Bu sayede kullanıcı tercihiyle anlık tema değişimi yapılabilir.

**Alternatifler:**

Bootstrap, daha az esneklik sunar ve özelleştirme zorluğu yaratır. CSS Modules veya Styled Components gibi component-scoped CSS yaklaşımları daha fazla kod yazımı gerektirir. Material UI (MUI) hazır component'lerle gelir ancak özelleştirme kısıtları ve büyük bundle boyutu nedeniyle tercih edilmedi.

### 2.3.4 shadcn/ui

**Tercih:** shadcn/ui component library.

**Gerekçe:** shadcn/ui, klasik npm paketi yerine "copy-paste" modeli kullanan modern bir yaklaşıma sahiptir. Bileşenleri `npx shadcn-ui add button` komutuyla doğrudan proje koduna kopyalar. Bu sayede:

Bileşenlerin kaynak kodu projede bulunur, tam kontrol sağlanır. İhtiyaç halinde bileşen davranışı değiştirilebilir, ekstra prop eklenebilir.

Radix UI primitives üzerine inşa edildiği için erişilebilirlik (accessibility, a11y) standartları otomatik olarak uygulanır. Klavye navigasyonu, screen reader desteği, focus yönetimi gibi konular hazır gelir.

TailwindCSS ile tam uyumludur. Tema sistemine doğal entegrasyon sağlar; CSS değişkenleri (`--primary`, `--background`, `--muted-foreground` vb.) light/dark tema arasında otomatik geçiş yapar.

Bundle boyutuna katkı sıfırdır; sadece kullanılan bileşenler projede yer alır.

**Kullanılacak Temel Bileşenler:**

Form (Input, Select, Checkbox, Radio, Switch, DatePicker), Layout (Card, Sheet, Tabs, Accordion), Overlay (Dialog, AlertDialog, Popover, Tooltip, Toast), Data (Table, DataTable, Badge), Navigation (NavigationMenu, DropdownMenu, Command, Combobox).

### 2.3.5 ApexCharts

**Tercih:** ApexCharts 3.x veri görselleştirme kütüphanesi.

**Gerekçe:** ApexCharts, BI tool seviyesinde zengin grafik tipleri sunan, modern ve interaktif bir kütüphanedir. Dashboard projelerinin ihtiyaç duyduğu tüm grafik tiplerini kapsar:

Line, Area, Bar, Column (basic charts), Pie, Donut (distribution), Funnel, Treemap, Heatmap (advanced), Candlestick, Box Plot (financial), Radar, Polar Area (comparison), Mixed (combo) charts.

Grafiklerin etkileşim özellikleri yüksektir: tooltip, zoom, pan, legend toggling, data point click, annotations. Cross-filter implementasyonu için event handler'lar mevcuttur.

React entegrasyonu `react-apexcharts` paketiyle sorunsuz çalışır.

**Alternatifler:**

Recharts (tasarım taslağında kullanılmıştı), React-native ve hafif olmasına rağmen heatmap, funnel, treemap gibi gelişmiş chart tiplerini desteklemiyor. Chart.js, daha basit kullanım sunar ancak interaktivite ve görsel kalite ApexCharts'tan zayıftır. Highcharts ticari lisans gerektirir, açık kaynak değildir.

### 2.3.6 Zustand (Client State Management)

**Tercih:** Zustand state management library.

**Gerekçe:** Zustand, React state yönetimi için minimal API'ye sahip, ~1KB boyutunda modern bir kütüphanedir. Redux'un boilerplate karmaşıklığını ortadan kaldırır. TypeScript desteği üst düzeydir, Redux DevTools entegrasyonu hazır gelir.

**Projede Zustand ile Yönetilecek State'ler:**

`useAuthStore` (kullanıcı bilgileri, JWT token), `useThemeStore` (light/dark tema), `useLanguageStore` (TR/EN dil), `useFiltersStore` (global filtreler), `useToastStore` (bildirimler), `useSidebarStore` (sidebar collapse durumu).

**Alternatifler:**

Redux Toolkit, endüstri standardı olmasına rağmen küçük-orta projeler için boilerplate fazla kabul edildi. React Context API, sık güncellenen state'lerde performans sorunlarına yol açar (gereksiz re-render). Jotai ve Recoil atomic state yaklaşımı bizim ihtiyacımız için fazla detaycı bulundu.

### 2.3.7 TanStack Query (Server State Management)

**Tercih:** TanStack Query 5.x (eski adıyla React Query).

**Gerekçe:** TanStack Query, server state yönetiminde endüstri standardıdır. API'den çekilen verilerin cache'lenmesi, otomatik refetch, optimistic updates, pagination ve infinite scroll gibi karmaşık senaryoları otomatik yönetir.

Dashboard'da KPI verileri sık erişilen ve cache'lenmesi kritik veriler olduğundan TanStack Query'nin cache mekanizması performansı yüksek oranda iyileştirir. Filtreler değiştiğinde otomatik refetch tetiklenir, manuel state yönetimi gerekmez.

`staleTime` ve `cacheTime` parametreleriyle cache stratejileri sayfa bazında özelleştirilebilir.

**Server State ve Client State Ayrımı:**

Modern frontend mimarisinde, server'dan gelen veri (server state) ile sadece client'ta yaşayan state (UI state) ayrı kütüphanelerle yönetilir. TanStack Query server state'i, Zustand UI state'i yönetir. Bu ayrım, kod kalitesini ve bakım yapılabilirliği artırır.

### 2.3.8 React Hook Form + Zod

**Tercih:** Form yönetimi için React Hook Form 7.x, validasyon için Zod 3.x.

**Gerekçe:** React Hook Form (RHF), uncontrolled component yaklaşımıyla yüksek form performansı sunar. Her input değişikliğinde tüm formun re-render edilmesini engeller. TypeScript desteği güçlüdür.

Zod, TypeScript-first schema validation kütüphanesidir. Schema tanımı doğrudan TypeScript tipine dönüşür (`z.infer`). Backend tarafında Pydantic ile yazılan şemalar, frontend Zod şemalarıyla "mirror" edilebilir. Bu sayede:

Backend'de `password: str = Field(..., min_length=10)` ile yazılan kural, frontend'de `password: z.string().min(10)` olarak yazılır. Aynı kuralın iki katmanda da uygulandığı garantilenir.

Hata mesajları locale'e göre çevrilebilir. Backend hata kodu döner (`PASSWORD_TOO_SHORT`), frontend Zod kuralı tetiklenince i18n sözlüğünden Türkçe mesaj çekilir.

shadcn/ui'nin Form bileşeni hazır olarak React Hook Form + Zod entegrasyonu ile gelir.

### 2.3.9 i18next + react-i18next

**Tercih:** Çoklu dil yönetimi için i18next ve react-i18next.

**Gerekçe:** i18next, JavaScript ekosisteminde en yaygın kullanılan i18n kütüphanesidir. Lazy loading desteği, çoğullaştırma (pluralization), interpolation gibi özellikler hazır gelir.

Çeviri dosyaları statik JSON formatında saklanacaktır:

```
public/locales/
├── tr/
│   ├── common.json
│   ├── kpi.json
│   └── errors.json
└── en/
    ├── common.json
    ├── kpi.json
    └── errors.json
```

Bu yaklaşım, çevirilerin DB yerine kod repository'sinde versiyonlanmasını sağlar. Yeni çeviri eklemek bir commit ile yapılır, kontrollü ve geri alınabilir bir süreçtir.

## 2.4 Backend Teknolojileri

### 2.4.1 FastAPI

**Tercih:** FastAPI 0.115+ (Python 3.12 üzerinde).

**Gerekçe:** FastAPI, Python ekosisteminde modern, async-native, yüksek performanslı bir web framework'üdür. Aşağıdaki özellikleri ile öne çıkmaktadır:

**Otomatik OpenAPI/Swagger dokümantasyonu.** Endpoint'ler, type hint'ler ve Pydantic modeller üzerinden otomatik olarak Swagger UI ve ReDoc dokümantasyonu üretilir. Bu, manuel dokümantasyon yazma yükünü ortadan kaldırır.

**Type Safety.** Python 3.12'nin tip sistemiyle (type hints) entegre çalışır. Hem geliştirme sırasında IDE autocomplete sağlar, hem de runtime'da Pydantic ile veri doğrulaması yapar.

**Async/Await Desteği.** ASGI (Asynchronous Server Gateway Interface) tabanlı olarak çalışır. I/O yoğun işlemlerde (DB sorgu, API çağrısı) thread bloklamadan paralel çalışabilir.

**Performans.** Starlette ve Pydantic v2 üzerine inşa edilmiştir. Node.js Express ve Go gin gibi framework'lere yakın performans sergiler. TechEmpower benchmark sonuçlarında üst sıralarda yer alır.

**Alternatifler:**

Django, monolithic ve "batteries included" yaklaşımıyla küçük API projeleri için aşırı kapsamlıdır. Django REST Framework eklemek karmaşıklığı artırır. Flask, hafif bir microframework olmasına rağmen async desteği zayıftır ve type system entegrasyonu yoktur. Express.js (Node.js) JavaScript ekosistemi gerektirir, ekibin Python uzmanlığı tercih edilmiştir. Laravel (PHP) modern Python ekosistemine kıyasla geride kalmıştır.

### 2.4.2 SQLAlchemy 2.0

**Tercih:** SQLAlchemy 2.0+ ORM.

**Gerekçe:** SQLAlchemy, Python'un en olgun ve esnek ORM'idir. 2.0 sürümü ile birlikte tam async destek (asyncio) sunmaktadır. FastAPI'nin async yapısıyla uyumlu çalışır.

ORM yaklaşımı SQL injection saldırılarını otomatik olarak engeller; tüm sorgular parametrik olarak yazılır.

İleri seviye SQL özelliklerini destekler: subquery, window function, common table expression (CTE), partition. Aggregation tablolarımız bu özelliklerden yararlanacaktır.

**Migration Yönetimi:** Alembic ile entegre çalışır. Veritabanı schema değişiklikleri kontrollü migration dosyalarıyla yönetilir. Production'da geriye dönük (rollback) migration mümkündür.

### 2.4.3 Pydantic 2.x

**Tercih:** Pydantic v2 (Rust ile yazılmış core).

**Gerekçe:** Pydantic, request/response validation ve veri serileştirme için kullanılır. v2 sürümünde Rust ile yeniden yazılmış core sayesinde 5-10x performans artışı sağlamaktadır.

Şema tanımı net ve okunabilirdir:

```python
class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=10)
    first_name: str
    last_name: str
    role_id: int
```

FastAPI ile entegre çalışır; endpoint parametreleri otomatik olarak Pydantic modeller üzerinden validate edilir, hata yanıtları standart formatta dönülür.

### 2.4.4 Celery + Redis (Background Jobs)

**Tercih:** Celery 5.4+ görev kuyruğu, Redis 7.4 broker ve sonuç deposu olarak.

**Gerekçe:** Büyük veri import işlemleri (50 MB CSV dosyaları) HTTP isteğinin timeout süresini aşabilir. Bu nedenle:

Frontend dosyayı yükler, backend bir job ID döner ve işi Celery worker'a delege eder. Frontend periyodik olarak polling ile job durumunu sorgular.

Celery, başarısız olan job'ları otomatik retry edebilir. Network hatası, geçici DB sorunu gibi durumlarda fail-fast yerine resilient davranır.

Celery worker sayısı yatay olarak ölçeklenebilir. Yük artarsa daha fazla worker eklenir.

**Redis Çift Rolü:** Bu projede Redis hem Celery broker (görev kuyruğu) hem de KPI cache deposu olarak kullanılır. Tek bir Redis instance iki amaç için yeterlidir; ayrı veritabanları (db 0 ve db 1) ile izole edilir.

### 2.4.5 JWT Authentication (python-jose + passlib)

**Tercih:** JWT (JSON Web Token) standardı, `python-jose` kütüphanesi ile.

**Gerekçe:** JWT stateless authentication sağlar; backend session bilgisi tutmaz. Bu sayede backend yatay ölçeklenebilir, sticky session'a ihtiyaç duymaz.

**Token Stratejisi:**

Access Token: 15 dakika geçerli, JWT format, request header'da gönderilir (`Authorization: Bearer <token>`).

Refresh Token: 7 gün geçerli, httpOnly cookie içinde tutulur. JavaScript erişemez (XSS koruması).

Logout işleminde refresh token DB blacklist'e alınır. Aynı token tekrar kullanılamaz.

**Şifre Hash:** `passlib` kütüphanesi ile bcrypt (cost factor 12) kullanılır. Plaintext şifre veritabanında hiçbir zaman saklanmaz.

## 2.5 Veritabanı ve Cache

### 2.5.1 MySQL 8.4 LTS

**Tercih:** MySQL 8.4 LTS ana veritabanı olarak.

**Gerekçe:** MySQL, ilişkisel veritabanı yönetim sistemleri arasında en yaygın kullanılanıdır. Sporthink'in mevcut altyapısına ve teknik personel bilgisine uyumludur. 8.4, MySQL'in yeni LTS (Long-Term Support) sürümüdür ve uzun ömürlü destek garantisi sağlar; 8.0 serisinin destek ömrü Nisan 2026'da sona ermiştir.

**MySQL 8.4'ün Bu Proje İçin Önemli Özellikleri:**

JSON veri tipi desteği (segment kuralları gibi yapısal olmayan veriler için).

Window functions ve CTE desteği (KPI hesaplamalarında karmaşık sorgular için).

Tarih bazlı partition desteği (büyük veri tablolarında performans için).

InnoDB storage engine ile transaction (ACID) garantisi.

Foreign key constraint'lerin tam desteği.

**Charset:** `utf8mb4_unicode_ci` kullanılacaktır. Türkçe karakterler (ş, ğ, ç, ı, İ, ö, ü) ve emoji desteği için zorunludur. Eski `utf8` (3 byte) charset emojiyi kıramadığı için terk edilmiştir.

**Para Birimi Saklama:** Tüm finansal alanlar `DECIMAL(15,2)` olarak saklanacaktır. `FLOAT` veya `DOUBLE` floating-point hata riski taşıdığı için kullanılmayacaktır.

**Timezone:** Tüm tarihler UTC olarak saklanacak, frontend `dayjs` ile Türkiye saatine (Europe/Istanbul) dönüştürecektir.

**Alternatifler:**

PostgreSQL, gelişmiş özellikleri (JSONB, array tipi, generated columns) ile MySQL'den ileridedir ancak Sporthink ekosistemine MySQL daha uygun bulunmuştur. SQLite, sadece geliştirme ortamında kullanılabilir, production için yetersizdir. MongoDB, ilk planda log verisi için düşünülmüş ancak proje sadeleştirilerek tek DB tercih edilmiştir.

### 2.5.2 Redis 7.4

**Tercih:** Redis 7.4 in-memory cache ve görev kuyruğu olarak.

**Gerekçe:** Redis, in-memory veri yapıları sağlayan ultra-hızlı bir key-value store'dur. Mikrosaniye düzeyinde okuma/yazma performansı sunar.

**Bu Projede Redis'in Üç Rolü:**

**KPI Cache:** Sık sorgulanan KPI sonuçları cache'lenir. Aynı tarih aralığı + filtre kombinasyonu için sorgu MySQL'e gitmez, Redis'ten döner. TTL (Time To Live) 5-15 dakika arasında ayarlanır.

**Celery Broker:** Background job kuyruğu olarak kullanılır. Worker'lar Redis'ten görev çeker.

**Rate Limiting:** `slowapi` kütüphanesi Redis üzerinden IP bazlı rate limit kayıtları tutar.

Redis verileri RAM'de tutulduğu için sunucu yeniden başlatıldığında kaybolur. Bu nedenle yalnızca tekrar üretilebilir veriler (cache, geçici işler) Redis'te saklanır. Kritik veri MySQL'de tutulur.

## 2.6 DevOps ve Altyapı

### 2.6.1 Docker ve Docker Compose

**Tercih:** Docker 27+ container teknolojisi, Docker Compose 2.30+ orchestration.

**Gerekçe:** Docker, "benim makinemde çalışıyor" sorununu ortadan kaldırır. Geliştirme ve production ortamları aynı container imajları üzerinden çalışır. Sunucuya kurulum tek komutla yapılır:

```bash
docker compose up -d
```

**Container Mimarisi:**

```yaml
services:
  nginx:        # Reverse proxy + SSL
  frontend:     # React build (Nginx ile servis)
  backend:      # FastAPI + Uvicorn
  celery:       # Background workers
  mysql:        # 8.0
  redis:        # 7.x
```

Her servis kendi container'ında izole çalışır. Bir servisin çökmesi diğerlerini etkilemez. Container'lar birbirleriyle iç ağ üzerinden iletişim kurar.

**Volumes (Kalıcı Veri):** MySQL ve Redis verileri host makineye mount edilir. Container yeniden oluşturulsa bile veriler kalıcıdır.

**Environment Variables:** Hassas bilgiler (DB şifresi, JWT secret) `.env` dosyasında tutulur. `.env` dosyası `.gitignore` içindedir, repository'ye commit edilmez.

### 2.6.2 Nginx

**Tercih:** Nginx reverse proxy ve static file server olarak.

**Gerekçe:** Nginx, dünyanın en yaygın web server'larından biridir. Düşük bellek tüketimi, yüksek concurrent connection desteği ve esnek konfigürasyonu ile öne çıkar.

**Bu Projede Nginx'in Rolleri:**

SSL/TLS terminasyonu (Let's Encrypt sertifikası burada uygulanır).

Frontend static dosyalarını serve etme (React build çıktıları).

Backend API isteklerini FastAPI'ye proxy etme (`/api/*` rotalarını backend container'a yönlendirir).

Gzip sıkıştırma (response boyutunu küçültür).

HTTP/2 desteği (multiplexing, server push).

Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`).

### 2.6.3 Let's Encrypt + Certbot

**Tercih:** Let's Encrypt SSL sertifikaları, Certbot ile otomatik yenileme.

**Gerekçe:** Let's Encrypt ücretsiz, otomatize SSL sertifikaları sağlar. Certbot ile 90 günde bir otomatik yenileme yapılır. Kurulum tek komuttur:

```bash
certbot --nginx -d dashboard.sporthink.com.tr
```

Tüm production trafiği HTTPS üzerinden geçer. HTTP istekleri otomatik olarak HTTPS'e yönlendirilir.

### 2.6.4 GitHub Actions (CI/CD)

**Tercih:** GitHub Actions sürekli entegrasyon ve dağıtım için.

**Gerekçe:** Repository GitHub'da olduğundan, GitHub Actions doğal entegrasyon sunar. Ayrı bir CI servisi (Jenkins, CircleCI) kurulumu gerektirmez.

**Pipeline Adımları:**

1. **Lint:** Ruff (Python), ESLint (JavaScript) kontrolleri.
2. **Test:** pytest (backend), Vitest (frontend) çalıştırılır.
3. **Build:** Frontend `npm run build`, backend Docker imajı `docker build`.
4. **Deploy:** SSH ile sunucuya bağlanır, `docker compose pull && docker compose up -d` çalıştırır.

Her `main` branch'e push otomatik olarak production deployment tetikler. Feature branch'lerde sadece lint ve test çalışır.

### 2.6.5 Gmail SMTP (E-posta)

**Tercih:** Gmail SMTP relay (`smtp.gmail.com:587`, STARTTLS) — Gmail App Password ile.

**Gerekçe:** Bitirme projesi ölçeğinde (50 eşzamanlı kullanıcı, ~birkaç davet/şifre sıfırlama maili/gün) Gmail SMTP yeterlidir; günlük relay limiti ~500 mail/gün. Ücretsiz, ek altyapı gerektirmez ve Gmail'in deliverability altyapısını kullanır.

**Sınırlar:** Gmail SMTP kişisel hesap için tasarlanmıştır; production scale (binlerce kullanıcı) için SendGrid/Mailgun/Postmark gibi profesyonel servislere taşınır. Gmail relay'de `From` adresi SMTP user ile aynı olmak zorundadır (relay zorunluluğu).

**Backend:** `aiosmtplib` (async SMTP istemcisi) Celery task içinden çağrılır. Mail gönderimi request akışını bekletmez.

## 2.7 Diğer Kütüphaneler

### 2.7.1 Backend Yardımcı Kütüphaneler

| Kütüphane | Versiyon | Amaç |
|---|---|---|
| `uvicorn` | 0.34+ | ASGI server (FastAPI çalıştırma) |
| `gunicorn` | 23.x | Production process manager |
| `python-jose` | 3.3.x | JWT token oluşturma/doğrulama |
| `passlib[bcrypt]` | 1.7.x | Şifre hash'leme |
| `python-multipart` | 0.0.20+ | Form data ve file upload parser |
| `alembic` | 1.14.x | DB migration |
| `pandas` | 2.2.x | CSV/XLSX parsing ve data manipulation |
| `openpyxl` | 3.1.x | XLSX okuma/yazma |
| `pyjwt` | 2.x | JWT alternatif kütüphane (gerekirse) |
| `slowapi` | 0.1.x | Rate limiting |
| `python-dotenv` | 1.1.x | .env dosyası yükleme |
| `httpx` | 0.28+ | HTTP client (test için) |
| `pytest` | 8.x | Test framework |
| `pytest-asyncio` | 0.24.x | Async test desteği |
| `pytest-cov` | 5.x | Coverage raporlama |
| `ruff` | 0.8+ | Lint ve formatting (Black + Flake8 + isort yerine) |

### 2.7.2 Frontend Yardımcı Kütüphaneler

| Kütüphane | Versiyon | Amaç |
|---|---|---|
| `react-router-dom` | 7.x | Sayfa yönlendirme |
| `axios` | 1.x | HTTP client |
| `dayjs` | 1.11.x | Tarih manipülasyonu (Moment.js'e hafif alternatif) |
| `react-apexcharts` | 1.7.x | ApexCharts React wrapper |
| `lucide-react` | 0.4+ | İkon kütüphanesi |
| `cmdk` | 1.x | Command palette (shadcn/ui için) |
| `sonner` | 1.x | Toast bildirimleri |
| `clsx` | 2.x | Conditional className helper |
| `tailwind-merge` | 3.x | Tailwind class çakışma çözücü |
| `vitest` | 3.x | Test framework |
| `@testing-library/react` | 16.x | Component test |
| `eslint` | 10.x | Lint |
| `prettier` | 3.x | Code formatter |
| `typescript` | 6.x | Type system |

## 2.8 Teknoloji Stack Özet Tablosu

Tüm seçimlerin tek sayfada görünür özeti:

| Kategori | Teknoloji | Sürüm | Tercih Sebebi |
|---|---|---|---|
| Frontend Framework | React | 19.x | En yaygın, component bazlı, geniş ekosistem |
| Build Tool | Vite | 8.x | Hızlı HMR, modern bundler |
| Styling | TailwindCSS | 4.x | Utility-first, yeni Oxide engine |
| Component Library | shadcn/ui | latest | Copy-paste, Radix UI tabanlı, a11y hazır |
| Charts | ApexCharts | 4.x | BI-tool kalitesinde grafik tipleri |
| Client State | Zustand | 5.x | Minimal API, ~1KB |
| Server State | TanStack Query | 5.x | Cache, refetch, optimistic updates |
| Forms | React Hook Form + Zod | 7.x / 3.x | Type-safe, performant |
| i18n | i18next + react-i18next | latest | TR/EN, JSON files |
| Backend Framework | FastAPI | 0.115+ | Async, auto-Swagger, type-safe |
| ORM | SQLAlchemy | 2.0+ | Async support, mature |
| Validation | Pydantic | 2.11+ | Rust-core, hızlı validation |
| Background Jobs | Celery | 5.4+ | Async tasks, retry, scheduling |
| Auth | JWT (python-jose) | 3.3.x | Stateless, scalable |
| Database | MySQL | 8.4 LTS | Yeni LTS, partition, computed columns |
| Cache | Redis | 7.4 | In-memory, microsecond performance |
| Web Server | Nginx | 1.27+ | High concurrency, low memory |
| SSL | Let's Encrypt | latest | Free, auto-renew |
| Container | Docker + Compose | 27+ / 2.30+ | Reproducible deployments |
| CI/CD | GitHub Actions | n/a | Native GitHub integration |
| Email | Gmail SMTP + aiosmtplib | n/a | Free relay, async send (Celery task) |
| Python | CPython | 3.12 | Stable, performant |
| Node.js | Node | 22 LTS | Frontend build (production'da gerek yok) |
| OS (Production) | Ubuntu | 24.04 LTS | Long-term support |

## 2.9 Sonraki Bölüm

Bu bölümde projenin teknoloji tabanı belirlendi. Sonraki bölümde, bu teknolojilerin **birbiriyle nasıl entegre olduğu** ve **sistemin genel mimarisi** detaylı olarak ele alınacaktır.

**Sonraki Bölüm:** [03 - Sistem Mimarisi](03-architecture.md)

*Bölüm 02 sonu.*
