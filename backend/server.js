require('dotenv').config();

const express = require('express');
const cors = require('cors');
const movieRoutes = require('./routes/movie.routes');
const seriesRoutes = require('./routes/series.routes');
const streamRoutes = require('./routes/stream.routes');

const app = express();
const PORT = process.env.PORT || 5001;

// Tambahkan error handling untuk CORS
app.use(cors({
    origin: true, // Allow all origins for dev simplicity
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl} | Origin: ${req.get('origin')}`);
    next();
});

app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

const path = require('path');

app.use('/api/movies', movieRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/proxy/vidlink', require('./routes/proxy.routes'));
app.use('/api/embed', require('./routes/embed-proxy.routes'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle all other routes by serving index.html (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 