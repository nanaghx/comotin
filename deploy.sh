#!/bin/bash

echo "🚀 Memulai proses deployment..."

# 1. Update sistem
echo "📦 Mengupdate sistem..."
apt update && apt upgrade -y

# 2. Install dependencies sistem
echo "📦 Menginstall dependencies sistem..."
apt install -y ffmpeg chromium-browser

# 3. Install yt-dlp
echo "📦 Menginstall yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# 4. Install Node.js
echo "📦 Menginstall Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 5. Install PM2
echo "📦 Menginstall PM2..."
npm install -g pm2

# 6. Install dependencies project
echo "📦 Menginstall dependencies project..."
npm install

# 7. Jalankan aplikasi dengan PM2
echo "🚀 Menjalankan aplikasi..."
pm2 start app.js --name "kraken-downloader"
pm2 save
pm2 startup

echo "✅ Deployment selesai!"
echo "📝 Status aplikasi:"
pm2 status 