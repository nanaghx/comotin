# 📥 Social Media Downloader API

API untuk mengunduh video dari berbagai platform media sosial populer. Mendukung YouTube, TikTok, Facebook, dan Instagram dengan berbagai pilihan kualitas video.

## ✨ Fitur Utama

- 🎥 Download video dari multiple platform:
  - YouTube (video & playlist)
  - TikTok 
  - Facebook
  - Instagram
- 🔍 Deteksi platform otomatis
- 📊 Multiple format & kualitas video
- 🗑️ Opsi penghapusan metadata
- 💾 Download tanpa watermark (untuk TikTok)
- 📝 Informasi lengkap video (judul, deskripsi, dll)

## 🛠️ Prasyarat

- Node.js (v14+)
- FFmpeg
- yt-dlp

## ⚙️ Instalasi

1. **Clone Repository**
```bash
git clone https://github.com/masalfi/API-Social-Media-Downloader.git
cd API-Social-Media-Downloader
```

2. **Install Dependencies**
```bash
npm install
```

3. **Install FFmpeg**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download dari https://ffmpeg.org/download.html
```

4. **Install yt-dlp**
```bash
# macOS
brew install yt-dlp

# Ubuntu/Debian
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows
# Download dari https://github.com/yt-dlp/yt-dlp/releases
```

5. **Jalankan Server**
```bash
node app.js
```

Server akan berjalan di `http://localhost:3000`

## 📚 Dokumentasi API

### 1. Deteksi Platform
Mendeteksi platform dari URL video yang diberikan.

**Endpoint:** `POST /api/detect-platform`

**Request Body:**
```json
{
    "url": "URL_VIDEO"
}
```

**Response Success:**
```json
{
    "status": "success",
    "platform": "youtube",
    "data": {
        "title": "Judul Video",
        "duration": "300",
        "thumbnail": "URL_THUMBNAIL",
        "description": "Deskripsi Video",
        // ... data lainnya
    }
}
```

### 2. Download Video YouTube
Download video dari YouTube dengan berbagai opsi kualitas.

**Endpoint:** `POST /api/youtube/download`

**Request Body:**
```json
{
    "url": "URL_YOUTUBE",
    "removeMetadata": true  // opsional, default: true
}
```

**Response Success:**
```json
{
    "status": "success",
    "data": {
        "title": "Judul Video",
        "owner": "Nama Channel",
        "duration": "300",
        "dataFormats": [
            {
                "format": "720p",
                "filesize": "10000000",
                "url": "URL_DOWNLOAD"
            }
            // ... format lainnya
        ]
    }
}
```

### 3. Download Video TikTok
Download video TikTok tanpa watermark.

**Endpoint:** `POST /api/tiktok/download`

**Request Body:**
```json
{
    "url": "URL_TIKTOK",
    "removeMetadata": true  // opsional, default: true
}
```

### 4. Download Video Facebook
Download video dari Facebook dengan kualitas terbaik.

**Endpoint:** `POST /api/facebook/download`

**Request Body:**
```json
{
    "url": "URL_FACEBOOK",
    "removeMetadata": true  // opsional, default: true
}
```

### 5. Download Video Instagram
Download video dari Instagram (post/reels).

**Endpoint:** `POST /api/instagram/download`

**Request Body:**
```json
{
    "url": "URL_INSTAGRAM",
    "removeMetadata": true  // opsional, default: true
}
```

### 6. Download Playlist YouTube
Download seluruh video dalam playlist YouTube.

**Endpoint:** `POST /api/youtube-playlist`

**Request Body:**
```json
{
    "url": "URL_PLAYLIST"
}
```

## 🔍 Format Response

### Success Response
```json
{
    "status": "success",
    "data": {
        // Data spesifik untuk setiap platform
    }
}
```

### Error Response
```json
{
    "status": "error",
    "message": "Pesan error spesifik"
}
```

## ⚠️ Catatan Penting

1. **Rate Limiting:**
   - Harap gunakan API dengan bijak
   - Hindari request berlebihan dalam waktu singkat

2. **Video Metadata:**
   - Opsi `removeMetadata` akan memperlambat proses download
   - Metadata yang dihapus tidak dapat dikembalikan

3. **Kompatibilitas:**
   - Pastikan URL video dapat diakses publik
   - Beberapa video mungkin dilindungi atau dibatasi

4. **Kualitas Video:**
   - Kualitas maksimum tergantung pada video sumber
   - Format yang tersedia bervariasi antar platform

## 🤝 Kontribusi

Kontribusi selalu diterima! Silakan buat pull request atau laporkan issues.

## 📄 Lisensi

Project ini dilisensikan di bawah [MIT License](LICENSE).

## 👨‍💻 Author

- [Alfi Firdaus](https://github.com/masalfi)

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg](https://ffmpeg.org/)
- [Node.js](https://nodejs.org/)

