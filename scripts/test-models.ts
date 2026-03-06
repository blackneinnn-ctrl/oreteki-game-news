import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

async function testModel(modelId: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log(`\nTesting model: ${modelId}`);
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: 'Say "hello" in Japanese in one word.',
        });
        console.log(`✅ SUCCESS: ${response.text}`);
    } catch (err: any) {
        console.log(`❌ FAILED: ${err.message}`);
    }
}

async function main() {
    // Test the models the user uses now and what they want to switch to
    await testModel('gemini-3-pro-preview');          // current
    await testModel('gemini-3.1-pro-preview');        // target
    await testModel('gemini-2.5-pro');                // available per list
    await testModel('gemini-2.5-flash');              // available per list
}

main();
