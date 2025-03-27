#!/bin/bash

# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js dan npm jika belum ada
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 jika belum ada
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Install FFmpeg jika belum ada
if ! command -v ffmpeg &> /dev/null; then
    sudo apt install -y ffmpeg
fi

# Install yt-dlp jika belum ada
if ! command -v yt-dlp &> /dev/null; then
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
fi

# Install dependencies
npm install

# Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.js --env production

# Simpan konfigurasi PM2 agar aplikasi tetap berjalan setelah reboot
pm2 save

# Setup PM2 untuk start otomatis saat boot
pm2 startup | grep -v "sudo" | bash

echo "Deployment selesai! Aplikasi berjalan di port 3000" 