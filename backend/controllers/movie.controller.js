const tmdbService = require('../services/tmdb.service');
const fetch = require('node-fetch');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

exports.getFeaturedMovie = async (req, res) => {
    try {
        const featuredMovie = await tmdbService.getFeaturedMovie();
        res.json(featuredMovie);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getPopularMovies = async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const movies = await tmdbService.getPopularMovies(page);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchMovies = async (req, res) => {
    try {
        const { query } = req.query;
        const movies = await tmdbService.searchMovies(query);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMovieTrailer = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Pastikan access token ada
        if (!process.env.TMDB_ACCESS_TOKEN) {
            throw new Error('TMDB Access Token is not configured');
        }

        const options = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${process.env.TMDB_ACCESS_TOKEN}`
            }
        };

        console.log('Fetching from:', `${TMDB_BASE_URL}/movie/${id}/videos`); // Debug URL
        console.log('With options:', options); // Debug options

        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${id}/videos`, 
            options
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('TMDB API Error:', errorData);
            throw new Error(`TMDB API error: ${errorData.status_message || response.statusText}`);
        }

        const data = await response.json();
        console.log('TMDB Response:', data); // Debug response

        // Filter untuk YouTube trailers
        const trailers = data.results.filter(video => 
            video.site.toLowerCase() === "youtube" && 
            video.type.toLowerCase() === "trailer"
        );

        // Jika tidak ada trailer, coba cari teaser atau video lain dari YouTube
        const videos = trailers.length > 0 ? trailers : data.results.filter(video => 
            video.site.toLowerCase() === "youtube"
        );

        if (videos.length === 0) {
            return res.status(404).json({ 
                message: 'No videos available for this movie' 
            });
        }

        res.json({ results: videos });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            message: 'Error fetching movie videos',
            error: error.message 
        });
    }
};

exports.getMoviesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1 } = req.query;
        const movies = await tmdbService.getMoviesByCategory(categoryId, page);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMovieDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const movie = await tmdbService.getMovieDetails(id);
        res.json(movie);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 