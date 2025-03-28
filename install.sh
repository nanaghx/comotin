#!/bin/bash

# Fungsi untuk menampilkan pesan
print_message() {
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

# Cek apakah script dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then 
    print_message "Script harus dijalankan sebagai root (gunakan sudo)"
    exit 1
fi

# Input domain
read -p "Masukkan domain Anda (contoh: api.example.com): " DOMAIN

# Update sistem
print_message "Memperbarui sistem..."
apt update && apt upgrade -y

# Install dependencies
print_message "Menginstall dependencies..."
apt install -y curl git build-essential nginx

# Install Node.js
print_message "Menginstall Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2
print_message "Menginstall PM2..."
npm install -g pm2

# Install FFmpeg
print_message "Menginstall FFmpeg..."
apt install -y ffmpeg

# Install yt-dlp
print_message "Menginstall yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Install Chromium dan dependencies untuk Puppeteer
print_message "Menginstall Chromium dan dependencies untuk Puppeteer..."
apt install -y chromium-browser
apt install -y libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6

# Buat direktori aplikasi
print_message "Menyiapkan direktori aplikasi..."
mkdir -p /var/www/$DOMAIN
cd /var/www/$DOMAIN

# Install dependencies Node.js
print_message "Menginstall dependencies Node.js..."
npm install

# Buat direktori logs
print_message "Membuat direktori logs..."
mkdir -p logs
chmod 755 logs

# Setup environment variables
print_message "Menyiapkan environment variables..."
cp .env.example .env
sed -i "s|FFMPEG_PATH=.*|FFMPEG_PATH=/usr/bin/ffmpeg|" .env
sed -i "s|CHROME_PATH=.*|CHROME_PATH=/usr/bin/chromium-browser|" .env
sed -i "s|YT_DLP_PATH=.*|YT_DLP_PATH=/usr/local/bin/yt-dlp|" .env
sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env
sed -i "s|PORT=.*|PORT=3000|" .env

# Setup SSL
print_message "Menyiapkan SSL..."
mkdir -p /etc/nginx/ssl/$DOMAIN
mv certificate /etc/nginx/ssl/$DOMAIN/
mv privatekey /etc/nginx/ssl/$DOMAIN/
chmod 600 /etc/nginx/ssl/$DOMAIN/privatekey
chmod 644 /etc/nginx/ssl/$DOMAIN/certificate

# Konfigurasi Nginx
print_message "Mengkonfigurasi Nginx..."

# Buat direktori untuk file temporary Nginx
mkdir -p /var/cache/nginx
chown -R www-data:www-data /var/cache/nginx

# Konfigurasi Nginx
cat > /etc/nginx/sites-available/$DOMAIN << EOF
# Redirect HTTP ke HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/$DOMAIN/certificate;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN/privatekey;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Buffer size settings
    client_max_body_size 100M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;

    # Timeouts
    client_body_timeout 300s;
    client_header_timeout 300s;
    keepalive_timeout 300s;
    send_timeout 300s;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Root directory
    root /var/www/$DOMAIN/public;
    index index.html;

    # Static files
    location / {
        try_files \$uri \$uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # API Proxy dengan konfigurasi khusus
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Meningkatkan timeout untuk proses yang lebih lama
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Meningkatkan buffer size
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;

        # Menambahkan header CORS
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        # Handle OPTIONS method
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Aktifkan konfigurasi Nginx
ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Cek konfigurasi Nginx
nginx -t

# Restart Nginx
systemctl restart nginx

# Set permission untuk direktori aplikasi
print_message "Mengatur permission..."
chown -R www-data:www-data /var/www/$DOMAIN
chmod -R 755 /var/www/$DOMAIN
chmod -R 777 /var/www/$DOMAIN/logs
chmod 644 .env

# Jalankan aplikasi dengan PM2
print_message "Menjalankan aplikasi dengan PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_message "Instalasi selesai! Aplikasi dapat diakses di https://$DOMAIN" 