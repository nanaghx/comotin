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
npm install -g npm@latest
check_error "Gagal mengupdate NPM"

npm install -g pm2
check_error "Gagal menginstall PM2"

# 4. Install dependencies proyek
echo "📦 Menginstall dependencies proyek..."
npm install
check_error "Gagal menginstall dependencies proyek"

# 5. Install dependencies sistem
echo "📦 Menginstall dependencies sistem..."
apt install -y ffmpeg chromium-browser certbot python3-certbot-apache apache2
check_error "Gagal menginstall dependencies sistem"

# 6. Konfigurasi PM2
echo "⚙️ Mengkonfigurasi PM2..."
pm2 stop social-media-api || true
pm2 delete social-media-api || true
pm2 start index.js --name social-media-api
pm2 save
pm2 startup systemd -u root --hp /root
check_error "Gagal mengkonfigurasi PM2"

# 7. Konfigurasi Apache
echo "🌐 Mengkonfigurasi Apache..."
# Aktifkan modul yang diperlukan
a2enmod proxy
a2enmod proxy_http
a2enmod rewrite
a2enmod ssl
a2enmod headers

# Buat konfigurasi virtual host
cat > /etc/apache2/sites-available/kraken-downloader.conf << EOL
<VirtualHost *:80>
    ServerName ${domain}
    ServerAdmin webmaster@${domain}
    
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type"
    
    ErrorLog \${APACHE_LOG_DIR}/error.log
    CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOL
check_error "Gagal membuat konfigurasi Apache"

# 8. Aktifkan konfigurasi Apache
echo "🔗 Mengaktifkan konfigurasi Apache..."
a2ensite kraken-downloader.conf
a2dissite 000-default.conf
apache2ctl configtest
check_error "Konfigurasi Apache tidak valid"
systemctl restart apache2
check_error "Gagal me-restart Apache"

# 9. Konfigurasi SSL
echo "🔒 Mengkonfigurasi SSL..."
certbot --apache -d ${domain} --non-interactive --agree-tos --email ${email}
check_error "Gagal mengkonfigurasi SSL"

# 10. Konfigurasi Firewall
echo "🛡️ Mengkonfigurasi Firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable
check_error "Gagal mengkonfigurasi firewall"

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
9. Untuk melihat log Apache: tail -f /var/log/apache2/error.log
10. Untuk restart Apache: systemctl restart apache2
11. Untuk melihat status firewall: ufw status
12. Untuk membuka port tambahan: ufw allow [port]/tcp
" 