const fetch = require('node-fetch');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class TMDBService {
    constructor() {
        if (!TMDB_API_KEY) {
            console.error('[TMDB] ERROR: TMDB_API_KEY is missing in environment variables!');
        }
    }

    async fetchTMDB(endpoint, params = {}) {
        if (!TMDB_API_KEY) {
            throw new Error('TMDB_API_KEY configuration missing');
        }

        const queryParams = new URLSearchParams({
            api_key: TMDB_API_KEY,
            ...params
        });

        const url = `${TMDB_BASE_URL}${endpoint}?${queryParams}`;
        // console.log(`[TMDB] Fetching: ${url}`); // Uncomment for debug

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[TMDB] API Error (${response.status}): ${errorText}`);
                throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[TMDB] Fetch failed: ${error.message}`);
            throw error;
        }
    }

    async getFeaturedMovie() {
        const data = await this.fetchTMDB('/movie/popular');
        return data.results[0];
    }

    async getPopularMovies(page = 1) {
        return await this.fetchTMDB('/movie/popular', { page });
    }

    async searchMovies(query) {
        return await this.fetchTMDB('/search/movie', { query });
    }

    async getTrendingMovies() {
        return await this.fetchTMDB('/trending/movie/week');
    }

    async getTopRatedMovies() {
        return await this.fetchTMDB('/movie/top_rated');
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
    async getMovieGeneric(endpoint, params = {}) {
        const queryParams = new URLSearchParams({
            api_key: TMDB_API_KEY,
            ...params
        });
        const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${queryParams}`);
        return await response.json();
    }

    // TV SERIES METHODS
    async getPopularSeries(page = 1) {
        const response = await fetch(
            `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=${page}`
        );
        return await response.json();
    }

    async getTopRatedSeries(page = 1) {
        const response = await fetch(
            `${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}&page=${page}`
        );
        return await response.json();
    }

    async getTrendingSeries() {
        const response = await fetch(
            `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`
        );
        return await response.json();
    }

    async getSeriesDetails(id) {
        const response = await fetch(
            `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits,similar,recommendations,watch/providers`
        );
        return await response.json();
    }

    async searchSeries(query) {
        const response = await fetch(
            `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${query}`
        );
        return await response.json();
    }
    async getSeriesVideos(id) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/tv/${id}/videos?api_key=${TMDB_API_KEY}`
            );
            const data = await response.json();
            
            if (data.success === false) {
                 // TMDB might return success:false or just empty results
                 throw new Error('Videos not found');
            }
            return data;
        } catch (error) {
            throw new Error(`Error fetching series videos: ${error.message}`);
        }
    }

    async getSeriesSeasonDetails(id, seasonNumber) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
            );
            const data = await response.json();
            if (data.success === false) throw new Error(data.status_message);
            return data;
        } catch (error) {
           throw new Error(`Error fetching season details: ${error.message}`);
        }
    }
}

module.exports = new TMDBService(); 