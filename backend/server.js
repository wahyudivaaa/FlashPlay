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
app.use('/api/rebahin', require('./routes/rebahin.routes'));
app.use('/api/proxy/vidlink', require('./routes/proxy.routes'));
app.use('/api/embed', require('./routes/embed-proxy.routes'));

// AI Recommender Route
app.post('/api/recommend', async (req, res) => {
    try {
        const { mood } = req.body;
        if (!mood) return res.status(400).json({ error: "Mood is required" });
        
        const aiRecommender = require('./services/ai-recommender.service');
        const recommendations = await aiRecommender.getRecommendations(mood);
        
        res.json(recommendations);
    } catch (error) {
        console.error("Recommender Error:", error);
        res.status(500).json({ error: "Failed to get recommendations" });
    }
});

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

// Export app for Vercel
module.exports = app;

// Only run listen if not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
} 