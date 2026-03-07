import { config } from 'dotenv';
config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const prompt = `# 🎮 ゲーム紹介記事 執筆マニュアル（AI用プロンプト）

## 1. 記事の基本属性（トーン＆マナー）
* ** ターゲット読者:** 次に遊ぶゲームを探している人、そのタイトルの購入を迷っている人。
* ** 文体・トーン:** ひとりのゲームファンとしての「熱量」と、良い点・人を選ぶ点をフラットに伝える「客観性」を両立したプロライター視点。
* ** 目的:** 読者にゲームの核となる面白さを伝え、「自分に合っているか（買うべきか）」の判断材料を提供すること。
* ** 情報の取り扱い（厳守）:** 公式発表に基づく事実のみ。必ずGoogle検索ツールを使用して最新情報を徹底的に調査すること。

## 2. 記事の基本構成（HTML構造）
1. トップメディア:
2. 導入（リード文）:
3. H2: 『ゲームタイトル』とは？（概要と世界観）
4. H2: 本作の魅力・注目ポイント（3要素）
5. H2: ぶっちゃけ、どんな人におすすめ？
6. H2: 総評・まとめ
7. H2: 製品情報（公式データ）

## 出力形式（JSON）
{
  "title": "読者の興味を引くタイトル",
  "excerpt": "記事の要約（1-2文、100文字以内）",
  "content": "<p>導入文</p><h2>見出し</h2>...",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "references": [
    { "title": "参考記事のタイトル", "url": "https://..." }
  ]
}

JSONのみを出力してください。マークダウンのコードブロックは不要です。

## ニュース情報
タイトル: モンスターハンターワイルズ
ソース: ファミ通
URL: なし
概要: カプコンの新作ハンティングアクション『モンスターハンターワイルズ』の最新トレーラーが公開。
`;

async function testModel(modelId: string) {
    console.log(`\n==================================================`);
    console.log(`Testing model: ${modelId}`);
    const startTime = Date.now();
    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.7
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const text = response.text?.trim() || '';
        console.log(`Time taken: ${duration}s`);
        console.log(`Text Length: ${text.length} characters`);

        let jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
        jsonStr = jsonStr.replace(/[\\u0000-\\u0019]+/g, "");

        try {
            const parsed = JSON.parse(jsonStr);
            console.log(`JSON Parse: ✅ SUCCESS`);
            console.log(`Title: ${parsed.title}`);
            console.log(`Content Length: ${parsed.content ? parsed.content.length : 0} characters`);
            console.log(`References count: ${parsed.references ? parsed.references.length : 0}`);
        } catch (e: any) {
            console.log(`JSON Parse: ❌ FAILED`);
            console.log(`Error: ${e.message}`);
            console.log(`First 50 chars: ${text.substring(0, 50).replace(/\\n/g, ' ')}`);
            console.log(`Last 50 chars: ${text.substring(text.length - 50).replace(/\\n/g, ' ')}`);

            // Check why it failed
            if (!text.startsWith('{')) console.log('Failure Reason: Did not start with {');
            if (!text.endsWith('}')) console.log('Failure Reason: Did not end with }');
        }

    } catch (err: any) {
        console.log(`❌ Request FAILED: ${err.message}`);
    }
}

async function main() {
    await testModel('gemini-3.1-pro-preview');
    await testModel('gemini-3-pro-preview');
    await testModel('gemini-2.5-pro');
}

main();
