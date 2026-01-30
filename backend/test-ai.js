
require('dotenv').config(); // Load .env from current dir
const aiMatcher = require('./services/ai-matcher.service');

async function testAI() {
    console.log("Testing AI Matcher...");
    console.log("API Key present?", !!process.env.GEMINI_API_KEY);

    const targetTitle = "Can This Love Be Translated?";
    const candidates = [
        { title: "Alchemy of Souls", slug: "alchemy-of-souls" },
        { title: "What Comes After Love", slug: "what-comes-after-love" },
        { title: "이 사랑 통역 되나요?", slug: "can-this-love-be-translated-korean" }, // Target
        { title: "Love Next Door", slug: "love-next-door" }
    ];

    console.log("Target:", targetTitle);
    console.log("Candidates:", candidates.map(c => c.title));

    try {
        const match = await aiMatcher.findMatchWithAI(targetTitle, 2025, candidates);
        console.log("\nRESULT:");
        console.log(match ? `✅ MATCH FOUND: ${match.title}` : "❌ NO MATCH FOUND");
    } catch (error) {
        console.error("❌ ERROR:", error);
    }
}

testAI();
