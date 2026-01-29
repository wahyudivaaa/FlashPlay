/**
 * Rebahin21 Routes
 * API endpoints untuk integrasi Rebahin21 streaming
 */

const express = require('express');
const router = express.Router();
const rebahinService = require('../services/rebahin-service');

// TMDB API untuk mendapatkan title dari ID
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Helper: Fetch movie title from TMDB
 */
async function getMovieTitle(tmdbId) {
    try {
        const fetch = require('node-fetch');
        const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=id-ID`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Fallback ke English
            const urlEn = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
            const responseEn = await fetch(urlEn);
            if (!responseEn.ok) return null;
            const data = await responseEn.json();
            return {
                title: data.title,
                year: data.release_date ? data.release_date.substring(0, 4) : null
            };
        }
        
        const data = await response.json();
        return {
            title: data.title,
            year: data.release_date ? data.release_date.substring(0, 4) : null
        };
    } catch (error) {
        console.error('[Rebahin Routes] Error fetching movie title:', error);
        return null;
    }
}

/**
 * Helper: Fetch series title from TMDB
 */
async function getSeriesTitle(tmdbId) {
    try {
        const fetch = require('node-fetch');
        const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=id-ID`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Fallback ke English
            const urlEn = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
            const responseEn = await fetch(urlEn);
            if (!responseEn.ok) return null;
            const data = await responseEn.json();
            return {
                title: data.name,
                year: data.first_air_date ? data.first_air_date.substring(0, 4) : null
            };
        }
        
        const data = await response.json();
        return {
            title: data.name,
            year: data.first_air_date ? data.first_air_date.substring(0, 4) : null
        };
    } catch (error) {
        console.error('[Rebahin Routes] Error fetching series title:', error);
        return null;
    }
}

/**
 * GET /api/rebahin/movie/:tmdbId
 * Get Rebahin21 player URL for a movie
 */
router.get('/movie/:tmdbId', async (req, res) => {
    const { tmdbId } = req.params;
    
    console.log(`[Rebahin API] Movie request: ${tmdbId}`);
    
    try {
        // First, get movie title from TMDB
        const movieInfo = await getMovieTitle(tmdbId);
        
        if (!movieInfo || !movieInfo.title) {
            return res.status(404).json({
                success: false,
                error: 'Movie not found in TMDB'
            });
        }
        
        console.log(`[Rebahin API] Searching for: ${movieInfo.title} (${movieInfo.year})`);
        
        // Get player URL from Rebahin
        const result = await rebahinService.getMoviePlayer(
            tmdbId, 
            movieInfo.title, 
            movieInfo.year
        );
        
        if (result.success) {
            res.json({
                success: true,
                playerUrl: result.playerUrl,
                sourcesId: result.sourcesId,
                title: result.title
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error || 'Content not found on Rebahin21'
            });
        }
        
    } catch (error) {
        console.error('[Rebahin API] Movie error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * GET /api/rebahin/series/:tmdbId/:season/:episode
 * Get Rebahin21 player URL for a series episode
 */
router.get('/series/:tmdbId/:season/:episode', async (req, res) => {
    const { tmdbId, season, episode } = req.params;
    
    console.log(`[Rebahin API] Series request: ${tmdbId} S${season}E${episode}`);
    
    try {
        // Get series title from TMDB
        const seriesInfo = await getSeriesTitle(tmdbId);
        
        if (!seriesInfo || !seriesInfo.title) {
            return res.status(404).json({
                success: false,
                error: 'Series not found in TMDB'
            });
        }
        
        console.log(`[Rebahin API] Searching for: ${seriesInfo.title}`);
        
        // Get player URL from Rebahin
        const result = await rebahinService.getSeriesPlayer(
            tmdbId,
            seriesInfo.title,
            parseInt(season),
            parseInt(episode)
        );
        
        if (result.success) {
            res.json({
                success: true,
                playerUrl: result.playerUrl,
                sourcesId: result.sourcesId,
                season: result.season,
                episode: result.episode
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error || 'Content not found on Rebahin21'
            });
        }
        
    } catch (error) {
        console.error('[Rebahin API] Series error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * GET /api/rebahin/search
 * Direct search on Rebahin21
 */
router.get('/search', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({
            success: false,
            error: 'Query parameter "q" is required'
        });
    }
    
    try {
        const result = await rebahinService.search(q);
        res.json(result);
    } catch (error) {
        console.error('[Rebahin API] Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

/**
 * GET /api/rebahin/health
 * Health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'rebahin21',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
