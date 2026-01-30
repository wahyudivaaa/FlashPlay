
/**
 * AI Semantic Matcher Service (Lightweight REST Version)
 * Menggunakan Google Gemini 1.5 Flash via RAW REST API.
 * Menghindari ketergantungan library yang bikin crash di Vercel.
 */

const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

/**
 * Find the best match using AI reasoning
 * @param {string} targetTitle - Judul yang dicari
 * @param {string} targetYear - Tahun rilis
 * @param {Array} candidates - List kandidat
 * @returns {Promise<Object|null>}
 */
async function findMatchWithAI(targetTitle, targetYear, candidates) {
    if (!API_KEY) {
        console.warn("[AI Matcher] No GEMINI_API_KEY. Skipping AI.");
        return null;
    }

    if (!candidates || candidates.length === 0) return null;

    // Filter kandidat biar payload kecil
    const cleanCandidates = candidates
        .filter(c => c.title && c.slug)
        .map((c, index) => ({
            id: index,
            title: c.title,
            year: c.year || "Unknown",
            type: c.type || "Unknown"
        }))
        .slice(0, 15);

    const promptText = `
    Match this title: "${targetTitle}" (Year: ${targetYear || 'Unknown'}).
    Candidates: ${JSON.stringify(cleanCandidates)}
    
    Rules:
    1. Ignore punctuation/case.
    2. Handle translated titles (Korean/English).
    3. Return JSON: {"matchFound": true, "bestMatchId": 0, "reason": "..."} or {"matchFound": false}
    `;

    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    try {
        console.log(`[AI Matcher] Calling Gemini API (REST)...`);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[AI Matcher] API Error ${response.status}: ${errText}`);
            return null;
        }

        const data = await response.json();
        
        // Parse response
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            const jsonResult = JSON.parse(text); // Gemini returns JSON string

            if (jsonResult.matchFound && typeof jsonResult.bestMatchId === 'number') {
                const best = candidates[jsonResult.bestMatchId];
                console.log(`[AI Matcher] 🧠 AI Match: "${best.title}"`);
                return best;
            }
        }
        
        return null;

    } catch (error) {
        console.error("[AI Matcher] Fetch Error:", error.message);
        return null;
    }
}

module.exports = {
    findMatchWithAI
};
