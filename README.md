# 📥 Social Media Downloader API

API untuk mengunduh video dari berbagai platform media sosial seperti Instagram, YouTube, TikTok, dan Facebook.

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
- 🔒 Keamanan:
  - Public API Access
  - Request Validation

## 🛠️ Prasyarat

- Node.js (v14+)
- FFmpeg
- yt-dlp
- Express.js
- Puppeteer (untuk scraping)

## ⚙️ Instalasi

1. **Clone Repository**
```bash
git clone https://github.com/username/Social-Media-Downloader.git
cd Social-Media-Downloader
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
    "url": "https://www.instagram.com/p/example"
}
```

**Response Success:**
```json
{
    "status": "success",
    "platform": "instagram",
    "owner": "username",
    "displayUrl": "thumbnail_url",
    "caption": "video_caption",
    "title": "video_title",
    "duration": 60,
    "totalViews": 1000,
    "postUrl": "original_url",
    "dataFormats": [
        {
            "dataDownload": "download_url",
            "format": "720p",
            "ext": "mp4",
            "filesize": 1234567
        }
    ]
}
```

### 2. Download Video Instagram
Download video dari Instagram (post/reels).

**Endpoint:** `POST /api/instagram/download`

**Request Body:**
```json
{
    "url": "https://www.instagram.com/p/example",
    "mute": false,
    "removeMetadata": true
}
```

**Parameter:**
- `url`: URL video Instagram (wajib)
- `mute`: Boolean, untuk menghapus audio (opsional, default: false)
- `removeMetadata`: Boolean, untuk menghapus metadata (opsional, default: true)

### 3. Download Video YouTube
Download video dari YouTube dengan berbagai opsi kualitas.

**Endpoint:** `POST /api/youtube/download`

**Request Body:**
```json
{
    "url": "https://www.youtube.com/watch?v=example",
    "mute": false,
    "removeMetadata": true
}
```

**Parameter:**
- `url`: URL video YouTube (wajib)
- `mute`: Boolean, untuk menghapus audio (opsional, default: false)
- `removeMetadata`: Boolean, untuk menghapus metadata (opsional, default: true)

### 4. Download Video TikTok
Download video TikTok tanpa watermark.

**Endpoint:** `POST /api/tiktok/download`

**Request Body:**
```json
{
    "url": "https://www.tiktok.com/@username/video/example",
    "mute": false,
    "removeMetadata": true
}
```

**Parameter:**
- `url`: URL video TikTok (wajib)
- `mute`: Boolean, untuk menghapus audio (opsional, default: false)
- `removeMetadata`: Boolean, untuk menghapus metadata (opsional, default: true)

### 5. Download Video Facebook
Download video dari Facebook dengan kualitas terbaik.

**Endpoint:** `POST /api/facebook/download`

**Request Body:**
```json
{
    "url": "https://www.facebook.com/watch?v=example",
    "mute": false,
    "removeMetadata": true
}
```

**Parameter:**
- `url`: URL video Facebook (wajib)
- `mute`: Boolean, untuk menghapus audio (opsional, default: false)
- `removeMetadata`: Boolean, untuk menghapus metadata (opsional, default: true)

### 6. Download Playlist YouTube
Download seluruh video dalam playlist YouTube.

**Endpoint:** `POST /api/youtube-playlist`

**Request Body:**
```json
{
    "url": "https://www.youtube.com/playlist?list=example"
}
```

**Parameter:**
- `url`: URL playlist YouTube (wajib)

**Response:**
```json
{
    "status": "success",
    "dataDownloads": [
        {
            "ownerUrl": "channel_url",
            "ownerId": "channel_id",
            "channelUrl": "channel_url",
            "uploader": "channel_name",
            "totalViews": 1000,
            "urlId": "video_id",
            "thumbnail": "thumbnail_url",
            "description": "video_description",
            "filename": "video_filename",
            "duration": 60,
            "title": "video_title",
            "categories": ["category1", "category2"],
            "dataFormats": [
                {
                    "dataDownload": "download_url",
                    "format": "720p",
                    "ext": "mp4",
                    "filesize": 1234567
                }
            ]
        }
    ]
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

## 🔐 Keamanan & Batasan API

1. **Akses API:**
   - API dapat diakses dari domain manapun
   - Tidak ada pembatasan CORS
   - Tidak ada batasan jumlah request
   - Cocok untuk penggunaan publik

2. **Validasi Request:**
   - Setiap request akan divalidasi
   - URL video harus valid dan dapat diakses
   - Format request body harus sesuai dokumentasi

3. **Pembatasan Bandwidth:**
   - Ada batasan ukuran file yang dapat didownload
   - Video yang terlalu besar mungkin ditolak
   - Gunakan format video yang sesuai kebutuhan

4. **Penggunaan API:**
   - API ini untuk penggunaan publik
   - Harap gunakan dengan bijak
   - Hindari penggunaan yang berlebihan

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

## 📞 Kontak & Dukungan

Jika Anda membutuhkan:
- Akses khusus untuk domain Anda
- Bantuan teknis lainnya

Silakan hubungi:
- Email: [masalfi@gmail.com](mailto:masalfi@gmail.com)
- GitHub: [@masalfi](https://github.com/masalfi)

