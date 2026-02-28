import { NextRequest, NextResponse } from 'next/server';
import { incrementViews } from '@/data/articles';

export async function POST(request: NextRequest) {
    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
        }

        await incrementViews(id);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to increment views' }, { status: 500 });
    }
}
