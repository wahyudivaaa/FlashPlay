
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

async function getRecommendations(userMood) {
    if (!API_KEY) {
        console.error("API Key missing");
        return [];
    }

    const promptText = `
    User request: "${userMood}"
    Task: Recommend 6-10 specific movies/series.
    Rules: Output STRICT JSON Array only.
    Structure: [{"title": "Title", "year": "2023", "type": "movie", "reason": "Reason"}]
    `;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
    });

    try {
        const data = await postRequest(API_HOST, API_PATH, payload);
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            return extractJSON(text);
        }
        return [];
    } catch (error) {
        console.error("[AI Recommender] Error:", error.message);
        return [];
    }
}

module.exports = { getRecommendations };
