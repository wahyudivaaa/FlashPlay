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
 * Returns both original_title and localized title for better search matching
 */
async function getMovieTitle(tmdbId) {
    try {
        const fetch = require('node-fetch');
        // Fetch without language to get original data
        const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('[Rebahin Routes] TMDB request failed:', response.status);
            return null;
        }
        
        const data = await response.json();
        
        // Return both original_title and title for multiple search attempts
        return {
            originalTitle: data.original_title, // Original language title (Korean, Thai, etc)
            title: data.title,                   // English title
            year: data.release_date ? data.release_date.substring(0, 4) : null
        };
    } catch (error) {
        console.error('[Rebahin Routes] Error fetching movie title:', error);
        return null;
    }
}

/**
 * Helper: Fetch series title from TMDB
 * Returns both original_name and localized name for better search matching
 */
async function getSeriesTitle(tmdbId) {
    try {
        const fetch = require('node-fetch');
        // Fetch without language to get original data
        const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('[Rebahin Routes] TMDB TV request failed:', response.status);
            return null;
        }
        
        const data = await response.json();
        
        // Return both original_name and name for multiple search attempts
        return {
            originalTitle: data.original_name, // Original language title
            title: data.name,                   // English title
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
 * Uses multiple search strategies: original title first, then English title
 */
router.get('/movie/:tmdbId', async (req, res) => {
    const { tmdbId } = req.params;
    
    console.log(`[Rebahin API] Movie request: ${tmdbId}`);
    
    try {
        // First, get movie title from TMDB
        const movieInfo = await getMovieTitle(tmdbId);
        
        if (!movieInfo || (!movieInfo.title && !movieInfo.originalTitle)) {
            return res.status(404).json({
                success: false,
                error: 'Movie not found in TMDB'
            });
        }
        
        // Search strategies - try multiple titles
        const searchStrategies = [];
        
        // Strategy 1: Original title (Korean, Thai, etc) - most likely to match Rebahin
        if (movieInfo.originalTitle) {
            searchStrategies.push(movieInfo.originalTitle);
        }
        
        // Strategy 2: English title
        if (movieInfo.title && movieInfo.title !== movieInfo.originalTitle) {
            searchStrategies.push(movieInfo.title);
        }
        
        // Strategy 3: Original title without year (some Rebahin entries have different year)
        // Strategy 4: Just first part of title (before : or -)
        if (movieInfo.originalTitle && movieInfo.originalTitle.includes(':')) {
            searchStrategies.push(movieInfo.originalTitle.split(':')[0].trim());
        }
        if (movieInfo.title && movieInfo.title.includes(':')) {
            searchStrategies.push(movieInfo.title.split(':')[0].trim());
        }
        
        console.log(`[Rebahin API] Search strategies:`, searchStrategies);
        
        // Try each search strategy
        let result = null;
        for (const searchTitle of searchStrategies) {
            console.log(`[Rebahin API] Trying: "${searchTitle}" (${movieInfo.year})`);
            
            result = await rebahinService.getMoviePlayer(
                tmdbId, 
                searchTitle, 
                movieInfo.year
            );
            
            if (result.success) {
                console.log(`[Rebahin API] Found with: "${searchTitle}"`);
                break;
            }
        }
        
        if (result && result.success) {
            res.json({
                success: true,
                playerUrl: result.playerUrl,
                sourcesId: result.sourcesId,
                title: result.title
            });
        } else {
            res.status(404).json({
                success: false,
                error: result?.error || 'Content not found on Rebahin21'
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
 * Uses multiple search strategies: original title first, then English title
 */
router.get('/series/:tmdbId/:season/:episode', async (req, res) => {
    const { tmdbId, season, episode } = req.params;
    
    console.log(`[Rebahin API] Series request: ${tmdbId} S${season}E${episode}`);
    
    try {
        // Get series title from TMDB
        const seriesInfo = await getSeriesTitle(tmdbId);
        
        if (!seriesInfo || (!seriesInfo.title && !seriesInfo.originalTitle)) {
            return res.status(404).json({
                success: false,
                error: 'Series not found in TMDB'
            });
        }
        
        // Search strategies - try multiple titles
        const searchStrategies = [];
        
        // Strategy 1: Original title
        if (seriesInfo.originalTitle) {
            searchStrategies.push(seriesInfo.originalTitle);
        }
        
        // Strategy 2: English title
        if (seriesInfo.title && seriesInfo.title !== seriesInfo.originalTitle) {
            searchStrategies.push(seriesInfo.title);
        }
        
        // Strategy 3: Partial title (before : or -)
        if (seriesInfo.originalTitle && seriesInfo.originalTitle.includes(':')) {
            searchStrategies.push(seriesInfo.originalTitle.split(':')[0].trim());
        }
        if (seriesInfo.title && seriesInfo.title.includes(':')) {
            searchStrategies.push(seriesInfo.title.split(':')[0].trim());
        }
        
        console.log(`[Rebahin API] Series search strategies:`, searchStrategies);
        
        // Try each search strategy
        let result = null;
        for (const searchTitle of searchStrategies) {
            console.log(`[Rebahin API] Trying series: "${searchTitle}"`);
            
            result = await rebahinService.getSeriesPlayer(
                tmdbId,
                searchTitle,
                parseInt(season),
                parseInt(episode)
            );
            
            if (result.success) {
                console.log(`[Rebahin API] Found series with: "${searchTitle}"`);
                break;
            }
        }
        
        if (result && result.success) {
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
                error: result?.error || 'Content not found on Rebahin21'
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
