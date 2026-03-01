import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {

    // 2. Extra safety: Check if it's production. Even though middleware blocks it, 
    // it's good practice to have a defense-in-depth approach for this specific background execution.
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Generation is not allowed in production.' }, { status: 403 });
    }

    // 3. Reset progress file
    const cwd = process.cwd();
    const progressFile = path.join(cwd, '.generation-progress.json');
    try {
        fs.writeFileSync(progressFile, JSON.stringify({
            progress: 0,
            message: '初期化中...',
            status: 'running',
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error('[Generate API] Failed to initialize progress file', e);
    }

    // 4. Extract attribute from body and build command
    let attribute = 'game_news';
    let keyword = '';
    try {
        const body = await request.json();
        if (body.attribute) {
            attribute = body.attribute;
        }
        if (body.keyword) {
            keyword = body.keyword;
        }
    } catch (e) {
        // Ignore JSON parse error if body is empty or malformed
    }

    // Using npm run generate which points to tsx scripts/generate-articles.ts
    // 括弧などのエスケープ処理を考慮して、OSコマンドインジェクションを防ぐための最小限のサニタイズは行いませんが、シェルとして実行されるため二重引用符で囲みます。
    const command = `npm run generate -- --attribute ${attribute} ${keyword ? `"${keyword.replace(/"/g, '\\"')}"` : ''}`;

    console.log(`[Generate API] Spawned background process: ${command} in ${cwd}`);

    // 5. Execute the script in the background
    const child = exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Generate API] Error executing script: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`[Generate API] Script stderr: ${stderr}`);
            // Note: Some scripts write normal warnings to stderr, so we might not want to early return here.
        }
        console.log(`[Generate API] Script finished successfully. stdout:\n${stdout}`);
    });

    // We purposely don't await the child process here and return response immediately 
    // to prevent Vercel / Next.js API timeouts (usually 10s - 60s max depending on plan/config).

    return NextResponse.json({
        success: true,
        message: '記事生成プロセスをバックグラウンドで開始しました。ターミナルのログを確認してください。完了まで数分かかる場合があります。'
    });
}
