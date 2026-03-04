import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        console.log('Testing gemini-3.1-pro-preview-customtools with googleSearch...');
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview-customtools',
            contents: 'What is the weather in Tokyo?',
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        console.log('Success:', response.text?.substring(0, 20));
    } catch (err: any) {
        console.error('Error:', err);
    }
}
main();
