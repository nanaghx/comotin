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
    max: 10, // maksimal 10 request per windowMs
    message: {
        status: 'error',
        message: 'Anda telah mencapai batas maksimal request (10 request per 15 menit). Silakan coba lagi dalam beberapa menit.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (_, res) => {
        res.status(429).json({
            status: 'error',
            message: 'Anda telah mencapai batas maksimal request (10 request per 15 menit). Silakan coba lagi dalam beberapa menit.',
            remainingRequests: 0,
            resetTime: res.getHeader('RateLimit-Reset')
        });
    }
});

// Middleware untuk menambahkan informasi rate limit ke response
app.use((req, res, next) => {
    res.on('finish', () => {
        const remaining = res.getHeader('RateLimit-Remaining');
        const limit = res.getHeader('RateLimit-Limit');
        const reset = res.getHeader('RateLimit-Reset');
        
        if (remaining !== undefined) {
            res.setHeader('X-Remaining-Requests', remaining);
            res.setHeader('X-Total-Limit', limit);
            res.setHeader('X-Reset-Time', reset);
        }
    });
    next();
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
app.use(express.urlencoded({ extended: true }));

// Terapkan rate limiting ke semua route
app.use(limiter);

app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', downloaderRouter);

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
