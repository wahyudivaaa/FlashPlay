
/**
 * AI Matcher Service (Native HTTPS Version)
 */

const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
const API_HOST = 'generativelanguage.googleapis.com';
const API_PATH = `/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

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
            res.on('data', (c) => body += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function findMatchWithAI(targetTitle, targetYear, candidates, retryCount = 0) {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error('[AI Matcher] Error: GEMINI_API_KEY not found in environment variables.');
        return null;
    }

    if (!candidates || candidates.length === 0) return null;

    // Slice to avoid token limits, keep it lean
    const cleanCandidates = candidates.slice(0, 15).map((c, i) => ({
        id: i,
        title: c.title,
        year: c.year || "Unknown"
    }));

    const promptText = `
    Task: Find the best match for a movie/series title.
    Target: "${targetTitle}" (${targetYear || 'Unknown Year'})
    Candidates: ${JSON.stringify(cleanCandidates)}

    Rules:
    1. Look for exact matches, aliases, or translations (e.g., Japanese/Korean to English).
    2. Return ONLY a valid JSON object.
    3. JSON format: {"matchFound": true, "bestMatchId": index} or {"matchFound": false}
    `;

    try {
        // Using v1beta for better JSON mode support across models
        // Use gemini-flash-lite-latest as it proved stable in sandbox with higher limits
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            }),
            timeout: 30000 // 30s timeout
        });

        if (response.status === 429) {
            if (retryCount < 3) {
                const waitTime = (retryCount + 1) * 20000; // Increased backoff
                console.warn(`[AI Matcher] Quota exceeded (429). Retrying in ${waitTime/1000}s (Attempt ${retryCount + 1}/3)...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return findMatchWithAI(targetTitle, targetYear, candidates, retryCount + 1);
            } else {
                console.error('[AI Matcher] Quota exceeded after 3 retries.');
                return null;
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Matcher] API Error (${response.status}):`, errorText);
            return null;
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0].content) {
            const textResponse = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(textResponse);

            if (result.matchFound && typeof result.bestMatchId === 'number' && candidates[result.bestMatchId]) {
                console.log(`[AI Matcher] Match found: "${candidates[result.bestMatchId].title}" for "${targetTitle}"`);
                return candidates[result.bestMatchId];
            }
        }
        
        return null;
    } catch (error) {
        console.error(`[AI Matcher] Error:`, error.message);
        return null;
    }
}

module.exports = { findMatchWithAI };
