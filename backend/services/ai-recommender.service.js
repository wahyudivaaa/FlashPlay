
/**
 * AI Mood Recommender Service (Robust JSON Parsing)
 */

const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;
// Use flash-latest, fallback to pro if needed
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

function extractJSON(text) {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Try to find array bracket [ ... ]
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        
        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.substring(start, end + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (e2) {
                console.error("[AI Recommender] Extracted JSON parse failed:", e2.message);
            }
        }
        
        // 3. Try cleaning markdown
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch (e3) {
            console.error("[AI Recommender] All parse attempts failed.");
            return [];
        }
    }
}

async function getRecommendations(userMood) {
    if (!API_KEY) {
        throw new Error("API Key missing");
    }

    const promptText = `
    User request: "${userMood}"
    
    Task: Recommend 6-10 specific movies or TV series based on the user's mood/request.
    Rules:
    1. Focus on highly-rated, popular, or hidden gem titles.
    2. Provide a variety of genres if the request is broad.
    3. Output STRICT JSON format only (Array of Objects).
    4. Structure: 
    [
      {
        "title": "Movie Title",
        "year": "2023",
        "type": "movie",
        "reason": "Short reason"
      }
    ]
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
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Gemini API Error: ${response.status} - ${errText}`);
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            console.log("[AI Recommender] Raw response:", text.substring(0, 100) + "...");
            return extractJSON(text);
        }
        
        return [];

    } catch (error) {
        console.error("[AI Recommender] Error:", error.message);
        return [];
    }
}

module.exports = { getRecommendations };
