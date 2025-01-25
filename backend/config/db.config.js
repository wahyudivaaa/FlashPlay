require('dotenv').config();

module.exports = {
    TMDB_API_KEY: process.env.TMDB_API_KEY || '3f422bab4df034e4d74d11ecec68fc1a',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3'
}; 