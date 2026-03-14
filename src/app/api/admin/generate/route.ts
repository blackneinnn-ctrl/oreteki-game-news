import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { isValidGenerationAttribute } from '@/lib/article-taxonomy';

export async function POST(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Generation is not allowed in production.' }, { status: 403 });
    }

    const cwd = process.cwd();
    const progressFile = path.join(cwd, '.generation-progress.json');
    try {
        fs.writeFileSync(progressFile, JSON.stringify({
            progress: 0,
            message: '初期化中...',
            status: 'running',
            timestamp: Date.now(),
        }));
    } catch (error) {
        console.error('[Generate API] Failed to initialize progress file', error);
    }

    let attribute = 'game_news';
    let keyword = '';

    try {
        const body = await request.json();
        if (isValidGenerationAttribute(body.attribute)) {
            attribute = body.attribute;
        }
        if (typeof body.keyword === 'string') {
            keyword = body.keyword.trim();
        }
    } catch {
        // ignore malformed JSON
    }

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = ['run', 'generate', '--', '--attribute', attribute];
    if (keyword) {
        args.push(keyword);
    }

    console.log(`[Generate API] Spawned background process: ${npmCommand} ${args.join(' ')} in ${cwd}`);

    try {
        const child = spawn(npmCommand, args, {
            cwd,
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32', // Required for .cmd on Windows
        });

        child.on('error', (err) => {
            console.error('[Generate API] Spawn error:', err);
        });

        child.unref();

        return NextResponse.json({
            success: true,
            message: '記事生成をバックグラウンドで開始しました。ターミナルログと進捗表示で状況を確認できます。',
        });
    } catch (error) {
        console.error('[Generate API] Failed to spawn process:', error);
        return NextResponse.json({ error: 'バックグラウンドプロセスの開始に失敗しました。' }, { status: 500 });
    }
}
