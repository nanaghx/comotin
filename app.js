const express = require('express');
const cors = require('cors');
const path = require('path');
const downloaderRouter = require('./routes/downloader');

const app = express();
const port = process.env.PORT || 3000;

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
