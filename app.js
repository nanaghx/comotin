const express = require('express');
const cors = require('cors');
const path = require('path');
const downloaderRouter = require('./routes/downloader');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 20, // Maksimal 20 request per IP dalam 15 menit
    message: {
        status: 'error',
        message: 'Terlalu banyak request, silakan coba lagi dalam beberapa menit'
    },
    standardHeaders: true, // Mengembalikan header rate limit info
    legacyHeaders: false, // Menonaktifkan header rate limit legacy
});

// Konfigurasi CORS - Mengizinkan akses dari semua domain
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false // Diubah menjadi false karena menggunakan origin: '*'
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    });
    next();
});

// Terapkan rate limiting ke semua route API
app.use('/api', limiter);

// Routes
app.use('/api', downloaderRouter);

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling untuk route yang tidak ditemukan
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Route tidak ditemukan'
    });
});

// Error handling umum
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Data tidak valid',
            details: err.message
        });
    }
    
    if (err.name === 'RateLimitError') {
        return res.status(429).json({
            status: 'error',
            message: 'Terlalu banyak request',
            details: err.message
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Terjadi kesalahan internal server'
    });
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
