# 📥 Social Media Downloader API

An API for downloading videos from various social‑media platforms such as Instagram, YouTube, TikTok, and Facebook.

## ✨ Key Features

* 🎥 **Multi‑platform video downloads**

  * YouTube (single videos & playlists)
  * TikTok
  * Facebook
  * Instagram
* 🔍 Automatic platform detection
* 📊 Multiple video formats & quality options
* 🗑️ Metadata‑stripping option
* 💾 Watermark‑free downloads (TikTok)
* 📝 Detailed video info (title, description, etc.)
* 🔒 Security

  * Public API access
  * Request validation

## 🛠️ Prerequisites

* Node.js (v14+)
* FFmpeg
* yt‑dlp
* Express.js
* Puppeteer (for scraping)

## ⚙️ Installation

1. **Clone the repository**

2. **Install dependencies**

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
   # Download from https://ffmpeg.org/download.html
   ```

4. **Install yt‑dlp**

   ```bash
   # macOS
   brew install yt-dlp

   # Ubuntu/Debian
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp

   # Windows
   # Download from https://github.com/yt-dlp/yt-dlp/releases
   ```

5. **Start the server**

   ```bash
   node app.js
   ```

   The server will run at `http://localhost:3000`.

## 📚 API Documentation

### 1. Detect Platform

Identify the platform from a given video URL.

**Endpoint:** `POST /api/detect-platform`

**Request Body**

```json
{
  "url": "https://www.instagram.com/p/example"
}
```

**Success Response**

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

---

### 2. Download Instagram Video

Download an Instagram post or reel.

**Endpoint:** `POST /api/instagram/download`

**Request Body**

```json
{
  "url": "https://www.instagram.com/p/example",
  "mute": false,
  "shouldRemoveMetadata": true
}
```

**Parameters**

| Name                   | Type    | Description         | Default      |
| ---------------------- | ------- | ------------------- | ------------ |
| `url`                  | string  | Instagram video URL | **required** |
| `mute`                 | boolean | Strip audio         | `false`      |
| `shouldRemoveMetadata` | boolean | Strip metadata      | `true`       |

---

### 3. Download YouTube Video

Download a YouTube video with quality options.

**Endpoint:** `POST /api/youtube/download`

**Request Body**

```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "mute": false,
  "shouldRemoveMetadata": true
}
```

Parameters are identical to the Instagram endpoint.

---

### 4. Download TikTok Video

Download a TikTok video without watermark.

**Endpoint:** `POST /api/tiktok/download`

Request body and parameters are the same as above.

---

### 5. Download Facebook Video

Download a Facebook video at the best quality.

**Endpoint:** `POST /api/facebook/download`

Request body and parameters are the same as above.

---

### 6. Download YouTube Playlist

Download every video in a YouTube playlist.

**Endpoint:** `POST /api/youtube-playlist`

**Request Body**

```json
{
  "url": "https://www.youtube.com/playlist?list=example"
}
```

**Parameter**

| Name  | Type   | Description                         |
| ----- | ------ | ----------------------------------- |
| `url` | string | YouTube playlist URL (**required**) |

**Success Response**

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

## 🔍 Response Format

### Success

```json
{
  "status": "success",
  "data": {
    // Platform‑specific data
  }
}
```

### Error

```json
{
  "status": "error",
  "message": "Specific error message"
}
```

## 🔐 Security & API Limits

1. **API Access**

   * Accessible from any domain
   * No CORS restrictions
   * No request‑rate limits
   * Suitable for public use

2. **Request Validation**

   * Every request is validated
   * Video URL must be valid and reachable
   * Request body must follow the docs

3. **Bandwidth Limits**

   * File‑size limits apply
   * Very large videos may be rejected
   * Choose formats appropriate to your needs

4. **API Usage**

   * Designed for public use
   * Please use responsibly
   * Avoid excessive usage

## 🤝 Contributing

Contributions are welcome! Feel free to open pull requests or file issues.

## 🙏 Acknowledgments

* [yt‑dlp](https://github.com/yt-dlp/yt-dlp)
* [FFmpeg](https://ffmpeg.org/)
* [Node.js](https://nodejs.org/)
