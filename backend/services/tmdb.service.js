const fetch = require('node-fetch');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class TMDBService {
    async getFeaturedMovie() {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`
        );
        const data = await response.json();
        return data.results[0];
    }

    async getPopularMovies(page = 1) {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
        );
        return await response.json();
    }

    async searchMovies(query) {
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}`
        );
        return await response.json();
    }

    async getTrendingMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getTopRatedMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getUpcomingMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getTrendingMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getTopRatedMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getUpcomingMovies() {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getMovieTrailer(movieId) {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`
        );
        const data = await response.json();
        return data.results.find(video => video.type === 'Trailer');
    }

    async getMoviesByCategory(categoryId, page = 1) {
        const response = await fetch(
            `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${categoryId}&page=${page}`
        );
        return await response.json();
    }

    async getMovieDetails(movieId) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,similar,watch/providers`
            );
            const data = await response.json();
            
            if (data.success === false) {
                throw new Error('Movie not found');
            }
            
            return {
                id: data.id,
                title: data.title,
                overview: data.overview,
                release_date: data.release_date,
                runtime: data.runtime,
                vote_average: data.vote_average,
                vote_count: data.vote_count,
                genres: data.genres,
                poster_path: data.poster_path,
                backdrop_path: data.backdrop_path,
                budget: data.budget,
                revenue: data.revenue,
                status: data.status,
                tagline: data.tagline,
                cast: data.credits?.cast?.slice(0, 10) || [],
                crew: data.credits?.crew?.slice(0, 5) || [],
                videos: data.videos?.results || [],
                similar: data.similar?.results?.slice(0, 6) || [],
                watch_providers: data['watch/providers']?.results || {}
            };
        } catch (error) {
            throw new Error(`Error fetching movie details: ${error.message}`);
        }
    }

    async getMovieVideos(movieId) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`
            );
            const data = await response.json();
            
            if (data.success === false) {
                throw new Error('Videos not found');
            }
            
            return data;
        } catch (error) {
            throw new Error(`Error fetching movie videos: ${error.message}`);
        }
    }
}

module.exports = new TMDBService(); 