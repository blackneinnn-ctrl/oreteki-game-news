import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const progressFile = path.join(process.cwd(), '.generation-progress.json');

    try {
        if (!fs.existsSync(progressFile)) {
            return NextResponse.json({
                progress: 0,
                message: '待機中',
                status: 'idle',
                timestamp: Date.now()
            });
        }

        const data = fs.readFileSync(progressFile, 'utf-8');
        const parsed = JSON.parse(data);

        return NextResponse.json(parsed);
    } catch (e) {
        console.error('[Progress API] Error reading progress file:', e);
        return NextResponse.json({
            progress: 0,
            message: '進捗の取得に失敗しました',
            status: 'error',
            timestamp: Date.now()
        }, { status: 500 });
    }
}
