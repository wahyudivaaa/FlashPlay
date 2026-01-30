/**
 * Rebahin21 Service
 * Service untuk integrasi dengan API Rebahin21 (https://zeldvorik.ru/rebahin21/)
 * 
 * API ini menggunakan sistem slug/sources_id yang berbeda dari TMDB ID.
 * Service ini akan melakukan pencarian by title untuk mapping TMDB -> Rebahin21.
 * // Vercel redeploy trigger: Ensure search fixes are live
 */

const fetch = require('node-fetch');
const https = require('https');
const aiMatcher = require('./ai-matcher.service'); // Import AI Service

const REBAHIN_API_BASE = 'https://zeldvorik.ru/rebahin21/api.php';
const REBAHIN_PLAYER_BASE = 'https://zeldvorik.ru/rebahin21/player.php';

// CHROME-LIKE TLS FINGERPRINT (Bypass Blocking)
const CHROME_CIPHERS = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA'
].join(':');

const httpsAgent = new https.Agent({
    ciphers: CHROME_CIPHERS,
    minVersion: 'TLSv1.2',
    keepAlive: true,
    ecdhCurve: 'X25519:P-256:P-384'
});

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Referer': 'https://zeldvorik.ru/',
    'Origin': 'https://zeldvorik.ru',
    'Connection': 'keep-alive'
};

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
            headers: BROWSER_HEADERS,
            agent: httpsAgent,
            timeout: 9000 // Increased timeout for slow TLS handshake
        });
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Rebahin21] Search error:', error.message);
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://zeldvorik.ru/rebahin21/',
                'X-Requested-With': 'XMLHttpRequest'
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://zeldvorik.ru/rebahin21/',
                'X-Requested-With': 'XMLHttpRequest'
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
 * Helper: Normalize title for comparison
 * Removes punctuation but KEEPS unicode chars (Korean/Japanese etc)
 * "Avengers: Endgame" -> "avengersendgame"
 * "이 사랑 통역 되나요?" -> "이사랑통역되나요"
 */
function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, ''); // Remove anything that is NOT a Letter or Number (Unicode aware)
}

/**
 * Helper: Smart matching logic
 */
function findBestMatch(results, title) {
    if (!results || results.length === 0) return null;

    const originalQuery = title;
    const cleanQuery = normalizeTitle(title);
    
    console.log(`[Rebahin21] Matching for: "${originalQuery}" (norm: "${cleanQuery}")`);
    
    // 1. Exact Match (Normalized)
    const exactMatch = results.find(item => normalizeTitle(item.title) === cleanQuery);
    if (exactMatch) {
        console.log(`[Rebahin21] Exact match found: ${exactMatch.title}`);
        return exactMatch;
    }

    // 2. Similarity Score
    const scored = results.map(item => {
        const itemTitle = normalizeTitle(item.title);
        const score = similarity(cleanQuery, itemTitle);
        return { item, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // High confidence threshold (0.85) - matches sandbox validation
    if (scored.length > 0 && scored[0].score >= 0.85) {
        console.log(`[Rebahin21] High confidence local match found: "${scored[0].item.title}" (Score: ${scored[0].score.toFixed(2)})`);
        return scored[0].item;
    }
    
    console.log('[Rebahin21] No match found');
    return null;
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
        let bestMatch = null;
        let allCandidates = [];

        // STRATEGY: Parallel Turbo Search (Fast & Broad)
        // Run all search types concurrently to maximize results in minimum time
        const searchPromises = [];
        
        // 1. Raw Title
        searchPromises.push(search(title).then(res => ({ type: 'raw', res })));
        
        // 2. Title + Year (Higher accuracy if found)
        if (year) {
            searchPromises.push(search(`${title} ${year}`).then(res => ({ type: 'year', res })));
        }

        // 3. Short Title (Handle 'Yadang: The Snitch' -> 'Yadang')
        if (title.includes(':')) {
            const shortTitle = title.split(':')[0].trim();
            searchPromises.push(search(shortTitle).then(res => ({ type: 'short', res })));
        }

        console.log(`[Rebahin21] Turbo Race started for: "${title}"`);
        const results = await Promise.all(searchPromises);
        
        // Process results in order of preference
        const yearResult = results.find(r => r.type === 'year')?.res;
        const rawResult = results.find(r => r.type === 'raw')?.res;
        const shortResult = results.find(r => r.type === 'short')?.res;

        // Sequence of matching attempts (from all collected candidates)
        const combinedData = [];
        if (yearResult?.success) combinedData.push(...yearResult.data);
        if (rawResult?.success) combinedData.push(...rawResult.data);
        if (shortResult?.success) combinedData.push(...shortResult.data);

        // Remove duplicates and matching
        if (combinedData.length > 0) {
            const uniqueCandidates = [...new Map(combinedData.map(item => [item.slug, item])).values()];
            allCandidates = uniqueCandidates;
            bestMatch = findBestMatch(uniqueCandidates, title);
        }
        
        // Step 3: AI Matcher (Last Resort)
        if (!bestMatch) {
             console.log(`[Rebahin21] Manual Turbo matching failed. Asking AI...`);
             if (allCandidates.length > 0) {
                bestMatch = await aiMatcher.findMatchWithAI(title, year, allCandidates);
             } else {
                console.log(`[Rebahin21] No candidates from any search. AI skipped.`);
             }
        }
        
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
            let bestMatch = null;
            
            // Search by title (Series typically don't use year in query for broad match)
            const searchResult = await search(title);
            
            if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
                bestMatch = findBestMatch(searchResult.data, title);
            }
            
            // AI Fallback for Series
            if (!bestMatch && searchResult.data && searchResult.data.length > 0) {
                console.log(`[Rebahin21] Manual matching failed for series. Asking AI...`);
                bestMatch = await aiMatcher.findMatchWithAI(title, null, searchResult.data);
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
