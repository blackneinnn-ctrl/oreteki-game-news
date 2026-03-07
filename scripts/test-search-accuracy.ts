import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const prompt = `# 🎮 ゲーム記事 リサーチテスト（AI用プロンプト）

以下のゲームに関して、公式情報を含む信頼性の高い情報源（公式サイトやファミ通など）を最低3つ、Google検索ツールを必ず使用して検索してください。

【対象ゲーム】
タイトル: ペルソナ6

【出力形式】
JSONのみ出力してください。 \`responseMimeType: "application/json"\` を使用してテストしています。
{
  "references": [
    { 
       "title": "参考記事のタイトル", 
       "url": "https://..." 
    }
  ]
}
`;

const schema = {
    type: "OBJECT",
    properties: {
        references: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING" },
                    url: { type: "STRING" }
                }
            }
        }
    },
    required: ["references"]
};

async function testSearch(modelId: string) {
    console.log(`\n==================================================`);
    console.log(`Testing Tool Usage (Google Search) on: ${modelId}`);
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                // @ts-ignore
                responseSchema: schema,
                temperature: 0.1
            }
        });

        const text = response.text || '';
        console.log(`JSON Response:\n${text}`);
    } catch (err: any) {
        console.log(`❌ FAILED: ${err.message}`);
    }
}

async function main() {
    await testSearch('gemini-3.1-pro-preview');
    await testSearch('gemini-3-pro-preview');
}

main();
