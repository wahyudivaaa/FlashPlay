
const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
    const res = await fetch(URL);
    const data = await res.json();
    console.log("Available Models:");
    if(data.models) {
        data.models.forEach(m => {
            if(m.supportedGenerationMethods.includes('generateContent')) {
                console.log("- " + m.name);
            }
        });
    } else {
        console.log(data);
    }
}

listModels();
