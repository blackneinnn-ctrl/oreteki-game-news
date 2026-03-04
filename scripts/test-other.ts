import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        console.log('Testing gemini-2.5-pro...');
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: 'hello',
        });
        console.log('gemini-2.5-pro success:', response.text?.substring(0, 20));

        console.log('Testing gemini-3-pro-preview...');
        const res2 = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: 'hello',
        });
        console.log('gemini-3-pro-preview success:', res2.text?.substring(0, 20));

    } catch (err: any) {
        console.error('Error:', err);
    }
}
main();
