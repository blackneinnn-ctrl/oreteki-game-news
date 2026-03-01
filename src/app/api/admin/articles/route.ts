import { NextRequest, NextResponse } from 'next/server';
import { getAllArticles, updateArticleStatus, deleteArticle, deleteArticles, updateArticle, createArticle } from '@/data/articles';

export async function GET(request: NextRequest) {

    const articles = await getAllArticles();
    return NextResponse.json(articles);
}

// ステータス変更
export async function PATCH(request: NextRequest) {

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

    const { id, ids } = await request.json();

    if (ids && Array.isArray(ids)) {
        if (ids.length === 0) return NextResponse.json({ success: true });

        const success = await deleteArticles(ids);
        if (!success) {
            return NextResponse.json({ error: 'Failed to delete multiple items' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    }

    if (!id) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const success = await deleteArticle(id);
    if (!success) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
