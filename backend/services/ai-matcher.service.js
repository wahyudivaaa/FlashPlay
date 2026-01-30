
/**
 * AI Semantic Matcher Service
 * Menggunakan Google Gemini 1.5 Flash untuk pencocokan judul cerdas.
 * Solusi untuk kasus "Can This Love Be Translated?" vs "이 사랑 통역 되나요?"
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
let model = null;

if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
} else {
    console.warn("[AI Matcher] No GEMINI_API_KEY found. AI matching disabled.");
}

/**
 * Find the best match using AI reasoning
 * @param {string} targetTitle - Judul yang dicari (dari TMDB)
 * @param {string} targetYear - Tahun rilis (opsional)
 * @param {Array} candidates - List kandidat dari API Rebahin
 * @returns {Promise<Object|null>} - Kandidat terbaik atau null
 */
async function findMatchWithAI(targetTitle, targetYear, candidates) {
    if (!model || !candidates || candidates.length === 0) return null;

    // Filter kandidat yang kosong/tidak valid biar hemat token
    const cleanCandidates = candidates
        .filter(c => c.title && c.slug)
        .map((c, index) => ({
            id: index,
            title: c.title,
            year: c.year || "Unknown",
            type: c.type || "Unknown"
        }))
        .slice(0, 15); // Ambil max 15 kandidat teratas biar cepet

    if (cleanCandidates.length === 0) return null;

    const prompt = `
    I am a search algorithm. I need to match a movie/series title.
    
    Target Title: "${targetTitle}"
    Target Year: "${targetYear || 'Unknown'}"
    
    Candidates List:
    ${JSON.stringify(cleanCandidates, null, 2)}
    
    Task: Find the exact match or the semantic equivalent (e.g. original Korean title vs English title).
    Rules:
    1. Ignore punctuation and minor spelling diffs.
    2. Know that "Avengers 4" = "Avengers Endgame".
    3. Know foreign titles (e.g. "이 사랑 통역 되나요?" = "Can This Love Be Translated?").
    4. If no good match found, return null.
    
    Response Format (JSON only):
    {
        "matchFound": true/false,
        "bestMatchId": <id from list>,
        "reason": "short explanation"
    }
    `;

    try {
        console.log(`[AI Matcher] Asking Gemini to match: "${targetTitle}" against ${cleanCandidates.length} candidates...`);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean markdown code blocks if any
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        if (data.matchFound && typeof data.bestMatchId === 'number') {
            const bestCandidate = candidates[data.bestMatchId];
            console.log(`[AI Matcher] 🧠 AI selected: "${bestCandidate.title}" (Reason: ${data.reason})`);
            return bestCandidate;
        } else {
            console.log(`[AI Matcher] AI found no match. Reason: ${data.reason}`);
            return null;
        }

    } catch (error) {
        console.error("[AI Matcher] Error:", error.message);
        return null; // Fallback to manual logic if AI fails
    }
}

module.exports = {
    findMatchWithAI
};
