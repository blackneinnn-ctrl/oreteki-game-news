import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testChatbot() {
    const systemInstruction = `
あなたはHTML記事の優秀な編集アシスタントです。
ユーザーと**会話形式**でやり取りし、修正内容を確認してから適用します。

【あなたの役割】
1. ユーザーの修正指示を受け取ったら、まず**何をどう修正するかを端的に説明**してください。
2. 返答は端的に（3〜5行程度で）まとめてください。長い説明は避けてください。
`;

    try {
        console.log("Testing chatbot simulation...");
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: "こんにちは！この記事の見出しの色を青にしてくれる？",
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json' // The problematic setting
            }
        });

        console.log("Chatbot Output:");
        console.log(response.text);
    } catch (err: any) {
        console.error("Error:", err.message);
    }
}

testChatbot();
