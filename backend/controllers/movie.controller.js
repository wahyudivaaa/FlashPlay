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

exports.getTrendingMovies = async (req, res) => {
    try {
        const data = await tmdbService.getTrendingMovies();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getTopRatedMovies = async (req, res) => {
    try {
        const data = await tmdbService.getTopRatedMovies();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getUpcomingMovies = async (req, res) => {
    try {
        const data = await tmdbService.getUpcomingMovies();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMovieTrailer = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await tmdbService.getMovieVideos(id);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
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