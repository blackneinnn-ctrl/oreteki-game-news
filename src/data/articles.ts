import { supabase, type Article } from '@/lib/supabase';
import {
  buildStoredArticleTags,
  DEFAULT_ARTICLE_CATEGORY,
  getArticleCategoryFromTags,
  stripInternalArticleTags,
  type ArticleCategory,
} from '@/lib/article-taxonomy';
import { repairArticleTextFields, repairPossiblyMojibake } from '@/lib/text-repair';

type ArticleRecord = Omit<Article, 'category' | 'tags'> & {
  tags: string[] | null;
};

function normalizeArticle(article: ArticleRecord): Article {
  return repairArticleTextFields({
    ...article,
    category: getArticleCategoryFromTags(article.tags),
    tags: stripInternalArticleTags(article.tags),
  });
}

function filterArticlesByCategory(
  articles: Article[],
  category?: ArticleCategory,
): Article[] {
  if (!category) return articles;
  return articles.filter((article) => article.category === category);
}

export async function getPublishedArticles(category?: ArticleCategory): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return [];
  }

  const articles = (data ?? []).map((article) => normalizeArticle(article as ArticleRecord));
  return filterArticlesByCategory(articles, category);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    if (error) {
      console.error('Error fetching article:', error);
    }
    return null;
  }

  return normalizeArticle(data as ArticleRecord);
}

export async function getArticleById(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error) {
      console.error('Error fetching article by id:', error);
    }
    return null;
  }

  return normalizeArticle(data as ArticleRecord);
}

export async function getPopularArticles(
  limit: number = 5,
  category?: ArticleCategory,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('views', { ascending: false });

  if (error) {
    console.error('Error fetching popular articles:', error);
    return [];
  }

  const articles = (data ?? []).map((article) => normalizeArticle(article as ArticleRecord));
  return filterArticlesByCategory(articles, category).slice(0, limit);
}

export async function getFeaturedArticles(category?: ArticleCategory): Promise<Article[]> {
  const articles = await getPublishedArticles(category);
  return articles.slice(0, 3);
}

export async function getAllArticles(category?: ArticleCategory): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all articles:', error);
    return [];
  }

  const articles = (data ?? []).map((article) => normalizeArticle(article as ArticleRecord));
  return filterArticlesByCategory(articles, category);
}

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

export async function updateArticle(id: string, updates: {
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  image_url?: string;
  category?: ArticleCategory;
}): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (updates.excerpt !== undefined) payload.excerpt = repairPossiblyMojibake(updates.excerpt);
  if (updates.content !== undefined) payload.content = repairPossiblyMojibake(updates.content);
  if (updates.title !== undefined) payload.title = repairPossiblyMojibake(updates.title);
  if (updates.image_url !== undefined) payload.image_url = updates.image_url;

  if (updates.tags !== undefined || updates.category !== undefined) {
    const currentArticle = await getArticleById(id);
    if (!currentArticle) return false;

    payload.tags = buildStoredArticleTags(
      updates.tags ?? currentArticle.tags,
      updates.category ?? currentArticle.category,
    );
  }

  const { error } = await supabase
    .from('articles')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Error updating article:', error);
    return false;
  }
  return true;
}

export async function createArticle(article: {
  title: string;
  excerpt?: string;
  content: string;
  tags?: string[];
  image_url?: string;
  status?: 'draft' | 'published';
  category?: ArticleCategory;
}): Promise<{ success: boolean; id?: string }> {
  const slug = `article-${Date.now()}`;
  const category = article.category ?? DEFAULT_ARTICLE_CATEGORY;
  const imageUrl = article.image_url?.trim();

  if (!imageUrl) {
    console.error('Error creating article: image_url is required');
    return { success: false };
  }

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title: repairPossiblyMojibake(article.title),
      slug: slug,
      excerpt: repairPossiblyMojibake(article.excerpt || ''),
      content: repairPossiblyMojibake(article.content),
      tags: buildStoredArticleTags(article.tags, category),
      image_url: imageUrl,
      author: 'AI Editor',
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

export async function getRelatedArticles(
  currentId: string,
  tags: string[],
  category: ArticleCategory,
  limit: number = 4,
): Promise<Article[]> {
  const relatedPool = (await getPublishedArticles(category)).filter((article) => article.id !== currentId);

  if (tags.length > 0) {
    const tagMatched = relatedPool.filter((article) => article.tags.some((tag) => tags.includes(tag)));
    if (tagMatched.length > 0) {
      return tagMatched.slice(0, limit);
    }
  }

  return relatedPool.slice(0, limit);
}

export async function incrementViews(id: string): Promise<void> {
  await supabase.rpc('increment_views', { article_id: id });
}
