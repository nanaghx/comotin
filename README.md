# Social Media Downloader API

API untuk mengunduh video dari berbagai platform media sosial seperti YouTube, TikTok, Facebook, dan Instagram.

## Fitur

- Download video dari YouTube, TikTok, Facebook, dan Instagram
- Mendukung berbagai format video
- Opsi penghapusan metadata video
- Mendukung playlist YouTube
- Mendeteksi platform secara otomatis
- Mendukung video berkualitas tinggi

## Persyaratan

- Node.js (v14 atau lebih tinggi)
- FFmpeg
- yt-dlp

## Instalasi

1. Clone repository ini
```bash
git clone https://github.com/username/Social-Media-Downloader.git
cd Social-Media-Downloader
```

2. Install dependencies
```bash
npm install
```

3. Install FFmpeg (jika belum terinstall)
```bash
# Untuk macOS menggunakan Homebrew
brew install ffmpeg

# Untuk Ubuntu/Debian
sudo apt-get install ffmpeg

# Untuk Windows
# Download dari https://ffmpeg.org/download.html
```

4. Install yt-dlp (jika belum terinstall)
```bash
# Untuk macOS menggunakan Homebrew
brew install yt-dlp

# Untuk Ubuntu/Debian
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Untuk Windows
# Download dari https://github.com/yt-dlp/yt-dlp/releases/latest
```

5. Jalankan API
```bash
node app.js
```

API akan berjalan di `http://localhost:3000`

## Penggunaan API

### 1. Deteksi Platform
```http
POST /api/detect-platform
Content-Type: application/json

{
    "url": "URL_VIDEO"
}
```

### 2. Download Video YouTube
```http
POST /api/youtube/download
Content-Type: application/json

{
    "url": "URL_YOUTUBE",
    "removeMetadata": true
}
```

### 3. Download Video TikTok
```http
POST /api/tiktok/download
Content-Type: application/json

{
    "url": "URL_TIKTOK",
    "removeMetadata": true
}
```

### 4. Download Video Facebook
```http
POST /api/facebook/download
Content-Type: application/json

{
    "url": "URL_FACEBOOK",
    "removeMetadata": true
}
```

### 5. Download Video Instagram
```http
POST /api/instagram/download
Content-Type: application/json

{
    "url": "URL_INSTAGRAM",
    "removeMetadata": true
}
```

### 6. Download Playlist YouTube
```http
POST /api/youtube-playlist
Content-Type: application/json

{
    "url": "URL_PLAYLIST_YOUTUBE"
}
```

## Parameter

- `url`: URL video yang ingin diunduh (wajib)
- `removeMetadata`: Boolean untuk menghapus metadata video (opsional, default: true)

## Response

### Sukses
```json
{
    "status": "success",
    "data": {
        // Data video
    }
}
```

### Error
```json
{
    "status": "error",
    "message": "Pesan error"
}
```

## Catatan

1. Pastikan URL video valid dan dapat diakses
2. Proses download mungkin memerlukan waktu yang lebih lama jika opsi penghapusan metadata diaktifkan
3. Beberapa video mungkin tidak dapat diunduh karena pembatasan dari platform
4. Gunakan API dengan bijak dan sesuai dengan kebijakan platform

## Lisensi

MIT License

