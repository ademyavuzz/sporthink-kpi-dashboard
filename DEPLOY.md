# Deployment Rehberi

> Production: Ubuntu 24.04 LTS VDS, single-host Docker Compose deployment.
> Detay: `docs/overview/11`.

## Önkoşullar

- Ubuntu 24.04 LTS VDS (min 2 vCPU, 4 GB RAM + swap, 40 GB SSD — daha fazlası önerilir)
- Docker 27+ ve Docker Compose 2.30+
- 80 ve 443 portları açık
- (Faz 2 için) DNS A kaydı: `<domain>` → VDS IP

> **İki fazlı kurulum.** Domain henüz hazır değilse **Faz 1**'de servis IP üzerinden
> HTTP olarak yayına alınır (`http://<VDS-IP>`). Domain hazır olunca **Faz 2**'de
> Let's Encrypt ile HTTPS'e geçilir. Frontend same-origin (`/api/v1`) çalıştığı
> için domain değişimi **frontend rebuild gerektirmez**, sadece config + restart.

## Faz 1 — IP üzerinden HTTP yayını

```bash
# 1. Sistem güncelle + swap + Docker kur
sudo apt update && sudo apt upgrade -y
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && \
  sudo mkswap /swapfile && sudo swapon /swapfile && \
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Repo'yu klonla (public repo → HTTPS ile auth gerekmez)
sudo mkdir -p /opt/sporthink && sudo chown $USER /opt/sporthink
cd /opt/sporthink
git clone https://github.com/ademyavuzz/sporthink-kpi-dashboard.git .

# 3. Production env hazırla
cp .env.production.example .env
# Şu değerleri MUTLAKA doldur (`.env`):
#   MYSQL_ROOT_PASSWORD=<openssl rand -hex 32>
#   MYSQL_PASSWORD=<openssl rand -hex 32>
#   DATABASE_URL=mysql+aiomysql://sporthink:<MYSQL_PASSWORD>@mysql:3306/sporthink_dashboard
#   JWT_SECRET_KEY=<openssl rand -hex 32>
#   SUPER_ADMIN_PASSWORD=<min 10 char strong>
#   SMTP_USER / SMTP_PASSWORD / MAIL_FROM  (Gmail app password vb.)
#   FRONTEND_ORIGIN=http://<VDS-IP>          # Faz 2'de https://<domain> olur
#   GUNICORN_WORKERS=2                        # 4 GB RAM için; büyük sunucuda 4
#   NGINX_CONF=./nginx/app-http.conf          # Faz 1 default (HTTP)

# 4. Initial deployment (DB init + seed + start)
./scripts/deploy.sh --init

# 5. Doğrulama
curl http://<VDS-IP>/health
# {"status":"healthy","env":"production"}
```

> **Not (mevcut yayın):** Bu projede ilk yayın, yerel veritabanının birebir kopyası
> sunucuya restore edilerek yapılmıştır (boş seed yerine). Adımlar: `mysql`+`redis`
> başlat → `docker compose ... exec -T mysql mysql ... < dump.sql` ile restore →
> `python -m app.seed` (idempotent) → tüm stack `up`.

## Faz 2 — Domain + HTTPS (Let's Encrypt)

```bash
cd /opt/sporthink
# 1. DNS A kaydı <domain> → VDS-IP yapıldığından emin ol (Faz 1 nginx HTTP'de
#    ACME challenge'a hazır: /.well-known/acme-challenge/).
# 2. nginx/sporthink.conf içindeki server_name ve cert path'lerini <domain>'e göre ayarla.
# 3. Sertifikayı al:
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml \
  --profile letsencrypt run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d <domain> --email <admin-email> --agree-tos --no-eff-email
# 4. .env: NGINX_CONF=./nginx/sporthink.conf  ve  FRONTEND_ORIGIN=https://<domain>
# 5. HTTPS config'e geç:
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml up -d nginx backend
curl https://<domain>/health
```

## Güncel Deploy

```bash
ssh prod-vds
cd /opt/sporthink
./scripts/deploy.sh --update
```

Adımlar:
1. `git pull` — son kod
2. Frontend build (Vite production)
3. Backend image rebuild
4. Alembic migration (`alembic upgrade head`)
5. Compose up -d (rolling restart)
6. Health check
7. KPI cache temizliği

## Yedekleme

Otomatik günlük backup (`docker-compose.prod.yml`'de `backup` profili):

```bash
# Aktif et
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml \
  --profile backup up -d mysql_backup

# Manuel snapshot
docker compose exec mysql mysqldump -u root -p \
  --single-transaction --routines --triggers sporthink_dashboard | \
  gzip > /opt/sporthink/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz
```

Backup'lar `./backups/` altında, **14 günden eskiler otomatik silinir**.
Production'da bu klasör S3/B2 gibi off-site depolamaya rsync edilmeli.

## Geri Alma (Rollback)

Bozuk deploy sonrası:

```bash
# 1. Önceki image'a dön (eğer build önbelleği varsa)
docker tag sporthink-backend:previous sporthink-backend:latest
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml up -d

# 2. Migration geri alma (DİKKAT: data-destructive olabilir!)
docker compose exec backend alembic downgrade -1

# 3. DB tam restore (son backup'tan)
gunzip < backups/db_LATEST.sql.gz | \
  docker compose exec -T mysql mysql -u root -p sporthink_dashboard
```

## Monitoring

```bash
# Servis durumu
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml ps

# Loglar
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml logs -f --tail=100 backend
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml logs -f celery_worker

# DB slow query log
docker compose exec mysql tail -f /var/lib/mysql/slow.log

# Redis cache hit rate
docker compose exec redis redis-cli -n 0 INFO stats | grep keyspace
```

## SSL Renewal

Certbot container `letsencrypt` profili ile çalışırken otomatik renewal yapar
(her 12 saatte bir kontrol). Manuel test:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml \
  --profile letsencrypt run --rm certbot renew --dry-run
```

## Güvenlik Checklist

- [x] `.env` `.gitignore`'da
- [x] MYSQL ve Redis bind 127.0.0.1 (ports yerine expose)
- [x] HTTPS only (HTTP 301 redirect)
- [x] HSTS header (Strict-Transport-Security)
- [x] Rate limit (login 5/dk, genel 60/dk)
- [x] JWT secret min 64 karakter
- [x] Bcrypt cost 12
- [x] CORS frontend_origin'e kısıtlı
- [x] SQL injection koruması (parametreli sorgu)
- [x] X-Frame-Options SAMEORIGIN
- [x] Audit log her kritik action için

## Sorun Giderme

| Belirti | Çözüm |
|---|---|
| `Backend 500` | `docker compose logs backend` — DB bağlantısı veya migration hatası |
| `Cache miss her seferde` | `redis-cli -n 0 KEYS 'kpi:*' | wc -l` — boşsa cache invalidation çağrısı bug var |
| `Frontend 404` | `frontend/dist/` build edilmiş mi? `npm run build` |
| `SSL hatası` | `nginx/certs/live/.../fullchain.pem` mevcut mu? |
| `Slow KPI` | DB index check + cache TTL — `docs/overview/11` §11.7 |
