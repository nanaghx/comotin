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
apt update
apt install -y curl git build-essential

# Install Apache
print_message "Menginstall Apache..."
apt install -y apache2

# Aktifkan modul Apache yang diperlukan
print_message "Mengaktifkan modul Apache..."
a2enmod rewrite
a2enmod ssl
a2enmod proxy
a2enmod proxy_http
a2enmod headers

# Install Node.js
print_message "Menginstall Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2
print_message "Menginstall PM2..."
# Pastikan npm path sudah benar
export NODE_PATH=/usr/lib/node_modules
# Install PM2 secara global
npm install -g pm2
# Tambahkan PM2 ke PATH sistem
echo "export PATH=\$PATH:/usr/lib/node_modules/pm2/bin" >> /etc/profile
source /etc/profile

# Verifikasi instalasi PM2
if ! command -v pm2 &> /dev/null; then
    print_message "Gagal menginstall PM2. Mencoba alternatif instalasi..."
    # Coba instalasi alternatif
    npm install -g pm2 --unsafe-perm=true --allow-root
    # Tambahkan symlink
    ln -s /usr/lib/node_modules/pm2/bin/pm2 /usr/local/bin/pm2
fi

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
mkdir -p /etc/apache2/ssl/$DOMAIN
mv certificate /etc/apache2/ssl/$DOMAIN/
mv privatekey /etc/apache2/ssl/$DOMAIN/
chmod 600 /etc/apache2/ssl/$DOMAIN/privatekey
chmod 644 /etc/apache2/ssl/$DOMAIN/certificate

# Konfigurasi Apache
print_message "Mengkonfigurasi Apache..."

# Buat konfigurasi virtual host
cat > /etc/apache2/sites-available/$DOMAIN.conf << EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAdmin webmaster@$DOMAIN
    DocumentRoot /var/www/$DOMAIN/public
    
    # Redirect ke HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
    
    <Directory /var/www/$DOMAIN/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog \${APACHE_LOG_DIR}/$DOMAIN-error.log
    CustomLog \${APACHE_LOG_DIR}/$DOMAIN-access.log combined
</VirtualHost>

<VirtualHost *:443>
    ServerName $DOMAIN
    ServerAdmin webmaster@$DOMAIN
    DocumentRoot /var/www/$DOMAIN/public
    
    SSLEngine on
    SSLCertificateFile /etc/apache2/ssl/$DOMAIN/certificate
    SSLCertificateKeyFile /etc/apache2/ssl/$DOMAIN/privatekey
    
    # SSL Configuration
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder off
    SSLSessionTickets off
    
    # Security Headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    Header always set Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    
    <Directory /var/www/$DOMAIN/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # Proxy ke Node.js
    ProxyPass /api http://localhost:3000
    ProxyPassReverse /api http://localhost:3000
    
    ErrorLog \${APACHE_LOG_DIR}/$DOMAIN-error.log
    CustomLog \${APACHE_LOG_DIR}/$DOMAIN-access.log combined
</VirtualHost>
EOF

# Aktifkan konfigurasi site
a2ensite $DOMAIN.conf
a2dissite 000-default.conf

# Cek konfigurasi Apache
apache2ctl configtest

# Restart Apache
systemctl restart apache2

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