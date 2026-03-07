import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const schema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        excerpt: { type: Type.STRING },
        content: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        references: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING }
                }
            }
        }
    },
    required: ["title", "excerpt", "content", "tags", "references"]
};

async function main() {
    console.log("Testing gemini-3.1-pro-preview with JSON schema...");
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: "モンスターハンターワイルズの紹介記事を書いてください。内容は短めでOKです。",
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.7
            }
        });

        const text = response.text || '';
        console.log("Response generated successfully.");
        try {
            const parsed = JSON.parse(text);
            console.log(`Title: ${parsed.title}`);
            console.log(`Content length: ${parsed.content.length}`);
            console.log("JSON is valid!");
        } catch (e: any) {
            console.log(`JSON Parse Failed: ${e.message}`);
            console.log(`Output: ${text.substring(0, 100)}...`);
        }
    } catch (err: any) {
        console.error("API Error:", err.message);
    }
}

main();
