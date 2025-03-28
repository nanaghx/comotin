#!/bin/bash

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

# 1. Update sistem
echo "📦 Mengupdate sistem..."
apt update && apt upgrade -y

# 2. Install dependencies sistem
echo "📦 Menginstall dependencies sistem..."
apt install -y ffmpeg chromium-browser certbot python3-certbot-nginx curl gnupg

# 3. Install yt-dlp
echo "📦 Menginstall yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# 4. Install Node.js 18.x
echo "📦 Menginstall Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 5. Install PM2 secara global
echo "📦 Menginstall PM2..."
npm install -g pm2
export PATH=$PATH:/usr/local/bin

# 6. Install dependencies project
echo "📦 Menginstall dependencies project..."
npm install

# 7. Konfigurasi Nginx
echo "🌐 Mengkonfigurasi Nginx..."
cat > /etc/nginx/sites-available/kraken-downloader << EOL
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
    }
}
EOL

# 8. Aktifkan konfigurasi Nginx
echo "🔗 Mengaktifkan konfigurasi Nginx..."
ln -s /etc/nginx/sites-available/kraken-downloader /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Hapus konfigurasi default jika ada
nginx -t
systemctl restart nginx

# 9. Konfigurasi SSL dengan Let's Encrypt
echo "🔒 Mengkonfigurasi SSL..."
certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email}

# 10. Jalankan aplikasi dengan PM2
echo "🚀 Menjalankan aplikasi..."
# Pastikan PM2 terinstall dengan benar
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 tidak ditemukan, mencoba menginstall ulang..."
    npm install -g pm2
    export PATH=$PATH:/usr/local/bin
fi

# Jalankan aplikasi
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo "✅ Deployment selesai!"
echo "📝 Status aplikasi:"
pm2 status

echo "
🔍 Catatan Penting:
1. Domain Anda: ${domain}
2. Email SSL: ${email}
3. Port 80 dan 443 harus terbuka di firewall
4. Jika menggunakan aapanel, konfigurasi SSL bisa dilakukan melalui panel
5. Untuk mengupdate SSL: certbot renew
6. Untuk restart aplikasi: pm2 restart kraken-downloader
7. Untuk melihat log: pm2 logs kraken-downloader
8. Jika ada masalah dengan PM2, coba: systemctl restart pm2-root
" 