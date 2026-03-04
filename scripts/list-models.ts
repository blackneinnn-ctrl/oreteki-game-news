import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        const response = await ai.models.list();
        let out = '';
        for await (const m of response) {
            if (m.name && m.name.includes('gemini')) {
                out += m.name + '\n';
            }
        }
        fs.writeFileSync('models.txt', out);
    } catch (err: any) {
        fs.writeFileSync('models.txt', err.message);
    }
}
main();
