import { NextRequest, NextResponse } from 'next/server';
import { getAllArticles, updateArticleStatus, deleteArticle, updateArticle, createArticle } from '@/data/articles';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function checkAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    const password = authHeader.replace('Bearer ', '');
    return password === ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const articles = await getAllArticles();
    return NextResponse.json(articles);
}

// ステータス変更
export async function PATCH(request: NextRequest) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await request.json();
    if (!id || !['draft', 'published'].includes(status)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const success = await updateArticleStatus(id, status);
    if (!success) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

// 記事の内容を編集
export async function PUT(request: NextRequest) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, title, excerpt, content, tags, image_url } = await request.json();
    if (!id) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) updates.tags = tags;
    if (image_url !== undefined) updates.image_url = image_url;

    const success = await updateArticle(id, updates);
    if (!success) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

// 新規記事を作成
export async function POST(request: NextRequest) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, excerpt, content, tags, image_url, status } = await request.json();
    if (!title || !content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const success = await createArticle({
        title,
        excerpt: excerpt || '',
        content: content,
        tags: tags || [],
        image_url: image_url || `https://picsum.photos/seed/${Date.now()}/1200/630`,
        status: status || 'draft',
    });

    if (!success) {
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const success = await deleteArticle(id);
    if (!success) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
