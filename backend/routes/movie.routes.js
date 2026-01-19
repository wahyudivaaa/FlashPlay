const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movie.controller');

// Get featured movie for hero section
router.get('/featured', movieController.getFeaturedMovie);

// Get popular movies
router.get('/popular', movieController.getPopularMovies);

// Get trending movies
router.get('/trending', movieController.getTrendingMovies);

// Get top rated movies
router.get('/top-rated', movieController.getTopRatedMovies);

// Get upcoming movies
router.get('/upcoming', movieController.getUpcomingMovies);

// Search movies
router.get('/search', movieController.searchMovies);

// Get movie trailer
router.get('/:id/videos', movieController.getMovieTrailer);

// Get movies by category
router.get('/category/:categoryId', movieController.getMoviesByCategory);

// Get movie details
router.get('/:id', movieController.getMovieDetails);

module.exports = router; 