const axios = require("axios");
const router = require("express").Router();
const YTDlpWrap = require("yt-dlp-wrap").default;
const tiktokScraper = require("tiktok-scraper");
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Ambil path dari environment variables dengan validasi
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
const YT_DLP_PATH = process.env.YT_DLP_PATH || '/usr/local/bin/yt-dlp';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium-browser';

// Validasi keberadaan executables
function validateExecutables() {
	const executables = [
		{ path: FFMPEG_PATH, name: 'FFmpeg' },
		{ path: YT_DLP_PATH, name: 'yt-dlp' },
		{ path: CHROME_PATH, name: 'Chrome/Chromium' }
	];

	for (const exe of executables) {
		if (!fs.existsSync(exe.path)) {
			console.error(`ERROR: ${exe.name} tidak ditemukan di ${exe.path}`);
			console.error(`Pastikan ${exe.name} terinstall dan path di .env benar`);
		}
	}
}

// Jalankan validasi saat startup
validateExecutables();

// Inisialisasi YTDlpWrap dengan path yang benar
const ytDlp = new YTDlpWrap(YT_DLP_PATH);

// Konfigurasi Puppeteer
const puppeteerConfig = {
	executablePath: CHROME_PATH,
	args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
};

// Validasi URL
function isValidUrl(url) {
	try {
		new URL(url);
		return true;
	} catch (err) {
		return false;
	}
}

// Validasi URL Instagram
function isInstagramUrl(url) {
	return url.includes('instagram.com') || url.includes('instagr.am');
}

// Validasi URL YouTube
function isYoutubeUrl(url) {
	return url.includes('youtube.com') || url.includes('youtu.be');
}

// Fungsi untuk membersihkan temporary files
function cleanupTempFiles(files) {
	files.forEach(file => {
		if (fs.existsSync(file)) {
			try {
				fs.unlinkSync(file);
				console.log(`File temporary ${file} berhasil dihapus`);
			} catch (err) {
				console.error(`Error menghapus file temporary ${file}:`, err);
			}
		}
	});
}

function toSupportedFormat(url) {
	if (url.includes("list=")) {
		const playlistId = url.substring(url.indexOf("list=") + 5);

		return `https://www.youtube.com/playlist?list=${playlistId}`;
	}

	return url;
}

// Fungsi untuk mengekstrak audio menggunakan ffmpeg
async function extractAudio(inputBuffer) {
	return new Promise((resolve, reject) => {
		const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
		const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

		try {
			// Validasi path ffmpeg
			if (!fs.existsSync(FFMPEG_PATH)) {
				throw new Error(`FFmpeg tidak ditemukan di ${FFMPEG_PATH}`);
			}

			fs.writeFileSync(tempInput, inputBuffer);

			const ffmpeg = spawn(FFMPEG_PATH, [
				'-i', tempInput,
				'-vn',
				'-acodec', 'libmp3lame',
				'-ab', '320k',
				'-ar', '44100',
				'-ac', '2',
				'-f', 'mp3',
				'-y',
				tempOutput
			]);

			let ffmpegError = '';

			ffmpeg.stderr.on('data', (data) => {
				ffmpegError += data.toString();
				console.log('ffmpeg:', data.toString());
			});

			ffmpeg.on('close', (code) => {
				try {
					if (code === 0) {
						const outputBuffer = fs.readFileSync(tempOutput);
						fs.unlinkSync(tempInput);
						fs.unlinkSync(tempOutput);
						resolve(outputBuffer);
					} else {
						reject(new Error(`ffmpeg gagal dengan kode ${code}: ${ffmpegError}`));
					}
				} catch (err) {
					reject(new Error('Error membaca file output: ' + err.message));
				} finally {
					// Cleanup temporary files
					[tempInput, tempOutput].forEach(file => {
						if (fs.existsSync(file)) {
							try {
								fs.unlinkSync(file);
							} catch (err) {
								console.error(`Error menghapus file temporary ${file}:`, err);
							}
						}
					});
				}
			});

			ffmpeg.on('error', (err) => {
				// Cleanup temporary files on error
				[tempInput, tempOutput].forEach(file => {
					if (fs.existsSync(file)) {
						try {
							fs.unlinkSync(file);
						} catch (err) {
							console.error(`Error menghapus file temporary ${file}:`, err);
						}
					}
				});
				reject(new Error('Error menjalankan ffmpeg: ' + err.message));
			});
		} catch (err) {
			// Cleanup temporary files on error
			[tempInput, tempOutput].forEach(file => {
				if (fs.existsSync(file)) {
					try {
						fs.unlinkSync(file);
					} catch (err) {
						console.error(`Error menghapus file temporary ${file}:`, err);
					}
				}
			});
			reject(new Error('Error dalam extractAudio: ' + err.message));
		}
	});
}

// Fungsi untuk menghapus audio menggunakan ffmpeg
async function removeAudio(inputBuffer) {
	return new Promise((resolve, reject) => {
		const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
		const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

		try {
			fs.writeFileSync(tempInput, inputBuffer);

			const ffmpeg = spawn(FFMPEG_PATH, [
				'-i', tempInput,
				'-an',
				'-c:v', 'copy',
				'-y',
				tempOutput
			]);

			let ffmpegError = '';

			ffmpeg.stderr.on('data', (data) => {
				ffmpegError += data.toString();
				console.log('ffmpeg:', data.toString());
			});

			ffmpeg.on('close', (code) => {
				try {
					if (code === 0) {
						const outputBuffer = fs.readFileSync(tempOutput);
						fs.unlinkSync(tempInput);
						fs.unlinkSync(tempOutput);
						resolve(outputBuffer);
					} else {
						reject(new Error(`ffmpeg gagal dengan kode ${code}: ${ffmpegError}`));
					}
				} catch (err) {
					reject(new Error('Error membaca file output: ' + err.message));
				}
			});

			ffmpeg.on('error', (err) => {
				reject(new Error('Error menjalankan ffmpeg: ' + err.message));
			});
		} catch (err) {
			reject(new Error('Error dalam removeAudio: ' + err.message));
		}
	});
}

// Fungsi untuk menghapus metadata menggunakan ffmpeg
async function removeMetadata(inputBuffer) {
	return new Promise((resolve, reject) => {
		const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
		const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

		try {
			fs.writeFileSync(tempInput, inputBuffer);

			const ffmpeg = spawn(FFMPEG_PATH, [
				'-i', tempInput,
				'-map_metadata', '-1',
				'-c', 'copy',
				'-y',
				tempOutput
			]);

			let ffmpegError = '';

			ffmpeg.stderr.on('data', (data) => {
				ffmpegError += data.toString();
				console.log('ffmpeg:', data.toString());
			});

			ffmpeg.on('close', (code) => {
				try {
					if (code === 0) {
						const outputBuffer = fs.readFileSync(tempOutput);
						fs.unlinkSync(tempInput);
						fs.unlinkSync(tempOutput);
						resolve(outputBuffer);
					} else {
						reject(new Error(`ffmpeg gagal dengan kode ${code}: ${ffmpegError}`));
					}
				} catch (err) {
					reject(new Error('Error membaca file output: ' + err.message));
				}
			});

			ffmpeg.on('error', (err) => {
				reject(new Error('Error menjalankan ffmpeg: ' + err.message));
			});
		} catch (err) {
			reject(new Error('Error dalam removeMetadata: ' + err.message));
		}
	});
}

router.post("/instagram", async (req, res, next) => {
	const tempFiles = [];
	try {
		const { url } = req.body;
		
		if (!url) {
			throw new Error('URL tidak boleh kosong');
		}

		if (!isValidUrl(url)) {
			throw new Error('URL tidak valid');
		}

		if (!isInstagramUrl(url)) {
			throw new Error('URL bukan dari Instagram');
		}

		console.log('Mencoba mengakses URL Instagram:', url);

		// Jalankan yt-dlp sebagai proses terpisah
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			url
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);
		console.log('Video info:', videoInfo);

		const response = {
			status: "success",
			owner: videoInfo.uploader || '',
			displayUrl: videoInfo.thumbnail || '',
			caption: videoInfo.description || '',
			title: videoInfo.title || '',
			duration: videoInfo.duration || 0,
			totalViews: videoInfo.view_count || 0,
			postUrl: url,
			dataFormats: []
		};

		if (videoInfo.formats) {
			videoInfo.formats.forEach(format => {
				if (format.url) {
					response.dataFormats.push({
						dataDownload: format.url,
						format: format.format || 'unknown',
						ext: format.ext || 'mp4',
						filesize: format.filesize || null
					});
				}
			});
		}

		console.log('Data berhasil diekstrak');
		res.json(response);
	} catch (error) {
		console.error('Error saat mengambil data Instagram:', error);
		cleanupTempFiles(tempFiles);
		next(error);
	}
});

router.post("/youtube", async (req, res, next) => {
	const tempFiles = [];
	try {
		const { url } = req.body;

		if (!url) {
			throw new Error('URL tidak boleh kosong');
		}

		if (!isValidUrl(url)) {
			throw new Error('URL tidak valid');
		}

		if (!isYoutubeUrl(url)) {
			throw new Error('URL bukan dari YouTube');
		}

		console.log('Mencoba mengakses URL YouTube:', url);

		// Konversi URL mobile ke format desktop
		let processedUrl = url;
		if (url.includes('youtu.be/')) {
			const videoId = url.split('youtu.be/')[1].split('?')[0];
			processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
		} else if (url.includes('youtube.com/shorts/')) {
			const videoId = url.split('shorts/')[1].split('?')[0];
			processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
		}

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			'--format-sort', 'res,ext:mp4:m4a',
			'--merge-output-format', 'mp4',
			processedUrl
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);
		console.log('Video info:', videoInfo);

		const response = {
			status: "success",
			owner: videoInfo.uploader || '',
			ownerUrl: videoInfo.uploader_url || '',
			channelUrl: videoInfo.channel_url || '',
			displayUrl: videoInfo.thumbnail || '',
			caption: videoInfo.description || '',
			title: videoInfo.title || '',
			duration: videoInfo.duration || 0,
			totalViews: videoInfo.view_count || 0,
			postUrl: processedUrl,
			dataFormats: []
		};

		if (videoInfo.formats) {
			// Filter dan urutkan format video
			const validFormats = videoInfo.formats
				.filter(format => format.url && format.ext === 'mp4')
				.sort((a, b) => {
					const aHeight = parseInt(a.height) || 0;
					const bHeight = parseInt(b.height) || 0;
					return bHeight - aHeight;
				});

			// Ambil format unik berdasarkan resolusi
			const uniqueFormats = [];
			const seenResolutions = new Set();

			for (const format of validFormats) {
				const resolution = `${format.width}x${format.height}`;
				if (!seenResolutions.has(resolution) && format.height) {
					seenResolutions.add(resolution);
					uniqueFormats.push(format);
				}
			}

			response.dataFormats = uniqueFormats.map(format => ({
				dataDownload: format.url,
				format: `${format.height}p`,
				ext: format.ext || 'mp4',
				filesize: format.filesize || null,
				resolution: `${format.width}x${format.height}`,
				width: format.width,
				height: format.height,
				fps: format.fps,
				vcodec: format.vcodec,
				acodec: format.acodec,
				quality: format.quality || 'unknown'
			}));
		}

		console.log('Data berhasil diekstrak');
		res.json(response);
	} catch (error) {
		console.error('Error saat mengambil data YouTube:', error);
		cleanupTempFiles(tempFiles);
		next(error);
	}
});

router.post("/youtube-playlist", async (req, res) => {
	try {
		const url = toSupportedFormat(req.body.url);
		const info = await ytDlp.getPlaylistInfo(url);
		
		const dataDownloads = info.map(video => ({
			ownerUrl: video.uploader_url,
			ownerId: video.uploader_id,
			channelUrl: video.channel_url,
			uploader: video.uploader,
			totalViews: video.view_count,
			urlId: video.id,
			thumbnail: video.thumbnail,
			description: video.description,
			filename: video._filename,
			duration: video.duration,
			title: video.fulltitle,
			categories: video.categories,
			dataFormats: video.formats
				.filter(format => format.acodec !== "none")
				.map(format => ({
					dataDownload: format.url,
					format: format.format,
					ext: format.ext,
					filesize: format.filesize,
				})),
		}));

		res.json({
			status: "success",
			dataDownloads,
		});
	} catch (error) {
		res.json({ status: "error", details: error.message });
	}
});

router.post("/tiktok", async (req, res) => {
	try {
		const { url } = req.body;
		console.log('Mencoba mengakses URL TikTok:', url);

		// Jalankan yt-dlp sebagai proses terpisah dengan opsi untuk mendapatkan video berkualitas terbaik
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--format', 'best[ext=mp4]',
			'--add-header', 'Referer:https://www.tiktok.com/',
			url
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);
		console.log('Data berhasil diekstrak');

		// Filter format untuk mendapatkan video tanpa watermark
		const formats = videoInfo.formats?.filter(format => 
			format.ext === 'mp4' && 
			format.protocol === 'https' &&
			!format.format_note?.toLowerCase().includes('watermark')
		) || [];

		const response = {
			status: 'success',
			owner: videoInfo.uploader || '',
			displayUrl: videoInfo.thumbnail || '',
			caption: videoInfo.description || '',
			title: videoInfo.title || '',
			duration: videoInfo.duration || 0,
			totalViews: videoInfo.view_count || 0,
			postUrl: videoInfo.webpage_url || '',
			dataFormats: formats.map(format => ({
				dataDownload: format.url || '',
				format: format.format || '',
				ext: format.ext || '',
				filesize: format.filesize,
				resolution: format.resolution,
				width: format.width,
				height: format.height,
				quality: format.quality || 'unknown',
				vcodec: format.vcodec,
				acodec: format.acodec
			})),
			likeCount: videoInfo.like_count,
			commentCount: videoInfo.comment_count,
			comments: videoInfo.comments?.map(comment => ({
				author: comment.author,
				authorId: comment.author_id,
				id: comment.id,
				text: comment.text,
				timestamp: comment.timestamp,
			}))
		};

		res.json(response);
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({
			status: 'error',
			message: error.message
		});
	}
});

router.post("/facebook", async (req, res) => {
	try {
		const url_post = req.body.url;
		console.log('Mencoba mengakses URL Facebook:', url_post);

		// Jalankan yt-dlp sebagai proses terpisah
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			url_post
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);
		console.log('Video info:', videoInfo);

		const response = {
			status: "success",
			owner: videoInfo.uploader || '',
			displayUrl: videoInfo.thumbnail || '',
			caption: videoInfo.description || '',
			title: videoInfo.title || '',
			duration: videoInfo.duration || 0,
			totalViews: videoInfo.view_count || 0,
			postUrl: url_post,
			dataFormats: []
		};

		if (videoInfo.formats) {
			videoInfo.formats.forEach(format => {
				if (format.url) {
					response.dataFormats.push({
						dataDownload: format.url,
						format: format.format || 'unknown',
						ext: format.ext || 'mp4',
						filesize: format.filesize || null,
						resolution: format.resolution || null,
						width: format.width || null,
						height: format.height || null
					});
				}
			});
		}

		console.log('Data berhasil diekstrak');
		res.json(response);
	} catch (error) {
		console.error('Error saat mengambil data Facebook:', error);
		res.json({ status: "error", details: error.message });
	}
});

router.post("/dailymotion", async (req, res) => {
	try {
		const url = req.body.url;
		console.log('Mencoba mengakses URL Dailymotion:', url);

		// Jalankan yt-dlp sebagai proses terpisah
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			url
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);
		console.log('Video info:', videoInfo);

		const response = {
			status: "success",
			title: videoInfo.title || '',
			thumbnail: videoInfo.thumbnail || '',
			description: videoInfo.description || '',
			duration: videoInfo.duration || 0,
			formats: videoInfo.formats || []
		};

		res.json(response);
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({
			status: "error",
			message: error.message
		});
	}
});

// Endpoint untuk mengunduh video YouTube
router.post("/youtube/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh video YouTube:', url);
		console.log('Status mute:', mute);
		console.log('Status shouldRemoveMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_youtube_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', FFMPEG_PATH,
			url
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', FFMPEG_PATH,
			url
		];

		// Jalankan yt-dlp
		const process = spawn(YT_DLP_PATH, ytDlpOptions);

		// Kumpulkan data dari stdout
		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		// Tunggu proses selesai
		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn(FFMPEG_PATH, [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			// Proses video seperti biasa
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mengunduh video TikTok
router.post("/tiktok/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh video TikTok:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_tiktok_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', FFMPEG_PATH,
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.tiktok.com/',
			url
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', FFMPEG_PATH,
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.tiktok.com/',
			url
		];

		// Jalankan yt-dlp
		const process = spawn(YT_DLP_PATH, ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn(FFMPEG_PATH, [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mengunduh video Facebook
router.post("/facebook/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh dari Facebook:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_facebook_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', FFMPEG_PATH,
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			url
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', FFMPEG_PATH,
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			url
		];

		// Jalankan yt-dlp
		const process = spawn(YT_DLP_PATH, ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn(FFMPEG_PATH, [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mendeteksi platform
router.post("/detect-platform", async (req, res) => {
	try {
		const { url } = req.body;
		console.log('Mendeteksi platform untuk URL:', url);

		if (!url) {
			throw new Error('URL tidak boleh kosong');
		}

		// Validasi format URL
		try {
			new URL(url);
		} catch (e) {
			throw new Error('Format URL tidak valid');
		}

		let platform = '';

		// Deteksi platform berdasarkan URL
		if (url.includes('facebook.com') || url.includes('fb.watch')) {
			platform = 'facebook';
		} else if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) {
			platform = 'tiktok';
		} else if (url.includes('youtube.com') || url.includes('youtu.be')) {
			platform = 'youtube';
		} else if (url.includes('instagram.com')) {
			platform = 'instagram';
		} else if (url.includes('twitter.com') || url.includes('x.com')) {
			platform = 'twitter';
		} else if (url.includes('twitch.tv')) {
			platform = 'twitch';
		} else if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
			platform = 'dailymotion';
			console.warn('PERINGATAN: Untuk video Dailymotion, sebaiknya metadata dihapus untuk menghindari masalah DRM');
		} else {
			throw new Error('Platform tidak didukung');
		}

		// Jalankan yt-dlp untuk mendapatkan informasi video
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			url
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		const videoInfo = JSON.parse(output);

		res.json({
			status: 'success',
			platform,
			owner: videoInfo.uploader || videoInfo.channel || '',
			displayUrl: videoInfo.thumbnail || '',
			caption: videoInfo.description || '',
			title: videoInfo.title || '',
			duration: videoInfo.duration || 0,
			totalViews: videoInfo.view_count || 0,
			postUrl: url,
			dataFormats: [{
				dataDownload: videoInfo.url,
				format: videoInfo.format || '720p',
				ext: videoInfo.ext || 'mp4',
				filesize: videoInfo.filesize || 0
			}]
		});
	} catch (error) {
		console.error('Error saat mendeteksi platform:', error);
		res.json({ 
			status: "error", 
			message: error.message 
		});
	}
});

// Endpoint untuk mengunduh video Instagram
router.post("/instagram/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengakses URL Instagram:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			url
		] : [
			'--no-check-certificates',
			'--no-warnings',
			'--format', 'best',
			'--output', '-',
			url
		];

		const process = spawn('yt-dlp', ytDlpOptions);
		let buffer = Buffer.alloc(0);

		process.stdout.on('data', (chunk) => {
			buffer = Buffer.concat([buffer, chunk]);
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) resolve();
				else reject(new Error('Gagal mengunduh konten'));
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn(FFMPEG_PATH, [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);

				res.setHeader('Content-Type', 'audio/mpeg');
				res.setHeader('Content-Disposition', `attachment; filename=audio_instagram_${Date.now()}.mp3`);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata dari video...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}

			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', `attachment; filename=video_instagram_${mute ? 'mute_' : ''}${Date.now()}.mp4`);
		}

		res.send(buffer);
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({
			status: "error",
			message: error.message
		});
	}
});

router.post("/:platform/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		const platform = req.params.platform;
		console.log(`Mencoba mengunduh dari ${platform}:`, url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		if (!url) {
			throw new Error('URL tidak boleh kosong');
		}

		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		let processedUrl = url;
		if (platform === 'youtube') {
			if (url.includes('youtu.be/')) {
				const videoId = url.split('youtu.be/')[1].split('?')[0];
				processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
			} else if (url.includes('youtube.com/shorts/')) {
				const videoId = url.split('shorts/')[1].split('?')[0];
				processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
			}
		}

		const ytDlpOptions = [
			'--format', audioOnly ? 'bestaudio' : 'bestvideo+bestaudio/best',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', FFMPEG_PATH,
			processedUrl
		];

		const process = spawn(YT_DLP_PATH, ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		// Proses file sesuai dengan opsi yang dipilih
		if (audioOnly) {
			console.log('Mengekstrak dan memproses audio...');
			buffer = await extractAudio(buffer);
			
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_${platform}_${Date.now()}.mp3`);
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}

			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', `attachment; filename=video_${platform}_${Date.now()}.mp4`);
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mengunduh video Twitter
router.post("/twitter/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh dari Twitter:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Konversi URL x.com ke twitter.com jika diperlukan
		let processedUrl = url;
		if (url.includes('x.com')) {
			processedUrl = url.replace('x.com', 'twitter.com');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_twitter_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://twitter.com/',
			processedUrl
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://twitter.com/',
			processedUrl
		];

		// Jalankan yt-dlp
		const process = spawn('yt-dlp', ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn('ffmpeg', [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mengunduh video Twitch
router.post("/twitch/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh dari Twitch:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_twitch_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.twitch.tv/',
			url
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.twitch.tv/',
			url
		];

		// Jalankan yt-dlp
		const process = spawn('yt-dlp', ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn('ffmpeg', [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

// Endpoint untuk mengunduh video Dailymotion
router.post("/dailymotion/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true, audioOnly = false } = req.body;
		console.log('Mencoba mengunduh dari Dailymotion:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);
		console.log('Status audioOnly:', audioOnly);

		// Validasi kombinasi opsi yang tidak valid
		if (audioOnly && mute) {
			throw new Error('Tidak bisa mengaktifkan mute saat mode audio aktif');
		}

		// Set header sesuai dengan tipe konten
		if (audioOnly) {
			res.setHeader('Content-Type', 'audio/mpeg');
			res.setHeader('Content-Disposition', `attachment; filename=audio_dailymotion_${Date.now()}.mp3`);
		} else {
			res.setHeader('Content-Type', 'video/mp4');
			res.setHeader('Content-Disposition', 'attachment');
		}

		// Opsi yt-dlp berdasarkan tipe konten
		const ytDlpOptions = audioOnly ? [
			'--extract-audio',
			'--audio-format', 'mp3',
			'--audio-quality', '0',
			'--postprocessor-args', '-ar 44100',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.dailymotion.com/',
			url
		] : [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.dailymotion.com/',
			url
		];

		// Jalankan yt-dlp
		const process = spawn('yt-dlp', ytDlpOptions);
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error(`yt-dlp error: ${data}`);
		});

		process.on('error', (error) => {
			console.error('Process error:', error);
			if (!res.headersSent) {
				res.status(500).json({ 
					status: "error", 
					message: `Error saat menjalankan yt-dlp: ${error.message}` 
				});
			}
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
				}
			});
		});

		if (audioOnly) {
			// Proses audio dengan ffmpeg untuk kualitas terbaik
			const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp3`);
			const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

			try {
				fs.writeFileSync(tempInput, buffer);
				
				const ffmpeg = spawn('ffmpeg', [
					'-i', tempInput,
					'-vn',
					'-acodec', 'libmp3lame',
					'-ab', '320k',
					'-ar', '44100',
					'-y',
					tempOutput
				]);

				await new Promise((resolve, reject) => {
					ffmpeg.on('close', (code) => {
						if (code === 0) resolve();
						else reject(new Error('Gagal memproses audio'));
					});
				});

				buffer = fs.readFileSync(tempOutput);
				fs.unlinkSync(tempInput);
				fs.unlinkSync(tempOutput);
			} catch (error) {
				console.error('Error saat memproses audio:', error);
				throw error;
			}
		} else {
			if (shouldRemoveMetadata) {
				console.log('Menghapus metadata...');
				buffer = await removeMetadata(buffer);
			}

			if (mute) {
				console.log('Menghapus audio dari video...');
				buffer = await removeAudio(buffer);
			}
		}

		// Kirim file
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

module.exports = router;

