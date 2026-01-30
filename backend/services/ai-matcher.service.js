
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

async function findMatchWithAI(targetTitle, targetYear, candidates) {
    if (!API_KEY) return null;
    if (!candidates || candidates.length === 0) return null;

    const cleanCandidates = candidates.slice(0, 15).map((c, i) => ({
        id: i, title: c.title, year: c.year || "Unknown"
    }));

    const promptText = `
    Match: "${targetTitle}" (${targetYear || ''})
    Candidates: ${JSON.stringify(cleanCandidates)}
    Rules: Return JSON {"matchFound": true, "bestMatchId": 0} or {"matchFound": false}
    `;

    const payload = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    try {
        const data = await postRequest(API_HOST, API_PATH, payload);
        
        if (data.candidates && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            const json = JSON.parse(text);
            if (json.matchFound && typeof json.bestMatchId === 'number') {
                return candidates[json.bestMatchId];
            }
        }
        return null;
    } catch (error) {
        console.error("[AI Matcher] Error:", error.message);
        return null;
    }
}

module.exports = { findMatchWithAI };
