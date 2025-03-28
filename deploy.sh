#!/bin/bash

# Fungsi untuk mengecek error
check_error() {
    if [ $? -ne 0 ]; then
        echo "❌ Error: $1"
        exit 1
    fi
}

echo "🚀 Memulai proses deployment..."

# Input domain di awal
echo "🌐 Konfigurasi Domain"
read -p "Masukkan domain Anda (contoh: example.com): " domain
read -p "Masukkan email Anda untuk SSL (contoh: your@email.com): " email

# Validasi input
if [ -z "$domain" ] || [ -z "$email" ]; then
    echo "❌ Error: Domain dan email harus diisi!"
    exit 1
fi

echo "📝 Domain: $domain"
echo "📧 Email: $email"
echo "⏳ Memulai instalasi..."

# 1. Update sistem dan install tools dasar
echo "📦 Mengupdate sistem..."
apt update && apt upgrade -y
check_error "Gagal mengupdate sistem"

echo "📦 Menginstall tools dasar..."
apt install -y curl wget git unzip
check_error "Gagal menginstall tools dasar"

# 2. Install Node.js
echo "📦 Menginstall Node.js..."
# Hapus instalasi Node.js lama jika ada
apt remove -y nodejs npm || true
apt autoremove -y || true

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
check_error "Gagal menambahkan repository Node.js"

apt install -y nodejs
check_error "Gagal menginstall Node.js"

# 3. Install NPM dan PM2
echo "📦 Menginstall NPM dan PM2..."
npm install -g npm@10.2.4
check_error "Gagal mengupdate NPM"

npm install -g pm2
check_error "Gagal menginstall PM2"

# 4. Install dependencies proyek
echo "📦 Menginstall dependencies proyek..."
npm install
check_error "Gagal menginstall dependencies proyek"

# 5. Install dependencies sistem
echo "📦 Menginstall dependencies sistem..."
apt install -y ffmpeg chromium-browser certbot python3-certbot-nginx nginx
check_error "Gagal menginstall dependencies sistem"

# 6. Konfigurasi PM2
echo "⚙️ Mengkonfigurasi PM2..."
pm2 stop social-media-api || true
pm2 delete social-media-api || true
pm2 start app.js --name social-media-api
pm2 save
pm2 startup systemd -u root --hp /root
check_error "Gagal mengkonfigurasi PM2"

# 7. Konfigurasi Nginx
echo "🌐 Mengkonfigurasi Nginx..."
# Buat konfigurasi virtual host
cat > /etc/nginx/sites-available/kraken-downloader.conf << EOL
server {
    listen 80;
    server_name ${domain};

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

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }

    # SSL configuration will be added by Certbot
}
EOL
check_error "Gagal membuat konfigurasi Nginx"

# 8. Aktifkan konfigurasi Nginx
echo "🔗 Mengaktifkan konfigurasi Nginx..."
ln -sf /etc/nginx/sites-available/kraken-downloader.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
check_error "Konfigurasi Nginx tidak valid"
systemctl restart nginx
check_error "Gagal me-restart Nginx"

# 9. Konfigurasi SSL
echo "🔒 Mengkonfigurasi SSL..."
certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email}
check_error "Gagal mengkonfigurasi SSL"

# 10. Konfigurasi Firewall
echo "🛡️ Mengkonfigurasi Firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable
check_error "Gagal mengkonfigurasi firewall"

# 11. Konfigurasi Auto-start
echo "⚙️ Mengkonfigurasi Auto-start..."
systemctl enable nginx
systemctl enable pm2-root
check_error "Gagal mengkonfigurasi auto-start"

echo "✅ Deployment selesai!"
echo "📝 Status aplikasi:"
pm2 status

echo "
🔍 Catatan Penting:
1. Domain Anda: ${domain}
2. Email SSL: ${email}
3. Port yang terbuka: 80, 443, dan 22
4. Jika menggunakan aapanel, konfigurasi SSL bisa dilakukan melalui panel
5. Untuk mengupdate SSL: certbot renew
6. Untuk restart aplikasi: pm2 restart social-media-api
7. Untuk melihat log: pm2 logs social-media-api
8. Jika ada masalah dengan PM2, coba: systemctl restart pm2-root
9. Untuk melihat log Nginx: tail -f /var/log/nginx/error.log
10. Untuk restart Nginx: systemctl restart nginx
11. Untuk melihat status firewall: ufw status
12. Untuk membuka port tambahan: ufw allow [port]/tcp
13. Aplikasi akan otomatis start saat server di-restart
" 