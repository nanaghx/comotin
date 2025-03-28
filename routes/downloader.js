const axios = require("axios");
const router = require("express").Router();
const YTDlpWrap = require("yt-dlp-wrap").default;
const tiktokScraper = require("tiktok-scraper");
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ytDlp = new YTDlpWrap();

// Konfigurasi Puppeteer untuk menggunakan Chromium sistem
const puppeteerConfig = {
	executablePath: '/usr/bin/chromium-browser',
	args: ['--no-sandbox', '--disable-setuid-sandbox']
};

function toSupportedFormat(url) {
	if (url.includes("list=")) {
		const playlistId = url.substring(url.indexOf("list=") + 5);

		return `https://www.youtube.com/playlist?list=${playlistId}`;
	}

	return url;
}

// Fungsi untuk menghapus metadata menggunakan ffmpeg
async function removeMetadata(inputBuffer) {
	return new Promise((resolve, reject) => {
		const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
		const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

		try {
			// Tulis buffer ke file temporary
			fs.writeFileSync(tempInput, inputBuffer);
			console.log('File input dibuat:', tempInput);

			// Jalankan ffmpeg untuk menghapus metadata
			const ffmpeg = spawn('/usr/bin/ffmpeg', [
				'-i', tempInput,
				'-map_metadata', '-1',
				'-c:v', 'copy',
				'-c:a', 'copy',
				'-y',
				tempOutput
			]);

			let ffmpegOutput = '';

			ffmpeg.stderr.on('data', (data) => {
				ffmpegOutput += data.toString();
				console.log('ffmpeg:', data.toString());
			});

			ffmpeg.on('close', (code) => {
				// Hapus file temporary input
				try {
					fs.unlinkSync(tempInput);
					console.log('File input dihapus');
				} catch (err) {
					console.error('Error menghapus file input:', err);
				}

				if (code === 0) {
					try {
						const outputBuffer = fs.readFileSync(tempOutput);
						fs.unlinkSync(tempOutput);
						console.log('File output dihapus');
						resolve(outputBuffer);
					} catch (err) {
						reject(new Error('Error membaca file output: ' + err.message));
					}
				} else {
					// Hapus file output jika ada error
					try {
						if (fs.existsSync(tempOutput)) {
							fs.unlinkSync(tempOutput);
						}
					} catch (err) {
						console.error('Error menghapus file output:', err);
					}
					reject(new Error('ffmpeg gagal dengan kode ' + code + ': ' + ffmpegOutput));
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

// Fungsi untuk menghapus audio menggunakan ffmpeg
async function removeAudio(inputBuffer) {
	return new Promise((resolve, reject) => {
		// Buat file temporary untuk input
		const tempInput = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
		const tempOutput = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

		// Tulis buffer ke file temporary
		fs.writeFileSync(tempInput, inputBuffer);

		console.log('Memulai proses penghapusan audio dengan ffmpeg...');

		// Jalankan ffmpeg untuk menghapus audio
		const ffmpeg = spawn('ffmpeg', [
			'-i', tempInput,
			'-c:v', 'copy',
			'-an',  // Menghapus semua track audio
			'-map', '0:v:0',  // Hanya mengambil track video
			'-map_metadata', '-1',  // Hapus metadata
			'-y',  // Overwrite output file
			tempOutput
		]);

		let errorOutput = '';

		ffmpeg.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.log('ffmpeg output:', data.toString());
		});

		ffmpeg.on('close', (code) => {
			console.log('ffmpeg process closed with code:', code);
			
			// Hapus file temporary input
			try {
				fs.unlinkSync(tempInput);
			} catch (error) {
				console.error('Error deleting input file:', error);
			}

			if (code === 0) {
				try {
					// Baca file output
					const outputBuffer = fs.readFileSync(tempOutput);
					// Hapus file temporary output
					fs.unlinkSync(tempOutput);
					console.log('Audio berhasil dihapus dan file output dibuat');
					resolve(outputBuffer);
				} catch (error) {
					console.error('Error reading output file:', error);
					reject(error);
				}
			} else {
				// Hapus file temporary output jika ada
				if (fs.existsSync(tempOutput)) {
					try {
						fs.unlinkSync(tempOutput);
					} catch (error) {
						console.error('Error deleting output file:', error);
					}
				}
				reject(new Error(`ffmpeg process failed with code ${code}: ${errorOutput}`));
			}
		});
	});
}

router.post("/instagram", async (req, res) => {
	try {
		const url_post = req.body.url;
		console.log('Mencoba mengakses URL Instagram:', url_post);

		// Jalankan yt-dlp sebagai proses terpisah
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
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
						filesize: format.filesize || null
					});
				}
			});
		}

		console.log('Data berhasil diekstrak');
		res.json(response);
	} catch (error) {
		console.error('Error saat mengambil data Instagram:', error);
		res.json({ status: "error", details: error.message });
	}
});

router.post("/youtube", async (req, res) => {
	try {
		const { url } = req.body;
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
		res.json({ status: "error", details: error.message });
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
		const { url, mute = false, shouldRemoveMetadata = true } = req.body;
		console.log('Mencoba mengunduh video YouTube:', url);
		console.log('Status mute:', mute);
		console.log('Status shouldRemoveMetadata:', shouldRemoveMetadata);

		// Set header untuk download
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', 'attachment');

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			url
		]);

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

		// Hapus metadata dari video jika opsi diaktifkan
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			try {
				buffer = await removeMetadata(buffer);
				console.log('Metadata berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus metadata:', error);
				// Lanjutkan tanpa menghapus metadata jika terjadi error
			}
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Kirim data ke client
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data video yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh video YouTube:', error);
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
		const { url, mute = false, shouldRemoveMetadata = true } = req.body;
		console.log('Mencoba mengakses URL TikTok:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

		// Set header untuk download
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', 'attachment');

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://www.tiktok.com/',
			url
		]);

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

		// Hapus metadata dari video jika opsi diaktifkan
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			try {
				buffer = await removeMetadata(buffer);
				console.log('Metadata berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus metadata:', error);
				// Lanjutkan tanpa menghapus metadata jika terjadi error
			}
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Kirim data ke client
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data video yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh video TikTok:', error);
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
		const { url, mute = false, shouldRemoveMetadata = true } = req.body;
		console.log('Mencoba mengunduh video Facebook:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

		// Set header untuk download
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', 'attachment');

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
			'--format', 'best[ext=mp4]',
			'--output', '-',
			'--no-check-certificates',
			'--no-warnings',
			'--no-playlist',
			'--no-part',
			'--ffmpeg-location', '/opt/homebrew/bin/ffmpeg',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			url
		]);

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

		// Hapus metadata dari video jika opsi diaktifkan
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			try {
				buffer = await removeMetadata(buffer);
				console.log('Metadata berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus metadata:', error);
			}
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Kirim data ke client
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data video yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh video Facebook:', error);
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

		let platform = '';
		let endpoint = '';

		// Deteksi platform berdasarkan URL
		if (url.includes('facebook.com') || url.includes('fb.watch')) {
			platform = 'facebook';
			endpoint = '/api/facebook';
		} else if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) {
			platform = 'tiktok';
			endpoint = '/api/tiktok';
		} else if (url.includes('youtube.com') || url.includes('youtu.be')) {
			platform = 'youtube';
			endpoint = '/api/youtube';
		} else if (url.includes('instagram.com')) {
			platform = 'instagram';
			endpoint = '/api/instagram';
		} else if (url.includes('twitter.com') || url.includes('x.com')) {
			platform = 'twitter';
			endpoint = '/api/twitter';
		} else if (url.includes('twitch.tv')) {
			platform = 'twitch';
			endpoint = '/api/twitch';
		} else if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
			platform = 'dailymotion';
			endpoint = '/api/dailymotion';
			// Tambahkan peringatan untuk Dailymotion
			console.warn('PERINGATAN: Untuk video Dailymotion, sebaiknya metadata dihapus untuk menghindari masalah DRM');
		} else {
			throw new Error('Platform tidak didukung');
		}

		// Panggil endpoint yang sesuai
		const response = await fetch(`http://localhost:3000${endpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url })
		});

		const data = await response.json();

		if (data.status === 'success') {
			// Tambahkan informasi platform ke response
			data.platform = platform;
			res.json(data);
		} else {
			throw new Error(data.message || 'Gagal mengambil informasi video');
		}
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
		const { url, mute, shouldRemoveMetadata } = req.body;
		console.log('Mencoba mengakses URL Instagram:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

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

		// Download video
		const downloadProcess = spawn('yt-dlp', [
			'--no-check-certificates',
			'--no-warnings',
			'--format', 'best',
			'--output', '-',
			url
		]);

		let videoBuffer = Buffer.alloc(0);
		downloadProcess.stdout.on('data', (chunk) => {
			videoBuffer = Buffer.concat([videoBuffer, chunk]);
		});

		await new Promise((resolve, reject) => {
			downloadProcess.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error('Gagal mengunduh video'));
				}
			});
		});

		let finalBuffer = videoBuffer;

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			finalBuffer = await removeAudio(finalBuffer);
		}

		// Hapus metadata jika diminta
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata dari video...');
			finalBuffer = await removeMetadata(finalBuffer);
		}

		// Set header response
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', `attachment; filename="video_instagram${mute ? '_mute' : ''}.mp4"`);
		res.send(finalBuffer);
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
		const { url, mute = false, shouldRemoveMetadata = true, format = 'video' } = req.body;
		const platform = req.params.platform;
		console.log(`Mencoba mengunduh dari ${platform}:`, url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

		// Konversi URL mobile ke format desktop untuk YouTube
		let processedUrl = url;
		if (platform === 'youtube' && url.includes('youtu.be/')) {
			const videoId = url.split('youtu.be/')[1].split('?')[0];
			processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
		} else if (platform === 'youtube' && url.includes('youtube.com/shorts/')) {
			const videoId = url.split('shorts/')[1].split('?')[0];
			processedUrl = `https://www.youtube.com/watch?v=${videoId}`;
		}

		// Buat array opsi yt-dlp
		const ytDlpOptions = [
			'--no-check-certificates',
			'--no-warnings',
			'--output', '-'
		];

		// Jika format audio diminta
		if (format === 'audio') {
			ytDlpOptions.push('--extract-audio', '--audio-format', 'mp3');
		} else {
			// Format normal dengan video dan audio
			ytDlpOptions.push('--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4');
		}

		// Tambahkan URL ke opsi
		ytDlpOptions.push(processedUrl);

		// Jalankan yt-dlp
		const process = spawn('yt-dlp', ytDlpOptions);

		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);
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

		// Hapus metadata jika diminta
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			buffer = await removeMetadata(buffer);
			console.log('Metadata berhasil dihapus');
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Set header response
		res.setHeader('Content-Type', format === 'audio' ? 'audio/mpeg' : 'video/mp4');
		res.setHeader('Content-Disposition', `attachment; filename=video_${mute ? 'mute_' : ''}${platform}.mp4`);

		// Kirim file
		res.send(buffer);
	} catch (error) {
		console.error('Error saat mengunduh:', error);
		res.status(500).json({ status: "error", details: error.message });
	}
});

// Endpoint untuk mengunduh video Twitter
router.post("/twitter", async (req, res) => {
	try {
		const { url } = req.body;
		console.log('Mencoba mengakses URL Twitter:', url);

		// Konversi URL x.com ke twitter.com jika diperlukan
		let processedUrl = url;
		if (url.includes('x.com')) {
			processedUrl = url.replace('x.com', 'twitter.com');
		}
		console.log('URL yang diproses:', processedUrl);

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
			'--dump-json',
			'--no-check-certificates',
			'--no-warnings',
			'--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			'--add-header', 'Referer:https://twitter.com/',
			'--add-header', 'Cookie:auth_token=YOUR_AUTH_TOKEN',  // Tambahkan auth token jika diperlukan
			'--add-header', 'Authorization:Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',  // Twitter API Bearer Token
			processedUrl
		]);

		let output = '';
		let errorOutput = '';

		process.stdout.on('data', (data) => {
			output += data.toString();
			console.log('yt-dlp stdout:', data.toString());
		});

		process.stderr.on('data', (data) => {
			errorOutput += data.toString();
			console.error('yt-dlp stderr:', data.toString());
		});

		await new Promise((resolve, reject) => {
			process.on('close', (code) => {
				console.log('yt-dlp process closed with code:', code);
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
			postUrl: processedUrl,
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
		console.error('Error saat mengambil data Twitter:', error);
		res.json({ status: "error", details: error.message });
	}
});

// Endpoint untuk mengunduh video Twitch
router.post("/twitch/download", async (req, res) => {
	try {
		const { url, mute = false, shouldRemoveMetadata = true } = req.body;
		console.log('Mencoba mengunduh video Twitch:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

		// Set header untuk download
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', 'attachment');

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
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
		]);

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

		// Hapus metadata dari video jika opsi diaktifkan
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			try {
				buffer = await removeMetadata(buffer);
				console.log('Metadata berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus metadata:', error);
			}
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Kirim data ke client
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data video yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh video Twitch:', error);
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
		const { url, mute = false, shouldRemoveMetadata = true } = req.body;
		console.log('Mencoba mengunduh video Dailymotion:', url);
		console.log('Status mute:', mute);
		console.log('Status removeMetadata:', shouldRemoveMetadata);

		// Set header untuk download
		res.setHeader('Content-Type', 'video/mp4');
		res.setHeader('Content-Disposition', 'attachment');

		// Buat buffer untuk menyimpan data
		let buffer = Buffer.alloc(0);
		let errorOutput = '';

		// Jalankan yt-dlp dengan opsi yang lebih baik
		const process = spawn('yt-dlp', [
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
		]);

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

		// Hapus metadata dari video jika opsi diaktifkan
		if (shouldRemoveMetadata) {
			console.log('Menghapus metadata...');
			try {
				buffer = await removeMetadata(buffer);
				console.log('Metadata berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus metadata:', error);
			}
		}

		// Hapus audio jika diminta
		if (mute) {
			console.log('Menghapus audio dari video...');
			try {
				buffer = await removeAudio(buffer);
				console.log('Audio berhasil dihapus');
			} catch (error) {
				console.error('Error saat menghapus audio:', error);
				throw error;
			}
		}

		// Kirim data ke client
		if (buffer.length > 0) {
			res.setHeader('Content-Length', buffer.length);
			res.send(buffer);
		} else {
			throw new Error('Tidak ada data video yang diterima');
		}

		// Handle client disconnect
		req.on('close', () => {
			process.kill();
		});
	} catch (error) {
		console.error('Error saat mengunduh video Dailymotion:', error);
		if (!res.headersSent) {
			res.status(500).json({ 
				status: "error", 
				message: error.message 
			});
		}
	}
});

module.exports = router;
