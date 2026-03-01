import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/supabase';

// Initialize the Gemini client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ''
});

export async function POST(req: Request) {
    try {
        const { currentHtml, prompt, model } = await req.json();

        if (!currentHtml || !prompt) {
            return NextResponse.json(
                { error: 'HTMLコンテンツと指示(prompt)が必要です' },
                { status: 400 }
            );
        }

        const systemInstruction = `
あなたはHTML記事の優秀な編集アシスタントです。
ユーザーから提供された【現在のHTMLコード】に対して、【ユーザーの指示】に従って内容を修正・追記・編集してください。

【厳守するルール】
1. 指示されていない部分のHTML構造や内容は可能な限り維持してください。
2. 返答には、やり取りの言葉やMarkdownのコードブロック（\`\`\`html など）は**一切含めず**、修正後の**生（Raw）のHTMLコードのみ**を出力してください。
3. HTMLはそのままブラウザのWYSIWYGエディタや表示領域に流し込まれます。余計な文字列が含まれると崩れる原因になります。
`;

        const userPrompt = `
【現在のHTMLコード】
${currentHtml}

【ユーザーの指示】
${prompt}
`;

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        // Record usage in Supabase
        const usage = response.usageMetadata;
        if (usage) {
            await supabase.from('api_usage').insert({
                model: model || 'gemini-2.5-flash',
                input_tokens: usage.promptTokenCount,
                output_tokens: usage.candidatesTokenCount,
                operation: 'edit'
            });
        }

        let outputHtml = response.text?.trim() || '';
        // 念のためMarkdownコードブロックが付与された場合は削除
        outputHtml = outputHtml.replace(/^```(html)?\n?/i, '').replace(/\n?```$/i, '').trim();

        return NextResponse.json({
            success: true,
            html: outputHtml
        });

    } catch (error) {
        console.error('AI Edit Assistant API Error:', error);
        return NextResponse.json(
            { error: 'AIによる編集に失敗しました。サーバーエラーが発生しました。' },
            { status: 500 }
        );
    }
}
