/**
 * Stream Routes
 * API endpoints for ad-free video streaming
 */

const express = require('express');
const router = express.Router();
const vidsrcExtractor = require('../services/vidsrc-extractor');
const vidlinkExtractor = require('../services/vidlink-extractor');

/**
 * GET /api/stream/movie/:tmdbId
 * Extract ad-free stream for a movie
 * Tries VidLink first (more reliable), then VidSrc as fallback
 */
router.get('/movie/:tmdbId', async (req, res) => {
    const { tmdbId } = req.params;
    
    console.log(`[Stream API] Movie request: ${tmdbId}`);
    
    try {
        // Try VidLink first (more reliable, bypasses ads)
        console.log(`[Stream API] Trying VidLink extractor...`);
        let result = await vidlinkExtractor.extractMovie(tmdbId);
        
        // If VidLink fails, try VidSrc
        if (!result.success) {
            console.log(`[Stream API] VidLink failed, trying VidSrc...`);
            result = await vidsrcExtractor.extractMovie(tmdbId);
        }
        
        if (result.success && result.sources && result.sources[0]?.url) {
            res.json({
                success: true,
                sources: result.sources,
                subtitles: result.subtitles || []
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error || 'No streams found',
                fallback: true // Signal frontend to use iframe fallback
            });
        }
    } catch (error) {
        console.error('[Stream API] Movie extraction error:', error);
        res.status(500).json({
            success: false,
            error: 'Stream extraction failed',
            fallback: true
        });
    }
});

/**
 * GET /api/stream/series/:tmdbId/:season/:episode
 * Extract ad-free stream for a TV series episode
 * Tries VidLink first (more reliable), then VidSrc as fallback
 */
router.get('/series/:tmdbId/:season/:episode', async (req, res) => {
    const { tmdbId, season, episode } = req.params;
    
    console.log(`[Stream API] Series request: ${tmdbId} S${season}E${episode}`);
    
    try {
        // Try VidLink first
        console.log(`[Stream API] Trying VidLink extractor...`);
        let result = await vidlinkExtractor.extractSeries(tmdbId, season, episode);
        
        // If VidLink fails, try VidSrc
        if (!result.success) {
            console.log(`[Stream API] VidLink failed, trying VidSrc...`);
            result = await vidsrcExtractor.extractSeries(
                tmdbId, 
                parseInt(season), 
                parseInt(episode)
            );
        }
        
        if (result.success && result.sources && result.sources[0]?.url) {
            res.json({
                success: true,
                sources: result.sources,
                subtitles: result.subtitles || []
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error || 'No streams found',
                fallback: true
            });
        }
    } catch (error) {
        console.error('[Stream API] Series extraction error:', error);
        res.status(500).json({
            success: false,
            error: 'Stream extraction failed',
            fallback: true
        });
    }
});

/**
 * GET /api/stream/health
 * Health check for stream service
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'stream-extractor',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
