const express = require('express');
const cors = require('cors');
const movieRoutes = require('./routes/movie.routes');

const app = express();
const PORT = process.env.PORT || 5001;

// Tambahkan error handling untuk CORS
app.use(cors({
    origin: ['http://localhost:8888', 'http://localhost:5001', 'http://127.0.0.1:8888'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

app.use('/api/movies', movieRoutes);

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