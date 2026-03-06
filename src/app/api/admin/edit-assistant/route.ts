import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/supabase';
import type { Content, Part } from '@google/genai';

// Initialize the Gemini client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ''
});

export async function POST(req: Request) {
    try {
        const { currentHtml, prompt, model, mode, image, conversationHistory } = await req.json();

        if (!prompt) {
            return NextResponse.json(
                { error: '指示(prompt)が必要です' },
                { status: 400 }
            );
        }

        const effectiveMode: 'chat' | 'apply' = mode || 'chat';

        // --- System instructions differ by mode ---
        const systemInstruction = effectiveMode === 'apply'
            ? `
あなたはHTML記事の優秀な編集アシスタントです。
ユーザーとの会話で合意した修正内容に基づいて、【現在のHTMLコード】を修正してください。

【厳守するルール】
1. 会話で合意された修正のみを行い、指示されていない部分のHTML構造や内容は可能な限り維持してください。
2. 返答には、やり取りの言葉やMarkdownのコードブロック（\`\`\`html など）は**一切含めず**、修正後の**生（Raw）のHTMLコードのみ**を出力してください。
3. HTMLはそのままブラウザのWYSIWYGエディタや表示領域に流し込まれます。余計な文字列が含まれると崩れる原因になります。

【コンプライアンス厳守ルール】
1. **動画の紹介:** 他者の動画（YouTubeなど）を紹介するよう構成する場合は、必ずプラットフォーム公式の「埋め込み機能（\`iframe\`等）」を利用する前提としてください。
2. **画像の「引用」ルール（著作権法第32条準拠）および孫引きの禁止:**
   * **孫引きの絶対禁止:** 個人のブログ、まとめサイト、非公式Wikiなどの二次情報源からの画像転用（孫引き）は絶対に行わないでください。画像を使用する場合は必ず公式元（公式サイト、公式SNS、メーカーのプレスリリース等）から直接引用してください。
   * **主従関係の厳守:** 記事のメインはあくまで「文章（主）」であり、画像は「文章を補足する要素（従）」となるよう、十分なテキスト量と論理的な解説を記述してください。画像がメインとなる構成は不可とします。
   * **明瞭区別性:** 引用する画像が入る場所には、そこが引用であることを示すタグやカギカッコ（例：\`<blockquote>\`タグなど）を使用する指示を明記してください。
   * **引用の必然性:** 「ただ見栄えを良くするため」「アイキャッチとして」の画像挿入は避け、その画像がないと文章の説明が成り立たない箇所にのみ引用を指示してください。
   * **出所の明示:** 画像を引用する箇所のすぐ下に、必ず「出所（サイト名、URL、著作者名など）」を記載するためのプレースホルダー（例：\`出典：<a href="URL">サイト名</a>\`）を設けてください。
   * **改変禁止の明記:** 引用画像はトリミングや文字入れ、色調補正などの加工を一切行わず、そのまま使用するよう注記を入れてください。
`
            : `
あなたはHTML記事の優秀な編集アシスタントです。
ユーザーと**会話形式**でやり取りし、修正内容を確認してから適用します。

【あなたの役割】
1. ユーザーの修正指示を受け取ったら、まず**何をどう修正するかを端的に説明**してください。
2. 画像が添付されている場合は、画像の内容を分析して説明してください。
3. ユーザーが認識相違がないか確認できるよう、具体的かつ簡潔に修正計画を伝えてください。
4. HTMLコードは**絶対に出力しないでください**。日本語のテキストのみで返答してください。
5. 返答は端的に（3〜5行程度で）まとめてください。長い説明は避けてください。

【返答例】
- 「見出しの<h2>タグのテキスト色を赤色(#e53e3e)に変更します。対象は全ての<h2>タグです。」
- 「画像を分析しました。2カラムレイアウトで左にメイン画像、右にテキストが配置されています。この構成を現在の記事に適用しますか？」
`;

        // --- Build contents array ---
        const contents: Content[] = [];

        // Add conversation history if provided
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                });
            }
        }

        // Build the current user message parts
        const userParts: Part[] = [];

        // Add image if provided
        if (image && image.data && image.mimeType) {
            userParts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.data
                }
            });
        }

        // Build user prompt text
        let userPromptText = '';
        if (effectiveMode === 'apply' && currentHtml) {
            userPromptText = `
【現在のHTMLコード】
${currentHtml}

【適用してください】
これまでの会話で合意した修正を、上記HTMLに適用してください。
`;
        } else if (currentHtml) {
            userPromptText = `
【現在のHTMLコード（参考）】
${currentHtml}

【ユーザーの指示】
${prompt}
`;
        } else {
            userPromptText = prompt;
        }

        userParts.push({ text: userPromptText });

        contents.push({
            role: 'user',
            parts: userParts
        });

        const response = await ai.models.generateContent({
            model: model || 'gemini-3.1-pro-preview',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        // Record usage in Supabase
        const usage = response.usageMetadata;
        if (usage) {
            await supabase.from('api_usage').insert({
                model: model || 'gemini-3.1-pro-preview',
                input_tokens: usage.promptTokenCount,
                output_tokens: usage.candidatesTokenCount,
                operation: 'edit'
            });
        }

        let outputText = response.text?.trim() || '';

        if (effectiveMode === 'apply') {
            // Clean up markdown code block wrappers if present
            outputText = outputText.replace(/^```(html)?\n?/i, '').replace(/\n?```$/i, '').trim();

            return NextResponse.json({
                success: true,
                type: 'apply',
                html: outputText,
                message: '✅ 修正が完了しました！プレビューに反映されています。'
            });
        } else {
            return NextResponse.json({
                success: true,
                type: 'chat',
                message: outputText
            });
        }

    } catch (error) {
        console.error('AI Edit Assistant API Error:', error);
        return NextResponse.json(
            { error: 'AIによる処理に失敗しました。サーバーエラーが発生しました。' },
            { status: 500 }
        );
    }
}
