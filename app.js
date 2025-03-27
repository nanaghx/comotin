const express = require('express');
const cors = require('cors');
const path = require('path');
const downloaderRouter = require('./routes/downloader');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Daftar domain yang diizinkan
        const whitelist = [
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080'
        ];
        
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS policy'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
};

// Konfigurasi Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // Maksimal 100 request per IP
    message: {
        status: 'error',
        message: 'Terlalu banyak request dari IP ini, silakan coba lagi setelah 15 menit'
    }
});

// Middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', downloaderRouter);

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling untuk CORS
app.use((err, req, res, next) => {
    if (err.message === 'Blocked by CORS policy') {
        res.status(403).json({
            status: 'error',
            message: 'Domain Anda tidak diizinkan mengakses API ini. Silakan hubungi administrator untuk mendapatkan akses.'
        });
    } else {
        next(err);
    }
});

// Error handling umum
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan internal server'
    });
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
