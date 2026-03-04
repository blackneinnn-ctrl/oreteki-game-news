import { supabase, type Article } from '@/lib/supabase';

// 公開済み記事を全件取得（新しい順）
export async function getPublishedArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
  return data ?? [];
}

// スラグから記事を取得
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    console.error('Error fetching article:', error);
    return null;
  }
  return data;
}

// IDから記事を取得（プレビュー用などステータス問わず）
export async function getArticleById(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching article by id:', error);
    return null;
  }
  return data;
}

// 人気記事を取得（閲覧数順）
export async function getPopularArticles(limit: number = 5): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('views', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular articles:', error);
    return [];
  }
  return data ?? [];
}

// 注目記事を取得（最新3件）
export async function getFeaturedArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching featured articles:', error);
    return [];
  }
  return data ?? [];
}

// 全記事を取得（管理画面用）
export async function getAllArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all articles:', error);
    return [];
  }
  return data ?? [];
}

// 記事のステータスを更新
export async function updateArticleStatus(id: string, status: 'draft' | 'published'): Promise<boolean> {
  const updateData: Record<string, unknown> = { status };
  if (status === 'published') {
    updateData.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating article status:', error);
    return false;
  }
  return true;
}

// 記事を削除
export async function deleteArticle(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting article:', error);
    return false;
  }
  return true;
}

// 複数記事を一括削除
export async function deleteArticles(ids: string[]): Promise<boolean> {
  if (!ids.length) return true;

  const { error } = await supabase
    .from('articles')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error deleting multiple articles:', error);
    return false;
  }
  return true;
}

// 記事を編集
export async function updateArticle(id: string, updates: {
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  image_url?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating article:', error);
    return false;
  }
  return true;
}

// 新規記事を作成
export async function createArticle(article: {
  title: string;
  excerpt?: string;
  content: string;
  tags?: string[];
  image_url?: string;
  status?: 'draft' | 'published';
}): Promise<{ success: boolean; id?: string }> {
  const slug = `article-${Date.now()}`;
  const { data, error } = await supabase
    .from('articles')
    .insert({
      title: article.title,
      slug: slug,
      excerpt: article.excerpt || '',
      content: article.content,
      tags: article.tags || [],
      image_url: article.image_url || `https://picsum.photos/seed/${Date.now()}/1200/630`,
      author: '管理人',
      status: article.status || 'draft',
      views: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating article:', error);
    return { success: false };
  }
  return { success: true, id: data?.id };
}

// 関連記事を取得（同じタグを持つ記事、なければ最新記事）
export async function getRelatedArticles(
  currentId: string,
  tags: string[],
  limit: number = 4
): Promise<Article[]> {
  // First try to find articles with overlapping tags
  if (tags.length > 0) {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .neq('id', currentId)
      .overlaps('tags', tags)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data;
    }
  }

  // Fallback: latest articles excluding current
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .neq('id', currentId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
  return data ?? [];
}

// 閲覧数を増やす
export async function incrementViews(id: string): Promise<void> {
  await supabase.rpc('increment_views', { article_id: id });
}
