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
        // Fetch details and alternative titles in parallel
        const [detailsRes, altRes] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`),
            fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`)
        ]);
        
        if (!detailsRes.ok) {
            console.error('[Rebahin Routes] TMDB request failed:', detailsRes.status);
            return null;
        }
        
        const data = await detailsRes.json();
        
        let alternatives = [];
        if (altRes.ok) {
            const altData = await altRes.json();
            if (altData.titles) {
                // Get varied titles, prioritize Indonesian
                alternatives = altData.titles
                    .filter(t => t.title && t.title.length > 2)
                    .map(t => t.title);
            }
        }
        
        return {
            originalTitle: data.original_title,
            title: data.title,
            year: data.release_date ? data.release_date.substring(0, 4) : null,
            alternatives: [...new Set(alternatives)] // Unique
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
        // Fetch details and alternative titles
        const [detailsRes, altRes] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`),
            fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`)
        ]);
        
        if (!detailsRes.ok) {
            console.error('[Rebahin Routes] TMDB TV request failed:', detailsRes.status);
            return null;
        }
        
        const data = await detailsRes.json();

        let alternatives = [];
        if (altRes.ok) {
            const altData = await altRes.json();
            // TV endpoint uses 'results' for alternatives
            if (altData.results) {
                alternatives = altData.results
                    .filter(t => t.title && t.title.length > 2)
                    .map(t => t.title);
            }
        }
        
        return {
            originalTitle: data.original_name, // Original language title
            title: data.name,                   // English title
            year: data.first_air_date ? data.first_air_date.substring(0, 4) : null,
            alternatives: [...new Set(alternatives)]
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
        let searchStrategies = [];
        
        // Strategy 1: Original title (highest priority)
        if (movieInfo.originalTitle) {
            searchStrategies.push(movieInfo.originalTitle);
        }
        
        // Strategy 2: English title
        if (movieInfo.title) {
            searchStrategies.push(movieInfo.title);
        }
        
        // Strategy 3: Alternative titles (NEW)
        if (movieInfo.alternatives && movieInfo.alternatives.length > 0) {
            searchStrategies.push(...movieInfo.alternatives);
        }

        // Strategy 4: Partial title (for colon/hyphen separated titles)
        if (movieInfo.originalTitle && movieInfo.originalTitle.includes(':')) {
            searchStrategies.push(movieInfo.originalTitle.split(':')[0].trim());
        }
        if (movieInfo.title && movieInfo.title.includes(':')) {
            searchStrategies.push(movieInfo.title.split(':')[0].trim());
        }
        
        // Deduplicate strategies
        searchStrategies = [...new Set(searchStrategies)];
        
        console.log(`[Rebahin API] Search strategies (${searchStrategies.length}):`, searchStrategies.slice(0, 5)); // log first 5 only
        
        // Try each search strategy (limit to 7 attempts to prevent timeout)
        let result = null;
        for (const searchTitle of searchStrategies.slice(0, 7)) {
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
        let searchStrategies = [];
        
        // Strategy 1: Original title
        if (seriesInfo.originalTitle) {
            searchStrategies.push(seriesInfo.originalTitle);
        }
        
        // Strategy 2: English title
        if (seriesInfo.title) {
            searchStrategies.push(seriesInfo.title);
        }
        
        // Strategy 3: Alternative titles (NEW)
        if (seriesInfo.alternatives && seriesInfo.alternatives.length > 0) {
            searchStrategies.push(...seriesInfo.alternatives);
        }
        
        // Strategy 4: Partial title
        if (seriesInfo.originalTitle && seriesInfo.originalTitle.includes(':')) {
            searchStrategies.push(seriesInfo.originalTitle.split(':')[0].trim());
        }
        if (seriesInfo.title && seriesInfo.title.includes(':')) {
            searchStrategies.push(seriesInfo.title.split(':')[0].trim());
        }
        
        // Deduplicate strategies
        searchStrategies = [...new Set(searchStrategies)];
        
        console.log(`[Rebahin API] Series search strategies (${searchStrategies.length}):`, searchStrategies.slice(0, 5));
        
        // Try each search strategy (limit 7)
        let result = null;
        for (const searchTitle of searchStrategies.slice(0, 7)) {
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

/**
 * GET /api/rebahin/debug
 * Debug search logic
 */
router.get('/debug', async (req, res) => {
    const { q, year } = req.query;
    const logs = [];
    const log = (msg, data = null) => {
        logs.push(msg + (data ? ' ' + JSON.stringify(data) : ''));
        console.log(`[Rebahin Debug] ${msg}`, data || '');
    };

    try {
        if (!q) return res.status(400).json({ error: 'Query q is required' });

        log(`Starting debug for q="${q}", year="${year || ''}"`);

        // 1. Search with Year
        let resultsWithYear = [];
        if (year) {
            const qYear = `${q} ${year}`;
            log(`Step 1: Searching "${qYear}"`);
            const res1 = await rebahinService.search(qYear);
            if (res1.success && res1.data) {
                resultsWithYear = res1.data;
                log(`Step 1 found ${resultsWithYear.length} items`);
            } else {
                log(`Step 1 failed or empty: ${res1.error || '0 items'}`);
            }
        }

        // 2. Search without Year
        log(`Step 2: Searching "${q}"`);
        const res2 = await rebahinService.search(q);
        let resultsNoYear = [];
        if (res2.success && res2.data) {
            resultsNoYear = res2.data;
            log(`Step 2 found ${resultsNoYear.length} items`);
        } else {
            log(`Step 2 failed or empty: ${res2.error || '0 items'}`);
        }

        // 3. Matching Simulation
        const cleanTitle = q.toLowerCase().trim();
        log(`Matching against clean title: "${cleanTitle}"`);

        let match = null;
        
        // Helper to check match
        const checkMatch = (source, items) => {
            log(`Checking ${source} candidates...`);
            // Exact match
            for (const item of items) {
                const itemTitle = (item.title || '').toLowerCase().trim();
                const isExact = itemTitle === cleanTitle;
                log(`- "${item.title}" (Clean: "${itemTitle}") Exact? ${isExact}`);
                if (isExact) return item;
            }
            // Fuzzy
            const fuzzy = items.filter(i => (i.title || '').toLowerCase().includes(cleanTitle));
            log(`- Fuzzy matches found: ${fuzzy.length}`);
            if (fuzzy.length > 0) return fuzzy[0]; // Simple pick
            return null;
        };

        if (resultsWithYear.length > 0) {
            match = checkMatch('Step 1 (With Year)', resultsWithYear);
        }
        
        if (!match && resultsNoYear.length > 0) {
            log('Step 1 match failed, trying Step 2 candidates...');
            match = checkMatch('Step 2 (No Year)', resultsNoYear);
        }

        // 4. Get Detail if match found
        let detailResult = null;
        if (match && match.slug) {
            log(`Match found: "${match.title}" (Slug: ${match.slug}). Fetching detail...`);
            detailResult = await rebahinService.getDetail(match.slug);
            log(`Detail result success: ${detailResult.success}`);
            if (detailResult.data) {
                log(`Sources ID: ${detailResult.data.sources_id}`);
            }
        } else {
            log('NO MATCH FOUND.');
        }

        res.json({
            success: !!match,
            match,
            detail: detailResult,
            logs
        });

    } catch (error) {
        log(`Error: ${error.message}`);
        res.status(500).json({ error: error.message, logs });
    }
});

/**
 * POST /api/rebahin/clear-cache
 * Clear backend search cache
 */
router.post('/clear-cache', (req, res) => {
    try {
        rebahinService.clearCache();
        res.json({ success: true, message: 'Rebahin cache cleared successfully' });
    } catch (error) {
        console.error('[Rebahin API] Clear cache error:', error);
        res.status(500).json({ success: false, error: 'Failed to clear cache' });
    }
});

module.exports = router;
