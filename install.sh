#!/bin/bash

echo "🚀 Memulai instalasi..."

# Install dependencies sistem
apt install -y ffmpeg chromium-browser

# Install yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Install dependencies Node.js
npm install

# Install PM2
npm install -g pm2

# Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ Instalasi selesai!"
echo "📝 Status aplikasi:"
pm2 status 