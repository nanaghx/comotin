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

# Buat direktori aplikasi
print_message "Menyiapkan direktori aplikasi..."
mkdir -p /var/www/$DOMAIN
cd /var/www/$DOMAIN

# Clone repository (ganti dengan URL repository Anda)
print_message "Mengclone repository..."
git clone https://github.com/masalfi/donlotin.git .

# Install dependencies Node.js
print_message "Menginstall dependencies Node.js..."
npm install

# Setup SSL
print_message "Menyiapkan SSL..."
mkdir -p /etc/nginx/ssl/$DOMAIN
mv certificate /etc/nginx/ssl/$DOMAIN/
mv privatekey /etc/nginx/ssl/$DOMAIN/

# Konfigurasi Nginx
print_message "Mengkonfigurasi Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/nginx/ssl/$DOMAIN/certificate;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN/privatekey;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

# Jalankan aplikasi dengan PM2
print_message "Menjalankan aplikasi dengan PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_message "Instalasi selesai! Aplikasi dapat diakses di https://$DOMAIN" 