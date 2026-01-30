
require('dotenv').config(); // Load .env
const aiRecommender = require('./services/ai-recommender.service');

async function testRec() {
    console.log("Testing AI Recommender...");
    const mood = "film horor";
    
    try {
        const results = await aiRecommender.getRecommendations(mood);
        console.log("\nRESULTS:");
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error("❌ ERROR:", error);
    }
}

testRec();
