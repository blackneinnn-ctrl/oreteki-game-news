import { config } from 'dotenv';
config({ path: '.env.local' });

import { GoogleGenAI } from '@google/genai';

async function main() {
    console.log('Testing Gemini API key...');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'hello',
        });
        console.log('Success!', response.text);
    } catch (err: any) {
        require('fs').writeFileSync('error.log', JSON.stringify({ message: err.message, status: err.status }));
    }
}

main();
