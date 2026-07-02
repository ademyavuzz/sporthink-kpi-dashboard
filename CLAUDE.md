# CLAUDE.md — Sporthink KPI Dashboard (Kök)

> Bu dosya Claude Code tarafından her oturumun başında otomatik okunur.
> **Burada yazan kurallar proje çapındadır ve istisnasız uygulanır.**
> Stack-spesifik kurallar için `backend/CLAUDE.md` ve `frontend/CLAUDE.md` dosyalarına bak.

---

## 1. Proje Kimliği

**Sporthink Pazarlama ve E-Ticaret KPI Dashboard** — sporthink.com.tr için B2B internal SaaS. Pazarlama (GA4, Meta Ads, Google Ads) ve e-ticaret verilerini tek noktada toplayıp 31 KPI üzerinden görselleştirir. Tek geliştirici (Adem Yavuz), Dokuz Eylül Üniversitesi YBS bitirme projesi. Production: Ubuntu 24.04 LTS VDS üzerinde canlı (deploy akışı: `DEPLOY.md`), ~50 eşzamanlı kullanıcı, 1+ yıllık veri.

---

## 2. Monorepo Haritası

```
sporthink-kpi-dashboard/
├── CLAUDE.md               ← BU DOSYA. Proje çapı kurallar.
├── README.md               ← Tanıtım, kurulum, lisans.
├── DEPLOY.md               ← Production VDS kurulum ve güncelleme rehberi.
├── USER_GUIDE.md           ← Son kullanıcı kılavuzu.
├── LICENSE                 ← Proprietary lisans (Sporthink iç kullanım).
├── docs/
│   ├── overview/           ← 16 markdown dokümantasyon (00-15).
│   └── screenshots/        ← Uygulama ekran görüntüleri (README galerisi).
├── .github/workflows/      ← CI: backend ruff + frontend lint/tsc/vitest.
├── backend/                ← FastAPI + Celery + MySQL. Kendi CLAUDE.md'si var.
├── frontend/               ← React 19 + Vite + TS. Kendi CLAUDE.md'si var.
├── nginx/                  ← Reverse proxy config (production).
├── mysql/                  ← my.cnf (production DB tuning).
├── scripts/                ← deploy.sh + API smoke/CRUD check scriptleri.
├── docker-compose.dev.yml  ← Geliştirme stack'i (hot reload). Temel dosya.
├── docker-compose.prod.yml ← Production override (dev.yml ile birlikte kullanılır).
├── docker-compose.demo.yml ← Demo ortamı.
├── .env.example            ← Tüm env değişkenlerinin TAM listesi.
└── .env.production.example ← Production env şablonu.
```

**Üç klasör asla karışmaz:** `docs/` salt referans, `backend/` ve `frontend/` arasında kod paylaşımı YOK. Ortak şey gerekiyorsa OpenAPI üzerinden contract paylaşılır, kod kopyalanmaz.

---

## 3. Tech Stack Özeti

Tek doğru kaynak: `docs/overview/02-tech-stack.md`. Aşağıdaki liste hızlı referans amaçlıdır; **versiyon çelişirse doküman doğrudur**.

- **Backend:** Python 3.12 · FastAPI 0.115+ · SQLAlchemy 2.0 (async) · Pydantic 2.11+ · Celery 5.4+ · Alembic · Ruff
- **Frontend:** React 19 · Vite 6 · TypeScript 5.7 · TailwindCSS 4 · shadcn/ui · ApexCharts · Zustand 5 · TanStack Query 5 · React Hook Form + Zod · i18next
- **Veri:** MySQL 8.4 LTS · Redis 7.4 (cache + Celery broker)
- **Altyapı:** Docker 27+ · Docker Compose 2.30+ · Nginx 1.27+ · Let's Encrypt · GitHub Actions · SendGrid SMTP

---

## 4. Proje Çapı Değişmezleri (INVARIANTS)

Bu kurallar her katmanda, her dosyada, her PR'da geçerlidir. **İstisna yok.**

### 4.1 Para Birimi
- Tek para birimi: **TRY**.
- Veritabanında `DECIMAL(15, 2)`. Kuruş ayrı kolon YOK, ondalık olarak tutulur.
- Float **asla** kullanılmaz (yuvarlama hatası).
- Frontend'de `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`.

### 4.2 Zaman ve Tarih
- Veritabanında **her zaman UTC** (`TIMESTAMP` kolonları).
- Backend kodu UTC çalışır, dönüşüm yapmaz.
- Sadece frontend kullanıcıya gösterirken **Europe/Istanbul**'a çevirir (`dayjs.tz`).
- Tarih format:
  - API request/response → ISO 8601 (`2026-05-03T14:30:00Z`)
  - TR UI → `dd.MM.yyyy` ve `dd.MM.yyyy HH:mm`
  - EN UI → `MM/dd/yyyy` ve `MM/dd/yyyy HH:mm`
- Yeni `Date()` ile string parse YASAK. `dayjs(string, format)` kullan.

### 4.3 Dil ve Lokalizasyon
- Default dil: **TR**, ikinci dil: **EN**.
- Hiçbir kullanıcıya görünür string kodda hardcode edilmez. Hepsi i18n key.
- Yeni key eklenirken TR ve EN aynı PR'da eklenir (otomatik CI kontrolü yok; review sırasında doğrulanır).
- Backend hata mesajları: `code` (sabit) + `message` (default İngilizce). Frontend `code`'a göre yerelleştirir.

### 4.4 Sayı ve Yüzde
- Yüzde değişimler `DECIMAL(8, 2)` (örn: `12.45` = %12.45).
- Büyük sayılar UI'da `Intl.NumberFormat('tr-TR')` ile binlik ayraçlı (`1.234.567`).
- KPI değerlerinde NULL anlamlıdır ("veri yok"); 0'a düşürülmez.

### 4.5 Versiyonlama
- Semantic Versioning (MAJOR.MINOR.PATCH).
- API path'leri `/api/v1/...` ile versiyonlu. Breaking change `/v2/` açar, `v1` 6 ay paralel kalır.

---

## 5. Proje Çapı Mutlak Yasaklar

| # | Yasak | Sebep |
|---|---|---|
| 1 | `docs/`'taki rakamları, formülleri veya isimleri kodda paralel olarak tanımlamak | Tek doğru kaynak `docs/`. Sapmalar hata üretir. |
| 2 | KPI formülünü `backend/app/services/kpi_service.py` dışında tanımlamak | Frontend KPI hesaplayamaz, sadece gösterir. |
| 3 | 41 (kategori 1+2+3+4) izin string'ini herhangi bir yerde plain string olarak yazmak | İzinler tek noktada (`backend/app/core/permissions.py`) enum olarak tanımlı. |
| 4 | Migration'ı elle yazmak veya elle SQL ile DB değiştirmek | Sadece `alembic revision --autogenerate` + review + `alembic upgrade head`. |
| 5 | `.env` dosyasını commit etmek | `.gitignore`'da. Yeni env değişkeni eklendiğinde `.env.example` da güncellenir. |
| 6 | Şifre, JWT secret, refresh token, SMTP key, kişisel veri log'a yazmak | KVKK ihlali + güvenlik riski. |
| 7 | `console.log`, `print`, `pprint` production code'a kalmak | Logging her zaman `logging.getLogger(__name__)` (backend) veya susturulmuş (frontend). |
| 8 | Yeni veri kaynağını (GA4/Meta/Google Ads/E-ticaret dışı) `docs/`'a eklemeden kodda implement etmek | Scope creep. Önce doküman, sonra kod. |
| 9 | Test yazmadan endpoint veya KPI eklemek | "Done" tanımının parçası — bkz §7. |
| 10 | İngilizce/Türkçe karışık commit mesajı veya değişken adı | Kod identifier'ları **English**, dokümantasyon ve UI string'leri **Türkçe** (i18n key altında). |

---

## 6. Dokümantasyon Haritası — Görev → Hangi Dokümana Bak

Bir görev geldiğinde **önce** ilgili `docs/` dosyasını oku.

> **Not (Temmuz 2026):** Proje dokümanların yazıldığı tarihten sonra epey evrildi;
> kod dokümanların önünde olabilir. Doküman ile kod çelişirse **mevcut kod davranışı
> esas alınır** ve doküman koda göre güncellenir. Dokümanlar hâlâ kavramsal referans
> (formüller, veri modeli, mimari gerekçeler) için birincil kaynaktır.

| Görev | Önce Oku | Sonra Bak |
|---|---|---|
| Yeni KPI ekle | `docs/overview/09-kpi-formulas.md` | `backend/CLAUDE.md` §11 |
| Yeni endpoint ekle | `docs/overview/06-api-spec.md` | `backend/CLAUDE.md` §3, §6 |
| Yeni izin / rol | `docs/overview/05-rbac-security.md` §5.5 | `backend/CLAUDE.md` §5 |
| Yeni sayfa / UI | `docs/overview/07-frontend-design.md` | `frontend/CLAUDE.md` §3, §9 |
| Yeni veri kaynağı / import | `docs/overview/08-import-system.md` | `backend/CLAUDE.md` §10 |
| Yeni filtre / segment | `docs/overview/10-filtering-segments.md` | `backend/CLAUDE.md` §3 |
| Yeni tablo / migration | `docs/overview/04-data-model.md` | `backend/CLAUDE.md` §7 |
| Deployment / env değişikliği | `docs/overview/11-deployment.md` | `.env.example` ve docker compose |
| Test stratejisi | `docs/overview/12-testing.md` | `backend/CLAUDE.md` §16, `frontend/CLAUDE.md` §14 |
| Mimari karar | `docs/overview/03-architecture.md` | — |

**Kural:** Doküman güncellemesi gerektiren bir değişiklik yapıyorsan, kod ve doküman değişikliği **aynı PR'da** gider. Ayrı PR yok.

---

## 7. Geliştirme Workflow'u

### 7.1 Branch İsimlendirme
- `feature/<scope>-<short-desc>` — yeni özellik (örn: `feature/kpi-funnel-conversion`)
- `fix/<scope>-<short-desc>` — bug fix
- `chore/<short-desc>` — bağımlılık güncellemesi, doc, config
- `refactor/<scope>-<short-desc>` — davranış değişmeyen yeniden yapılandırma

### 7.2 Commit Mesaj Formatı (Conventional Commits)
```
<type>(<scope>): <kısa açıklama, küçük harfle, nokta yok>

[opsiyonel gövde]

[opsiyonel footer: BREAKING CHANGE, Closes #X]
```
- `type`: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`
- `scope`: `backend`, `frontend`, `import`, `kpi`, `auth`, `rbac`, `infra`
- Örnek: `feat(kpi): add cart abandonment rate calculation`

### 7.3 "Done" Tanımı
Bir feature/fix aşağıdakiler tamamlanmadan **merge edilemez**:

- [ ] Kod yazıldı, lokalde çalışıyor
- [ ] İlgili `docs/`'taki kurallara uyuyor
- [ ] Backend ise: en az 1 happy path + 1 unauthorized + 1 validation testi
- [ ] Frontend ise: kritik user flow için 1 integration testi (Vitest + RTL)
- [ ] i18n: yeni key'lerin TR ve EN karşılığı eklendi
- [ ] DB değişikliği var ise: alembic migration üretildi ve test edildi
- [ ] Yeni env değişkeni var ise: `.env.example` güncellendi
- [ ] Yeni endpoint var ise: OpenAPI/Swagger otomatik schema doğru
- [ ] `ruff check` ve `ruff format` (backend) temiz
- [ ] `eslint` ve `tsc --noEmit` (frontend) temiz
- [ ] Doküman güncellemesi gerekiyorsa aynı PR içinde

---

## 8. Sık Kullanılan Komutlar

```bash
# Kısaltma: dev stack her zaman -f docker-compose.dev.yml ile çalışır
alias dc="docker compose -f docker-compose.dev.yml"

# Tüm stack'i ayağa kaldır (dev)
dc up -d
dc logs -f backend frontend
dc down

# Backend sadece
dc up -d backend mysql redis

# Migration
dc exec backend alembic revision --autogenerate -m "açıklama"
dc exec backend alembic upgrade head
dc exec backend alembic downgrade -1

# Seed (Süper Admin + izin senkronu, idempotent)
dc exec backend python -m app.seed

# Test
dc exec backend pytest
dc exec backend pytest -m unit
dc exec backend pytest --cov=app --cov-report=term-missing

# Lint / Format
dc exec backend ruff check .
dc exec backend ruff format .
dc exec frontend npm run lint
dc exec frontend npx tsc --noEmit
dc exec frontend npx vitest run

# API smoke / CRUD kontrol scriptleri (çalışan stack'e karşı)
python3 scripts/api_smoke_check.py
python3 scripts/api_crud_check.py
```

> **Yeni komut eklenirse:** Hem buraya hem `Makefile`'a (varsa) eklenir. Tek noktadan keşfedilebilir olmalı.

---

## 9. Çevre Bilgisi

- **Production:** Ubuntu 24.04 LTS VDS, single-host Docker Compose deployment.
- **Development:** macOS / Linux / Windows (WSL2). Sadece Docker Compose gerekli.
- **Tüm env değişkenleri:** `.env.example` içinde TAM olarak listelenir. Yeni env eklediğinde örnek değer ve açıklama yorumla yaz.
- **Hassas env'ler** (production): `MYSQL_ROOT_PASSWORD`, `JWT_SECRET_KEY`, `SUPER_ADMIN_PASSWORD`, `SENDGRID_API_KEY`. Asla repo'ya girmez.

---

## 10. Hangi Alt CLAUDE.md Ne Zaman Okunur?

Claude Code, çalışılan dosyanın bulunduğu klasördeki CLAUDE.md'yi otomatik yükler. Manuel olarak da yüklenebilir.

- `backend/` altında bir dosyaya dokunduğunda → **`backend/CLAUDE.md` otomatik aktif**.
- `frontend/` altında bir dosyaya dokunduğunda → **`frontend/CLAUDE.md` otomatik aktif**.
- Iki tarafı birden değiştiren iş varsa (örn: yeni endpoint + sayfa) → **ikisi de manuel olarak referans al**.
- `docker-compose.*.yml`, `nginx/`, `scripts/`, `.github/workflows/` → kök CLAUDE.md (bu dosya) yeterli.

---

## 11. Acil Durum / Geri Alma

Production deployment sonrası bir şey kırıldıysa (deploy `scripts/deploy.sh` ile
git-pull tabanlıdır, detay: `DEPLOY.md`):

```bash
# 1. Son bilinen iyi commit'e dön ve yeniden deploy et
ssh prod-vds "cd /opt/sporthink && git log --oneline -5"   # kırılan commit'i bul
ssh prod-vds "cd /opt/sporthink && git revert <bad-sha> --no-edit && ./scripts/deploy.sh --update"
# (revert push edilemiyorsa: git reset --hard <good-sha> + deploy.sh --update)

# 2. DB migration geri alınması gerekiyorsa
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml \
  exec backend alembic downgrade -1
```

**Migration geri almadan önce:** veri kaybına yol açacak migration ise `BACKUP` al. `alembic downgrade` data-destructive olabilir.

---

## 12. AI Geliştirme Notu

Bu proje **Claude Code ile agent-driven** geliştirilmektedir. Bu, aşağıdaki sorumluluk dengesini ifade eder:

- **Agent yapar:** Kod yazımı, test yazımı, refactor, doküman güncellemesi, migration üretimi, lint hatası çözümü.
- **İnsan yapar:** Mimari karar, doküman onayı, production deploy onayı, code review, scope kararı, env secret yönetimi.

Agent kendi başına şunları **yapmamalıdır**:
- `docs/`'a yeni bölüm eklemek (mevcut bölümleri güncellemek OK)
- Yeni dependency eklemek (mevcutu güncellemek OK; major version bump için onay)
- `.env`'e yeni secret eklemek (placeholder + `.env.example` güncellemesi OK)
- Production'a deploy etmek (CI/CD üzerinden manuel trigger insan onaylı)

---

*Son güncelleme: Temmuz 2026 · v1.1 (repo gerçek durumuyla senkronlandı)*
