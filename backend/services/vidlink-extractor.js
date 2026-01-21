/**
 * VidLink Pro Stream Extractor
 * Based on vidsrc-bypass library (https://github.com/Gradleless/vidsrc-bypass)
 * Extracts direct m3u8 stream URLs from VidLink, bypassing all ads
 */

const crypto = require('crypto');

// VidLink API configuration
const API_URL = "https://vidlink.pro/api/b";
const keyHex = "2de6e6ea13a9df9503b11a6117fd7e51941e04a0c223dfeacfe8a1dbb6c52783";
const algo = "aes-256-cbc";

/**
 * Encrypt TMDB ID for VidLink API
 * @param {string} data - TMDB ID
 * @returns {string} Encrypted string in format "iv:encrypted"
 */
function encrypt(data) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(keyHex, "hex").slice(0, 32);
    
    const cipher = crypto.createCipheriv(algo, key, iv);
    let encrypted = cipher.update(data, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt VidLink API response
 * @param {string} data - Encrypted response in format "iv:encrypted"
 * @returns {string} Decrypted JSON string
 */
function decryptClearKey(data) {
    const [ivHex, encryptedHex] = data.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = Buffer.from(keyHex, "hex").slice(0, 32);
    
    const decipher = crypto.createDecipheriv(algo, key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Extract stream from VidLink
 * @param {Object} params - Extraction parameters
 * @param {string} params.type - "movie" or "tv"
 * @param {string} params.id - TMDB ID
 * @param {number} [params.season] - Season number (for TV)
 * @param {number} [params.episode] - Episode number (for TV)
 * @returns {Promise<Object>} Stream data with playlist URL and captions
 */
async function getVidLinkVideo(params) {
    let url;
    const encodedId = Buffer.from(encrypt(params.id)).toString('base64');
    
    switch (params.type) {
        case 'tv':
            url = `${API_URL}/tv/${encodedId}/${params.season}/${params.episode}`;
            break;
        case 'movie':
        default:
            url = `${API_URL}/movie/${encodedId}`;
            break;
    }
    
    console.log(`[VidLink Extractor] Fetching: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro'
        }
    });
    
    if (!response.ok) {
        throw new Error(`VidLink API error: ${response.status}`);
    }
    
    const encryptedResponse = await response.text();
    const decryptedData = decryptClearKey(encryptedResponse);
    const videoData = JSON.parse(decryptedData);
    
    console.log(`[VidLink Extractor] Successfully extracted stream`);
    
    return {
        success: true,
        sources: [{
            url: videoData.stream?.playlist,
            quality: 'auto',
            type: 'hls'
        }],
        subtitles: (videoData.stream?.captions || []).map(cap => ({
            lang: cap.language,
            url: cap.url,
            type: cap.type
        }))
    };
}

/**
 * Extract movie stream
 * @param {string} tmdbId - TMDB movie ID
 */
async function extractMovie(tmdbId) {
    try {
        return await getVidLinkVideo({ type: 'movie', id: tmdbId.toString() });
    } catch (error) {
        console.error('[VidLink Extractor] Movie extraction failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Extract TV series episode stream
 * @param {string} tmdbId - TMDB series ID
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 */
async function extractSeries(tmdbId, season, episode) {
    try {
        return await getVidLinkVideo({ 
            type: 'tv', 
            id: tmdbId.toString(),
            season: parseInt(season),
            episode: parseInt(episode)
        });
    } catch (error) {
        console.error('[VidLink Extractor] Series extraction failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    extractMovie,
    extractSeries,
    getVidLinkVideo
};
