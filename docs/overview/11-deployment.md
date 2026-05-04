# 11. DEPLOYMENT VE DEVOPS

> **Bu Bölümde Neler Var?**
> Bu bölüm, Sporthink KPI Dashboard'un üretim ortamına nasıl kurulacağını ve operasyonel olarak nasıl yönetileceğini detaylı olarak ele almaktadır. VDS sunucu hazırlığı, Docker container yapısı, Nginx konfigürasyonu, SSL/TLS sertifikası, CI/CD pipeline, yedekleme, izleme ve sorun giderme prosedürleri belgelenmiştir.

## 11.1 Deployment Stratejisi

Sporthink KPI Dashboard, **iki ortamlı** bir deployment modeline sahiptir:

| Ortam | Amaç | URL | Sunucu |
|---|---|---|---|
| Development (Local) | Geliştirme | http://localhost:5173 | Geliştirici makinesi |
| Production | Canlı kullanım | https://dashboard.sporthink.com.tr | VDS Sunucu |

Staging ortamı MVP kapsamında bulunmamaktadır. CI/CD pipeline'ında automated test'ler ile production-ready kod garanti altına alınır.

## 11.2 VDS Sunucu Gereksinimleri

### 11.2.1 Donanım

Sporthink IT departmanından talep edilecek minimum sunucu özellikleri:

| Özellik | Minimum | Önerilen |
|---|---|---|
| CPU | 2 vCore | 4 vCore |
| RAM | 4 GB | 8 GB |
| Disk | 80 GB SSD | 160 GB SSD |
| Bant Genişliği | 1 TB / ay | 2 TB / ay |
| Network | 100 Mbps | 1 Gbps |

### 11.2.2 İşletim Sistemi

**Ubuntu Server 22.04 LTS** kullanılacaktır. Long-term support (LTS) sayesinde 2027 Nisan'a kadar güvenlik güncellemeleri ücretsiz alınır.

### 11.2.3 Domain ve DNS

Sporthink IT departmanından `dashboard.sporthink.com.tr` subdomain'i talep edilir. DNS A record VDS sunucu IP'sine yönlendirilir:

```
dashboard.sporthink.com.tr.    A    188.x.x.x
```

DNS yayılması 1-24 saat sürebilir.

## 11.3 IT Talep Formu (Sample)

Sporthink IT departmanından yapılacak talepler aşağıdaki formdadır:

```
KONU: Sporthink KPI Dashboard - Sunucu ve Domain Talebi

Kurum İçi Talep Sahibi: Adem Yavuz (DEU YBS Stajyer)
Proje Sponsoru: Mert Gülseren / Emre Yavşan
Talep Tarihi: ___________

1. SUNUCU GEREKSİNİMLERİ
   - Tip: VDS (Virtual Dedicated Server)
   - OS: Ubuntu Server 22.04 LTS
   - CPU: Minimum 4 vCore
   - RAM: Minimum 8 GB
   - Disk: 160 GB SSD
   - Bant Genişliği: 2 TB / ay

2. DOMAIN GEREKSİNİMLERİ
   - Subdomain: dashboard.sporthink.com.tr
   - DNS A Record yönlendirmesi: VDS IP'sine

3. NETWORK GEREKSİNİMLERİ
   - Açılacak portlar: 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - SSH erişimi için VPN ya da IP whitelist

4. EK TALEPLER
   - SSL/TLS sertifikası: Let's Encrypt ile otomatik (ek talep yok)
   - SMTP servisi: Gmail SMTP relay (App Password ile) — bitirme ölçeğinde yeterli
   - Email: dashboard@sporthink.com.tr (sender address) - opsiyonel; Gmail relay'de From=SMTP user zorunlu

Tahmini Kullanıma Açılma: 25 Mayıs 2026
```

## 11.4 Sunucu Hazırlık Adımları

### 11.4.1 İlk Bağlantı

```bash
# Root ile bağlan (ilk kez)
ssh root@VDS_IP

# deploy adında yeni kullanıcı oluştur
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Public key kopyala
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys  # Public key yapıştır
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 11.4.2 SSH Sıkılaştırma

`/etc/ssh/sshd_config` düzenleme:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22
ClientAliveInterval 300
MaxAuthTries 3
```

```bash
sudo systemctl restart sshd
```

### 11.4.3 Firewall (UFW) Kurulumu

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

### 11.4.4 Sistem Güncellemeleri

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban htop nano
```

### 11.4.5 Fail2Ban Kurulumu

SSH brute force koruması için Fail2Ban yüklenir.

```bash
sudo apt install fail2ban -y

# /etc/fail2ban/jail.local
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600

sudo systemctl restart fail2ban
```

### 11.4.6 Docker ve Docker Compose Kurulumu

```bash
# Docker resmi yükleme scripti
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose plugin (V2)
sudo apt install docker-compose-plugin -y

# Docker servisini başlat
sudo systemctl enable docker
sudo systemctl start docker

# deploy kullanıcısını docker grubuna ekle
sudo usermod -aG docker deploy
# Çıkış yap, tekrar giriş yap (grup üyeliği refresh için)

# Test
docker --version
docker compose version
```

## 11.5 Proje Dosya Yapısı (Sunucu)

```
/var/www/sporthink/
├── docker-compose.yml
├── .env
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   └── ... (kod dosyaları)
├── frontend/
│   └── dist/  (build çıktıları)
└── mysql/
    └── my.cnf

/var/sporthink/
├── uploads/
│   ├── 2026/
│   └── ...
├── logs/
│   ├── api/
│   └── error/
└── backups/
    ├── 2026-04-15.sql.gz
    └── ...

/etc/letsencrypt/
└── live/dashboard.sporthink.com.tr/
    ├── fullchain.pem
    └── privkey.pem
```

## 11.6 Docker Compose Konfigürasyonu

`/var/www/sporthink/docker-compose.yml`:

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: sporthink_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - sporthink_network

  backend:
    image: sporthink/backend:latest
    container_name: sporthink_backend
    expose:
      - "8000"
    env_file: .env
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - /var/sporthink/uploads:/app/uploads
      - /var/sporthink/logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - sporthink_network

  celery_worker:
    image: sporthink/backend:latest
    container_name: sporthink_celery
    command: celery -A app.celery_app worker --loglevel=info --concurrency=4
    env_file: .env
    depends_on:
      - redis
      - mysql
    volumes:
      - /var/sporthink/uploads:/app/uploads
      - /var/sporthink/logs:/app/logs
    restart: unless-stopped
    networks:
      - sporthink_network

  celery_beat:
    image: sporthink/backend:latest
    container_name: sporthink_celery_beat
    command: celery -A app.celery_app beat --loglevel=info
    env_file: .env
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - sporthink_network

  mysql:
    image: mysql:8.4
    container_name: sporthink_mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/my.cnf:/etc/mysql/conf.d/my.cnf:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - sporthink_network

  redis:
    image: redis:7.4-alpine
    container_name: sporthink_redis
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - sporthink_network

volumes:
  mysql_data:
  redis_data:

networks:
  sporthink_network:
    driver: bridge
```

## 11.7 Environment Variables (.env)

`/var/www/sporthink/.env` dosyası (asla git'e commit edilmez):

```bash
# Application
APP_ENV=production
APP_DEBUG=false
APP_URL=https://dashboard.sporthink.com.tr

# Database
MYSQL_ROOT_PASSWORD=<güçlü-rastgele-şifre>
MYSQL_DATABASE=sporthink_dashboard
MYSQL_USER=sporthink_user
MYSQL_PASSWORD=<güçlü-rastgele-şifre>
DATABASE_URL=mysql+aiomysql://sporthink_user:şifre@mysql:3306/sporthink_dashboard

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# JWT
JWT_SECRET_KEY=<en-az-64-karakter-rastgele-string>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Super Admin (ilk seed)
SUPER_ADMIN_EMAIL=admin@sporthink.com.tr
SUPER_ADMIN_PASSWORD=<güçlü-rastgele-şifre>

# Email (Gmail SMTP / aiosmtplib)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail-adresi>
SMTP_PASSWORD=<gmail-app-password>
SMTP_USE_TLS=true
MAIL_FROM=<gmail-adresi>     # Gmail relay'de SMTP_USER ile aynı olmak zorunda
MAIL_FROM_NAME=Sporthink Dashboard
INVITE_TOKEN_EXPIRE_HOURS=168
RESET_TOKEN_EXPIRE_MINUTES=60

# Upload Settings
MAX_UPLOAD_SIZE_MB=50
UPLOAD_PATH=/app/uploads
UPLOAD_RETENTION_DAYS=90

# CORS
CORS_ORIGINS=https://dashboard.sporthink.com.tr

# Rate Limiting
RATE_LIMIT_LOGIN=10/minute
RATE_LIMIT_API=100/minute

# Logging
LOG_LEVEL=INFO
LOG_PATH=/app/logs
```

`.env.example` dosyası repository'de bulunur (gerçek değerler olmadan), `.env` `.gitignore`'dadır.

## 11.8 Nginx Konfigürasyonu

`/var/www/sporthink/nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Upload size
    client_max_body_size 60M;
    client_body_buffer_size 128k;
    client_body_timeout 120s;

    # Gzip
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml application/atom+xml image/svg+xml;

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name dashboard.sporthink.com.tr;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Main Server
    server {
        listen 443 ssl http2;
        server_name dashboard.sporthink.com.tr;

        # SSL Certificates
        ssl_certificate /etc/letsencrypt/live/dashboard.sporthink.com.tr/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/dashboard.sporthink.com.tr/privkey.pem;

        # SSL Configuration (Modern)
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;" always;

        # Frontend (React Static Files)
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;

            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";

            # Timeouts (büyük import için artırıldı)
            proxy_connect_timeout 30s;
            proxy_send_timeout 600s;
            proxy_read_timeout 600s;

            # Buffer ayarları
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 16 4k;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "OK\n";
        }
    }
}
```

## 11.9 SSL/TLS Sertifikası (Let's Encrypt)

### 11.9.1 Certbot Kurulumu

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 11.9.2 İlk Sertifika Alma

Docker container'lar henüz çalışmıyorsa, host nginx ile geçici olarak alınır. Veya standalone modda:

```bash
sudo certbot certonly --standalone -d dashboard.sporthink.com.tr \
  --email admin@sporthink.com.tr --agree-tos --non-interactive
```

Sertifikalar `/etc/letsencrypt/live/dashboard.sporthink.com.tr/` altına kaydedilir.

### 11.9.3 Otomatik Yenileme

Certbot kendi cron job'unu kurar. Sertifikalar 90 günde bir otomatik yenilenir.

```bash
# Test
sudo certbot renew --dry-run

# Cron'u kontrol et
sudo systemctl list-timers | grep certbot
```

Yenileme başarılı olduktan sonra Nginx container'ın reload olması gerekir:

```bash
# /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh
#!/bin/bash
docker compose -f /var/www/sporthink/docker-compose.yml exec nginx nginx -s reload
```

```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh
```

## 11.10 İlk Deployment

### 11.10.1 Git Clone

```bash
cd /var/www
sudo mkdir sporthink && sudo chown deploy:deploy sporthink
cd sporthink
git clone https://github.com/[username]/sporthink-dashboard.git .
```

### 11.10.2 .env Dosyası Oluşturma

```bash
cp .env.example .env
nano .env  # Değerleri doldur
```

### 11.10.3 Frontend Build

Frontend build local'de yapılır, dist klasörü sunucuya kopyalanır:

```bash
# Local
cd frontend
npm install
npm run build

# Build çıktıları sunucuya kopyala
scp -r dist/* deploy@VDS_IP:/var/www/sporthink/frontend/dist/
```

CI/CD pipeline'ı bu adımı otomatize eder.

### 11.10.4 Docker Image Build

```bash
cd /var/www/sporthink
docker compose build
```

### 11.10.5 Veritabanı Migration

```bash
# Container'ları başlat (sadece DB)
docker compose up -d mysql redis

# DB'nin hazır olmasını bekle (10-20 saniye)
docker compose logs -f mysql

# Migration çalıştır
docker compose run --rm backend alembic upgrade head

# İlk seed (Süper Admin, permissions, channel mappings)
docker compose run --rm backend python -m app.scripts.seed
```

### 11.10.6 Tüm Servisleri Başlat

```bash
docker compose up -d

# Status kontrol
docker compose ps

# Logları izle
docker compose logs -f backend
```

### 11.10.7 İlk Test

Browser'da `https://dashboard.sporthink.com.tr` açılır. Login sayfası görünmelidir. `.env`'deki Süper Admin email/şifre ile giriş yapılır.

## 11.11 CI/CD Pipeline (GitHub Actions)

### 11.11.1 Pipeline Yapısı

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Backend tests
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install backend deps
        run: |
          cd backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run backend lint
        run: |
          cd backend
          ruff check .

      - name: Run backend tests
        run: |
          cd backend
          pytest --cov=app --cov-report=xml

      # Frontend tests
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install frontend deps
        run: |
          cd frontend
          npm ci

      - name: Run frontend lint
        run: |
          cd frontend
          npm run lint

      - name: Run frontend tests
        run: |
          cd frontend
          npm run test

      - name: Build frontend
        run: |
          cd frontend
          npm run build

      - name: Upload frontend build
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}

      - name: Add server to known hosts
        run: ssh-keyscan -H ${{ secrets.DEPLOY_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy to server
        run: |
          # Frontend dosyalarını kopyala
          rsync -avz --delete frontend/dist/ deploy@${{ secrets.DEPLOY_HOST }}:/var/www/sporthink/frontend/dist/

          # Sunucuda backend imajını yeniden build et ve restart et
          ssh deploy@${{ secrets.DEPLOY_HOST }} << 'EOF'
            cd /var/www/sporthink
            git pull origin main
            docker compose build backend celery_worker celery_beat
            docker compose run --rm backend alembic upgrade head
            docker compose up -d
            docker compose ps
          EOF

      - name: Health check
        run: |
          sleep 10
          curl -f https://dashboard.sporthink.com.tr/api/v1/health || exit 1

      - name: Notify on failure
        if: failure()
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
          SLACK_MESSAGE: 'Production deployment FAILED'
```

### 11.11.2 GitHub Secrets

Repository Settings → Secrets'a aşağıdaki değerler eklenir:

- `DEPLOY_SSH_KEY`: deploy@VDS için private SSH key
- `DEPLOY_HOST`: VDS sunucu IP adresi
- `SLACK_WEBHOOK`: (opsiyonel) Slack bildirim webhook URL'i

## 11.12 Yedekleme (Backup)

### 11.12.1 MySQL Yedek Stratejisi

Her gece saat 02:00'da otomatik MySQL dump alınır.

`/usr/local/bin/sporthink-backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/sporthink/backups"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# MySQL dump
docker exec sporthink_mysql mysqldump \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  sporthink_dashboard | gzip > "$BACKUP_DIR/sporthink_$DATE.sql.gz"

# Eski yedekleri sil (7 günden eski)
find $BACKUP_DIR -name "sporthink_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: sporthink_$DATE.sql.gz"
```

```bash
chmod +x /usr/local/bin/sporthink-backup.sh

# Cron job
sudo crontab -e
# Her gece 02:00'da
0 2 * * * /usr/local/bin/sporthink-backup.sh >> /var/log/sporthink-backup.log 2>&1
```

### 11.12.2 Restore Prosedürü

```bash
# Yedeği aç
gunzip -c /var/sporthink/backups/sporthink_2026-04-15.sql.gz > /tmp/restore.sql

# DB'ye geri yükle
docker exec -i sporthink_mysql mysql \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  sporthink_dashboard < /tmp/restore.sql
```

### 11.12.3 Off-site Backup (Future)

İleride yedekler S3 veya başka bir cloud storage'a otomatik kopyalanabilir. MVP'de sadece local backup yapılır.

## 11.13 İzleme (Monitoring) - MVP

MVP kapsamında detaylı monitoring (Prometheus, Grafana) yer almaz. Basit log izleme ve uptime check uygulanır.

### 11.13.1 Container Status İzleme

```bash
# Container'ların durumunu kontrol et
docker compose ps

# Kaynak kullanımı
docker stats
```

### 11.13.2 Log İzleme

```bash
# Tüm servislerin loglarını izle
docker compose logs -f

# Sadece backend
docker compose logs -f backend

# Son 100 satır
docker compose logs --tail=100 backend

# Hata içerenler
docker compose logs backend | grep ERROR
```

### 11.13.3 Disk Kullanımı

```bash
# Genel disk kullanımı
df -h

# Sporthink dizini
du -sh /var/sporthink/*
du -sh /var/www/sporthink/*

# Docker volume'ları
docker system df
```

### 11.13.4 Health Check Endpoint

```bash
# Otomatik kontrol için
curl -f https://dashboard.sporthink.com.tr/api/v1/health || echo "DOWN"
```

### 11.13.5 Uptime Kuma (Önerilen, Basit Monitoring)

İleride basit bir uptime monitoring için Uptime Kuma kurulabilir. Self-hosted, açık kaynak, hızlı kurulum.

## 11.14 Güncellemeler

### 11.14.1 Yeni Versiyon Deployment

Geliştirici yeni feature'ı `main` branch'e merge eder. GitHub Actions otomatik deploy yapar.

Manuel deployment gerekirse:

```bash
ssh deploy@VDS_IP
cd /var/www/sporthink
git pull origin main
docker compose build
docker compose run --rm backend alembic upgrade head
docker compose up -d
docker compose ps
```

### 11.14.2 Migration Yönetimi

Database schema değişiklikleri Alembic ile yönetilir.

```bash
# Yeni migration oluştur (development'ta)
docker compose run --rm backend alembic revision --autogenerate -m "add user_preferences table"

# Migration'ı uygula (production'da)
docker compose run --rm backend alembic upgrade head

# Bir önceki migration'a geri dön
docker compose run --rm backend alembic downgrade -1
```

### 11.14.3 Rollback Stratejisi

Hatalı bir deployment durumunda:

```bash
# Önceki commit'e geri dön
git log --oneline -5
git checkout <previous_commit_hash>

# Image'ları yeniden build
docker compose build
docker compose up -d
```

Database migration rollback için:

```bash
docker compose run --rm backend alembic downgrade -1
```

## 11.15 Sorun Giderme (Troubleshooting)

### 11.15.1 Container Başlatılamıyor

```bash
# Container loglarını incele
docker compose logs backend

# Container'a gir
docker compose exec backend bash

# Image'ı yeniden build et
docker compose build --no-cache backend
docker compose up -d backend
```

### 11.15.2 DB Bağlantı Sorunu

```bash
# MySQL container'ın çalıştığını doğrula
docker compose ps mysql

# MySQL'e bağlan
docker compose exec mysql mysql -u root -p

# Backend'in DB'ye erişebildiğini test et
docker compose exec backend python -c "
from sqlalchemy import create_engine
e = create_engine('mysql+pymysql://...')
print(e.connect())
"
```

### 11.15.3 SSL Sertifika Sorunu

```bash
# Sertifika geçerlilik kontrolü
echo | openssl s_client -servername dashboard.sporthink.com.tr -connect dashboard.sporthink.com.tr:443 2>/dev/null | openssl x509 -noout -dates

# Manuel yenileme
sudo certbot renew --force-renewal

# Nginx reload
docker compose exec nginx nginx -s reload
```

### 11.15.4 Disk Doldu

```bash
# Eski Docker image'ları temizle
docker system prune -a --volumes

# Eski log'ları temizle
sudo find /var/sporthink/logs -name "*.log" -mtime +30 -delete

# Eski upload'ları manuel temizle (90 gün cron çalışmıyorsa)
sudo find /var/sporthink/uploads -mtime +90 -delete
```

### 11.15.5 Performance Sorunu

```bash
# CPU/RAM kullanımı
htop

# Docker container kaynak kullanımı
docker stats

# MySQL slow query log incele
docker compose exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"
```

## 11.16 Güvenlik Kontrol Listesi

Deployment sonrası mutlaka doğrulanacak güvenlik öğeleri:

- [ ] SSH password authentication kapalı
- [ ] Root SSH login yasak
- [ ] UFW firewall aktif (sadece 22, 80, 443 açık)
- [ ] Fail2Ban çalışıyor
- [ ] HTTPS zorla (HTTP → HTTPS redirect aktif)
- [ ] SSL Labs testi A+ sonuç veriyor (https://www.ssllabs.com/ssltest/)
- [ ] Security headers test https://securityheaders.com'dan A sonuç
- [ ] `.env` dosyası git'e commit edilmedi
- [ ] Süper Admin şifresi default değil
- [ ] MySQL root şifresi güçlü
- [ ] JWT_SECRET_KEY 64+ karakter rastgele
- [ ] Backup script çalışıyor (cron)
- [ ] Container'lar `restart: unless-stopped` ile yapılandırılmış
- [ ] Tüm health check'ler "ok" dönüyor

## 11.17 Sonraki Bölüm

Bu bölümde sistemin deployment ve operasyonel detayları ele alındı. Sonraki bölümde, kalite güvencesi için test stratejisi detaylandırılacaktır.

**Sonraki Bölüm:** [12 - Test Stratejisi](12-testing.md)

*Bölüm 11 sonu.*
