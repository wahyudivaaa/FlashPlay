
/**
 * AI Mood Recommender Service (Native HTTPS Version)
 * Zero dependency implementation to avoid Vercel fetch issues.
 */

const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
const API_HOST = 'generativelanguage.googleapis.com';
const API_PATH = `/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function extractJSON(text) {
    try { return JSON.parse(text); } catch (e) {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            try { return JSON.parse(text.substring(start, end + 1)); } catch (e2) {}
        }
        try {
            return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e3) { return []; }
    }
}

function postRequest(host, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: host,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error("Invalid JSON response"));
                    }
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

const tmdbService = require('./tmdb.service');

async function getRecommendations(userMood) {
    if (!API_KEY) {
        console.error("API Key missing");
        return [];
    }

    // Enhanced Prompt for "Full Power" recommendations
    const promptText = `
    User mood/request: "${userMood}"
    Task: Act as a master film curator. Recommend 8-12 movies or series that perfectly match this mood.
    Requirements:
    1. Mix of popular and hidden gems.
    2. Variety of genres if the mood allows.
    3. Output STRICT JSON Array only.
    Structure: [{"title": "Exact Title", "year": "2023", "type": "movie|series", "reason": "Why this specific movie fits the mood."}]
    `;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
    });

    try {
        const data = await postRequest(API_HOST, API_PATH, payload);
        
        let recommendations = [];
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            recommendations = extractJSON(text);
        }

        if (recommendations.length === 0) return [];

        // Enrichment Step: Fetch real data from TMDB
        // Running in parallel for speed
        const enrichedResults = await Promise.all(
            recommendations.map(async (rec) => {
                try {
                    // Search TMDB
                    let searchRes;
                    if (rec.type === 'series' || rec.type === 'tv') {
                        searchRes = await tmdbService.searchSeries(rec.title);
                    } else {
                        searchRes = await tmdbService.searchMovies(rec.title);
                    }

                    // Get best match (first result usually)
                    const match = searchRes.results && searchRes.results[0];
                    if (match) {
                        // Attach AI reason to the TMDB object
                        // We use a special property that frontend can use if needed, 
                        // or verify displayMovies handles extra props gracefully (it does).
                        // We can also potentially inject the reason into the overview for display? 
                        // Better to keep it separate and handle in frontend if we want to show it.
                            // Normalize data for frontend consistency
                            const isSeries = rec.type === 'series' || rec.type === 'tv';
                            return {
                                ...match,
                                title: match.title || match.name, // Ensure title exists
                                release_date: match.release_date || match.first_air_date, // Ensure date exists
                                ai_reason: rec.reason, 
                                media_type: isSeries ? 'tv' : 'movie'
                            };
                    }
                    return null;
                } catch (err) {
                    console.error(`[AI Enrichment] Failed for ${rec.title}:`, err.message);
                    return null;
                }
            })
        );

        // Filter out nulls (failed searches)
        return enrichedResults.filter(item => item !== null);

    } catch (error) {
        console.error("[AI Recommender] Error:", error.message);
        return [];
    }
}

module.exports = { getRecommendations };
