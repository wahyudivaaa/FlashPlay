
/**
 * AI Mood Recommender Service
 * Menggunakan Google Gemini 1.5 Flash via REST API.
 */

const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

async function getRecommendations(userMood) {
    if (!API_KEY) {
        throw new Error("API Key missing");
    }

    // Prompt yang dirancang untuk output JSON konsisten
    const promptText = `
    User request: "${userMood}"
    
    Task: Recommend 6-10 specific movies or TV series based on the user's mood/request.
    Rules:
    1. Focus on highly-rated, popular, or hidden gem titles.
    2. Provide a variety of genres if the request is broad.
    3. Output STRICT JSON format only. No markdown formatting.
    4. Structure: 
    [
      {
        "title": "Movie Title",
        "year": "2023",
        "type": "movie" (or "tv"),
        "reason": "Short catchy reason why it fits the mood"
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
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            let text = data.candidates[0].content.parts[0].text;
            
            // Clean Markdown code blocks if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("[AI Recommender] JSON Parse Error:", e.message, "Text:", text);
                return [];
            }
        }
        
        return [];

    } catch (error) {
        console.error("[AI Recommender] Error:", error.message);
        return [];
    }
}

module.exports = { getRecommendations };
