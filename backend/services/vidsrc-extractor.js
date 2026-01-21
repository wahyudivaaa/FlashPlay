/**
 * VidSrc Stream Extractor
 * Extracts direct M3U8 streams from VidSrc providers to bypass ads
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Provider configurations
const PROVIDERS = {
    vidsrcXyz: {
        baseUrl: 'https://vidsrc.xyz',
    },
    vidsrcTo: {
        baseUrl: 'https://vidsrc.to',
        providerUrl: 'https://vid2v11.site'
    },
    vidsrcMe: {
        baseUrl: 'https://vidsrc.net',
        apiUrl: 'https://vidsrc.net/api'
    },
    superembed: {
        baseUrl: 'https://multiembed.mov'
    }
};

// Ad domain blocklist - helps identify and skip ad URLs
const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'popads.net',
    'popcash.net', 'trafficjunky.net', 'juicyads.com'
];

/**
 * Utility functions for decoding
 */
class DecoderUtils {
    // Base64 URL-safe decode
    static decodeBase64UrlSafe(input) {
        try {
            // Replace URL-safe characters
            let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
            // Add padding if needed
            const padding = base64.length % 4;
            if (padding) {
                base64 += '='.repeat(4 - padding);
            }
            return Buffer.from(base64, 'base64');
        } catch (e) {
            console.error('[DecoderUtils] Base64 decode error:', e.message);
            return null;
        }
    }

    // XOR decode with key
    static decodeData(key, data) {
        const keyBytes = Buffer.from(key, 'utf-8');
        const result = Buffer.alloc(data.length);
        
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return result;
    }

    // RC4 cipher implementation
    static rc4(key, data) {
        const S = [];
        for (let i = 0; i < 256; i++) S[i] = i;
        
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
            [S[i], S[j]] = [S[j], S[i]];
        }
        
        let i = 0;
        j = 0;
        const result = [];
        
        for (let k = 0; k < data.length; k++) {
            i = (i + 1) % 256;
            j = (j + S[i]) % 256;
            [S[i], S[j]] = [S[j], S[i]];
            result.push(data.charCodeAt(k) ^ S[(S[i] + S[j]) % 256]);
        }
        
        return String.fromCharCode(...result);
    }
}

/**
 * VidSrc Extractor Class
 */
class VidSrcExtractor {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    /**
     * Extract streams for a movie
     * @param {string} tmdbId - TMDB movie ID
     * @returns {Promise<Object>} Stream data with sources and subtitles
     */
    async extractMovie(tmdbId) {
        console.log(`[VidSrcExtractor] Extracting movie: ${tmdbId}`);
        return await this.extract('movie', tmdbId);
    }

    /**
     * Extract streams for a TV series episode
     * @param {string} tmdbId - TMDB series ID
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @returns {Promise<Object>} Stream data with sources and subtitles
     */
    async extractSeries(tmdbId, season, episode) {
        console.log(`[VidSrcExtractor] Extracting series: ${tmdbId} S${season}E${episode}`);
        return await this.extract('tv', tmdbId, season, episode);
    }

    /**
     * Main extraction logic
     */
    async extract(mediaType, mediaId, season = null, episode = null) {
        const results = {
            success: false,
            sources: [],
            subtitles: [],
            error: null
        };

        // Try multiple providers
        const extractors = [
            () => this.extractFromVidSrcNet(mediaType, mediaId, season, episode),
            () => this.extractFromVidSrcTo(mediaType, mediaId, season, episode),
        ];

        for (const extractor of extractors) {
            try {
                const data = await extractor();
                if (data && data.sources && data.sources.length > 0) {
                    results.success = true;
                    results.sources = data.sources;
                    results.subtitles = data.subtitles || [];
                    console.log(`[VidSrcExtractor] Successfully extracted ${data.sources.length} sources`);
                    break;
                }
            } catch (error) {
                console.error(`[VidSrcExtractor] Extractor failed:`, error.message);
            }
        }

        if (!results.success) {
            results.error = 'Failed to extract streams from all providers';
        }

        return results;
    }

    /**
     * Extract from vidsrc.net (simpler API)
     */
    async extractFromVidSrcNet(mediaType, mediaId, season, episode) {
        let url = `https://vidsrc.xyz/embed/${mediaType}/${mediaId}`;
        if (season && episode) {
            url += `/${season}/${episode}`;
        }

        console.log(`[VidSrcNet] Fetching: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': this.userAgent,
                'Referer': 'https://vidsrc.xyz/'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Try to find iframe sources or direct links
        const sources = [];
        const subtitles = [];

        // Look for embedded player data
        const scripts = $('script').toArray();
        for (const script of scripts) {
            const content = $(script).html() || '';
            
            // Look for M3U8 URLs
            const m3u8Matches = content.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
            if (m3u8Matches) {
                for (const m3u8 of m3u8Matches) {
                    sources.push({
                        quality: 'auto',
                        url: m3u8,
                        type: 'hls'
                    });
                }
            }

            // Look for subtitle URLs
            const vttMatches = content.match(/https?:\/\/[^\s"']+\.vtt[^\s"']*/g);
            if (vttMatches) {
                for (const vtt of vttMatches) {
                    subtitles.push({
                        lang: 'Unknown',
                        url: vtt
                    });
                }
            }
        }

        return { sources, subtitles };
    }

    /**
     * Extract from vidsrc.to (more complex, uses encryption)
     */
    async extractFromVidSrcTo(mediaType, mediaId, season, episode) {
        const baseUrl = PROVIDERS.vidsrcTo.baseUrl;
        let url = `${baseUrl}/embed/${mediaType}/${mediaId}`;
        if (season && episode) {
            url += `/${season}/${episode}`;
        }

        console.log(`[VidSrcTo] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': this.userAgent,
                'Referer': baseUrl
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Find data-id for sources
        const dataId = $('a[data-id]').attr('data-id');
        if (!dataId) {
            console.log('[VidSrcTo] No data-id found');
            return { sources: [], subtitles: [] };
        }

        // Fetch sources list
        const sourcesUrl = `${baseUrl}/ajax/embed/episode/${dataId}/sources`;
        console.log(`[VidSrcTo] Fetching sources: ${sourcesUrl}`);
        
        const sourcesResponse = await fetch(sourcesUrl, {
            headers: {
                'User-Agent': this.userAgent,
                'Referer': url,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!sourcesResponse.ok) {
            throw new Error(`Sources fetch failed: HTTP ${sourcesResponse.status}`);
        }

        const sourcesData = await sourcesResponse.json();
        const sources = [];
        const subtitles = [];

        // Process each source
        for (const source of (sourcesData.result || [])) {
            try {
                const sourceId = source.id;
                const sourceUrl = `${baseUrl}/ajax/embed/source/${sourceId}`;
                
                const sourceResponse = await fetch(sourceUrl, {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': url,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (sourceResponse.ok) {
                    const sourceData = await sourceResponse.json();
                    const encryptedUrl = sourceData.result?.url;
                    
                    if (encryptedUrl) {
                        // Try to decode the URL
                        const decodedUrl = await this.decodeSourceUrl(encryptedUrl);
                        if (decodedUrl) {
                            sources.push({
                                quality: 'auto',
                                url: decodedUrl,
                                type: 'hls',
                                name: source.title || 'Unknown'
                            });
                        }
                    }
                }
            } catch (e) {
                console.error(`[VidSrcTo] Failed to process source:`, e.message);
            }
        }

        return { sources, subtitles };
    }

    /**
     * Decode encrypted source URL
     */
    async decodeSourceUrl(encryptedUrl) {
        try {
            // The URL is usually base64 encoded and possibly XOR encrypted
            // Try simple base64 first
            const decoded = DecoderUtils.decodeBase64UrlSafe(encryptedUrl);
            if (decoded) {
                const decodedStr = decoded.toString('utf-8');
                if (decodedStr.startsWith('http')) {
                    return decodeURIComponent(decodedStr);
                }
            }

            // If that didn't work, the URL might need key-based decryption
            // This would require fetching the current encryption keys
            // For now, return null and let fallback handle it
            return null;
        } catch (e) {
            console.error('[VidSrcTo] URL decode failed:', e.message);
            return null;
        }
    }
}

// Singleton instance
const extractor = new VidSrcExtractor();

module.exports = {
    extractMovie: (tmdbId) => extractor.extractMovie(tmdbId),
    extractSeries: (tmdbId, season, episode) => extractor.extractSeries(tmdbId, season, episode),
    VidSrcExtractor
};
