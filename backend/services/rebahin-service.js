/**
 * Rebahin21 Service
 * Service untuk integrasi dengan API Rebahin21 (https://zeldvorik.ru/rebahin21/)
 * 
 * API ini menggunakan sistem slug/sources_id yang berbeda dari TMDB ID.
 * Service ini akan melakukan pencarian by title untuk mapping TMDB -> Rebahin21.
 */

const fetch = require('node-fetch');

const REBAHIN_API_BASE = 'https://zeldvorik.ru/rebahin21/api.php';
const REBAHIN_PLAYER_BASE = 'https://zeldvorik.ru/rebahin21/player.php';

// Simple in-memory cache untuk menyimpan mapping TMDB ID -> sources_id
const sourceCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

/**
 * Search content by title
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results
 */
async function search(query) {
    try {
        const url = `${REBAHIN_API_BASE}?action=search&q=${encodeURIComponent(query)}&page=1`;
        console.log(`[Rebahin21] Searching: ${query}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Rebahin21] Search error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get detail by slug
 * @param {string} slug - Content slug
 * @returns {Promise<Object>} - Detail data including sources_id
 */
async function getDetail(slug) {
    try {
        const url = `${REBAHIN_API_BASE}?action=detail&slug=${encodeURIComponent(slug)}`;
        console.log(`[Rebahin21] Getting detail for slug: ${slug}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Detail fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Rebahin21] Detail error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get streaming sources by sources_id
 * @param {string} sourcesId - Sources ID
 * @param {number} season - Season number (optional, for series)
 * @param {number} episode - Episode number (optional, for series)
 * @returns {Promise<Object>} - Streaming sources
 */
async function getSources(sourcesId, season = null, episode = null) {
    try {
        let url = `${REBAHIN_API_BASE}?action=sources&id=${sourcesId}`;
        if (season && episode) {
            url += `&season=${season}&episode=${episode}`;
        }
        
        console.log(`[Rebahin21] Getting sources: ${sourcesId}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Sources fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Rebahin21] Sources error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get player embed URL for TMDB movie
 * Searches by title, maps to sources_id, returns player URL
 * 
 * @param {string} tmdbId - TMDB movie ID
 * @param {string} title - Movie title for search
 * @param {number} year - Release year (optional, for better matching)
 * @returns {Promise<Object>} - {success, playerUrl, sourcesId}
 */
async function getMoviePlayer(tmdbId, title, year = null) {
    const cacheKey = `movie_${tmdbId}`;
    
    // Check cache first
    const cached = sourceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[Rebahin21] Cache hit for movie: ${tmdbId}`);
        return cached.data;
    }
    
    try {
        // Search by title
        const searchQuery = year ? `${title} ${year}` : title;
        const searchResult = await search(searchQuery);
        
        if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
            // Try search without year
            if (year) {
                const retryResult = await search(title);
                if (!retryResult.success || !retryResult.data || retryResult.data.length === 0) {
                    return { success: false, error: 'Content not found' };
                }
                searchResult.data = retryResult.data;
            } else {
                return { success: false, error: 'Content not found' };
            }
        }
        
        // Find best match with smart filtering
        const results = searchResult.data;
        let bestMatch = null;
        
        // Normalize search title
        const cleanTitle = title.toLowerCase().trim();
        
        // 1. Try exact match (most reliable)
        for (const item of results) {
            const itemTitle = (item.title || '').toLowerCase().trim();
            if (itemTitle === cleanTitle) {
                bestMatch = item;
                break;
            }
        }
        
        // 2. If no exact match, try to find "clean" match (ignoring [Indonesian], etc)
        if (!bestMatch) {
            // Filter candidates that contain the search title
            const candidates = results.filter(item => 
                (item.title || '').toLowerCase().includes(cleanTitle)
            );
            
            if (candidates.length > 0) {
                // Prefer items WITHOUT brackets like [Indonesian] first
                const cleanCandidates = candidates.filter(item => !/\[.*?\]/.test(item.title));
                
                if (cleanCandidates.length > 0) {
                    // Pick the shortest title among clean candidates (usually the most original one)
                    bestMatch = cleanCandidates.sort((a, b) => a.title.length - b.title.length)[0];
                } else {
                    // If all have brackets, matches the user request to NOT take [Indonesian] presumably if implied
                    // But if ONLY bracketed options exist, we might have to take one.
                    // However, user said "jangan diambil". Let's try to pick the first candidate then.
                    bestMatch = candidates[0];
                }
            }
        }
        
        // 3. Fallback to first result if it seems reasonable
        if (!bestMatch && results.length > 0) {
            // Check if the first result looks somewhat related (fuzzy check)
            const firstTitle = (results[0].title || '').toLowerCase();
            const similarity = firstTitle.includes(cleanTitle) || cleanTitle.includes(firstTitle);
            
            if (similarity) {
                bestMatch = results[0];
            }
        }
        
        // Final check for [Indonesian] tag as explicitly requested to avoid if possible
        // If we selected a match with [Indonesian] but there was another option, we logic already handled it (cleanCandidates).
        // If the BEST match has [Indonesian], maybe we should double check?
        // User said: "ambil judul nya aja ya kan di api isi value judul {indonesian} itu jangan diambil"
        // This implies: if "Yadang" exists and "Yadang [Indonesian]" exists, pick "Yadang". 
        // My logic above (cleanCandidates) does exactly this.
        
        if (!bestMatch || !bestMatch.slug) {
            return { success: false, error: 'No matching content found' };
        }
        
        // Get detail to get sources_id
        const detail = await getDetail(bestMatch.slug);
        
        if (!detail.success || !detail.data || !detail.data.sources_id) {
            return { success: false, error: 'Failed to get sources_id' };
        }
        
        const sourcesId = detail.data.sources_id;
        const playerUrl = `${REBAHIN_PLAYER_BASE}?id=${sourcesId}`;
        
        const result = {
            success: true,
            playerUrl,
            sourcesId,
            slug: bestMatch.slug,
            title: detail.data.title || bestMatch.title
        };
        
        // Cache the result
        sourceCache.set(cacheKey, {
            timestamp: Date.now(),
            data: result
        });
        
        return result;
        
    } catch (error) {
        console.error('[Rebahin21] getMoviePlayer error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get player embed URL for TMDB series episode
 * 
 * @param {string} tmdbId - TMDB series ID
 * @param {string} title - Series title for search
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @returns {Promise<Object>} - {success, playerUrl, sourcesId}
 */
async function getSeriesPlayer(tmdbId, title, season, episode) {
    const cacheKey = `series_${tmdbId}`;
    
    // Check cache for sources_id (reuse for all episodes)
    const cached = sourceCache.get(cacheKey);
    let sourcesId;
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[Rebahin21] Cache hit for series: ${tmdbId}`);
        sourcesId = cached.data.sourcesId;
    } else {
        try {
            // Search by title
            const searchResult = await search(title);
            
            if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
                return { success: false, error: 'Series not found' };
            }
            
        // Find best match with smart filtering
        const results = searchResult.data;
        let bestMatch = null;
        
        // Normalize search title
        const cleanTitle = title.toLowerCase().trim();
        
        // 1. Try exact match
        for (const item of results) {
            const itemTitle = (item.title || '').toLowerCase().trim();
            if (itemTitle === cleanTitle) {
                bestMatch = item;
                break;
            }
        }
        
        // 2. If no exact match, try to find "clean" match (ignoring [Indonesian], etc)
        if (!bestMatch) {
            // Filter candidates that contain the search title
            const candidates = results.filter(item => 
                (item.title || '').toLowerCase().includes(cleanTitle)
            );
            
            if (candidates.length > 0) {
                // Prefer items WITHOUT brackets like [Indonesian] first
                const cleanCandidates = candidates.filter(item => !/\[.*?\]/.test(item.title));
                
                if (cleanCandidates.length > 0) {
                    bestMatch = cleanCandidates.sort((a, b) => a.title.length - b.title.length)[0];
                } else {
                    bestMatch = candidates[0];
                }
            }
        }
        
        // 3. Fallback to first result
        if (!bestMatch && results.length > 0) {
            const firstTitle = (results[0].title || '').toLowerCase();
            const similarity = firstTitle.includes(cleanTitle) || cleanTitle.includes(firstTitle);
            
            if (similarity) {
                bestMatch = results[0];
            }
        }
        
        if (!bestMatch || !bestMatch.slug) {
            return { success: false, error: 'No matching series found' };
        }
        
        // Get detail
        const detail = await getDetail(bestMatch.slug);
        
        if (!detail.success || !detail.data || !detail.data.sources_id) {
            return { success: false, error: 'Failed to get sources_id' };
        }
        
        sourcesId = detail.data.sources_id;
        
        // Cache the sources_id
        sourceCache.set(cacheKey, {
            timestamp: Date.now(),
            data: {
                sourcesId,
                slug: bestMatch.slug,
                title: detail.data.title || bestMatch.title
            }
        });
            
        } catch (error) {
            console.error('[Rebahin21] getSeriesPlayer error:', error);
            return { success: false, error: error.message };
        }
    }
    
    const playerUrl = `${REBAHIN_PLAYER_BASE}?id=${sourcesId}&season=${season}&episode=${episode}`;
    
    return {
        success: true,
        playerUrl,
        sourcesId,
        season,
        episode
    };
}

/**
 * Clear cache (for testing/maintenance)
 */
function clearCache() {
    sourceCache.clear();
    console.log('[Rebahin21] Cache cleared');
}

module.exports = {
    search,
    getDetail,
    getSources,
    getMoviePlayer,
    getSeriesPlayer,
    clearCache
};
