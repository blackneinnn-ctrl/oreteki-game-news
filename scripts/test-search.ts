import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        console.log('Testing gemini-3.1-pro-preview WITHOUT tools...');
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: 'What is the latest news about Nintendo Switch 2?',
        });
        console.log('Success (no tools)!', response.text?.substring(0, 100));
        fs.writeFileSync('search_success.log', response.text || '');
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
main();
