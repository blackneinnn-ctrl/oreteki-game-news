import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        console.log('Testing gemini-2.5-flash...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'hello',
        });
        fs.writeFileSync('result_flash.json', JSON.stringify({ success: true, text: response.text }), 'utf8');
    } catch (err: any) {
        fs.writeFileSync('result_flash.json', JSON.stringify({ success: false, error: err.message, stack: err.stack }), 'utf8');
    }
}
main().catch(err => fs.writeFileSync('result_flash.json', JSON.stringify({ success: false, error: err.message, type: 'uncaught' }), 'utf8'));
