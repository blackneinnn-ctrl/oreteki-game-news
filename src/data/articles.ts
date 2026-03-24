import { supabase, type Article } from '@/lib/supabase';
import {
  buildStoredArticleTags,
  DEFAULT_ARTICLE_CATEGORY,
  getArticleCategoryFromTags,
  stripInternalArticleTags,
  type ArticleCategory,
} from '@/lib/article-taxonomy';
import { normalizeLegacyArticleContent } from '@/lib/article-content-format';
import { normalizeGenerationPipelineVersion } from '@/lib/article-generation-pipeline';
import { calculateUsageCostUsd, usdToJpy } from '@/lib/api-usage-cost';
import { repairArticleTextFields, repairPossiblyMojibake } from '@/lib/text-repair';

type ArticleRecord = Omit<Article, 'category' | 'tags'> & {
  tags: string[] | null;
};

type ApiUsageRecord = {
  created_at: string;
  input_tokens: number;
  model: string;
  operation: string;
  output_tokens: number;
};

function isMissingApiUsageTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || /public\.api_usage/i.test(error.message ?? '');
}

function isMissingGenerationMetadataColumnsError(
  error: { code?: string; details?: string | null; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    /generation_(cost_(usd|jpy)|run_id|pipeline_version|model_summary)/i.test(
      `${error.message ?? ''} ${error.details ?? ''}`,
    )
  );
}

function normalizeArticle(article: ArticleRecord): Article {
  return repairArticleTextFields({
    ...article,
    content: normalizeLegacyArticleContent(article.content),
    category: getArticleCategoryFromTags(article.tags),
    generation_pipeline_version: normalizeGenerationPipelineVersion(article.generation_pipeline_version),
    generation_model_summary: article.generation_model_summary?.trim() || null,
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

async function backfillMissingGenerationCosts(articles: Article[]): Promise<Article[]> {
  const missingCostArticles = articles.filter(
    (article) => article.generation_cost_jpy == null && article.generation_cost_usd == null,
  );

  if (!missingCostArticles.length) {
    return articles;
  }

  const sortedArticles = [...articles].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
  const sortedMissingCostArticles = [...missingCostArticles].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
  const earliestArticleAt = new Date(sortedMissingCostArticles[0]?.created_at ?? Date.now());
  const fallbackWindowStart = new Date(earliestArticleAt.getTime() - 30 * 60 * 1000).toISOString();
  const latestArticleAt =
    sortedMissingCostArticles.at(-1)?.created_at ?? new Date().toISOString();

  const { data, error } = await supabase
    .from('api_usage')
    .select('created_at, model, input_tokens, output_tokens, operation')
    .in('operation', ['generate', 'checker', 'image_validation'])
    .gte('created_at', fallbackWindowStart)
    .lte('created_at', latestArticleAt)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingApiUsageTableError(error)) {
      return articles;
    }
    console.error('Error backfilling article generation costs:', error);
    return articles;
  }

  const usageLogs = (data ?? []) as ApiUsageRecord[];
  if (!usageLogs.length) {
    return articles;
  }

  const enrichedArticles = new Map(articles.map((article) => [article.id, article]));
  let usageIndex = 0;
  let previousBoundary = fallbackWindowStart;

  for (const article of sortedArticles) {
    const needsBackfill =
      article.generation_cost_jpy == null && article.generation_cost_usd == null;

    if (!needsBackfill) {
      previousBoundary = article.created_at;
      while (
        usageIndex < usageLogs.length &&
        usageLogs[usageIndex].created_at <= article.created_at
      ) {
        usageIndex += 1;
      }
      continue;
    }

    let totalUsd = 0;
    let cursor = usageIndex;

    while (cursor < usageLogs.length && usageLogs[cursor].created_at <= article.created_at) {
      if (usageLogs[cursor].created_at > previousBoundary) {
        totalUsd += calculateUsageCostUsd(
          usageLogs[cursor].model,
          usageLogs[cursor].input_tokens,
          usageLogs[cursor].output_tokens,
        );
      }
      cursor += 1;
    }

    if (totalUsd > 0) {
      enrichedArticles.set(article.id, {
        ...article,
        generation_cost_usd: Number(totalUsd.toFixed(4)),
        generation_cost_jpy: usdToJpy(totalUsd),
      });
    }

    usageIndex = cursor;
    previousBoundary = article.created_at;
  }

  return articles.map((article) => enrichedArticles.get(article.id) ?? article);
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
  const articlesWithCosts = await backfillMissingGenerationCosts(articles);
  return filterArticlesByCategory(articlesWithCosts, category);
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
  generation_cost_usd?: number | null;
  generation_cost_jpy?: number | null;
  generation_run_id?: string | null;
  generation_pipeline_version?: string | null;
  generation_model_summary?: string | null;
}): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (updates.excerpt !== undefined) payload.excerpt = repairPossiblyMojibake(updates.excerpt);
  if (updates.content !== undefined) payload.content = repairPossiblyMojibake(updates.content);
  if (updates.title !== undefined) payload.title = repairPossiblyMojibake(updates.title);
  if (updates.image_url !== undefined) payload.image_url = updates.image_url;
  if (updates.generation_cost_usd !== undefined) payload.generation_cost_usd = updates.generation_cost_usd;
  if (updates.generation_cost_jpy !== undefined) payload.generation_cost_jpy = updates.generation_cost_jpy;
  if (updates.generation_run_id !== undefined) payload.generation_run_id = updates.generation_run_id;
  if (updates.generation_pipeline_version !== undefined) payload.generation_pipeline_version = updates.generation_pipeline_version;
  if (updates.generation_model_summary !== undefined) payload.generation_model_summary = updates.generation_model_summary;

  if (updates.tags !== undefined || updates.category !== undefined) {
    const currentArticle = await getArticleById(id);
    if (!currentArticle) return false;

    payload.tags = buildStoredArticleTags(
      updates.tags ?? currentArticle.tags,
      updates.category ?? currentArticle.category,
    );
  }

  let { error } = await supabase
    .from('articles')
    .update(payload)
    .eq('id', id);

  if (
    error &&
    (
      updates.generation_cost_usd !== undefined ||
      updates.generation_cost_jpy !== undefined ||
      updates.generation_run_id !== undefined ||
      updates.generation_pipeline_version !== undefined ||
      updates.generation_model_summary !== undefined
    ) &&
    isMissingGenerationMetadataColumnsError(error)
  ) {
    delete payload.generation_cost_usd;
    delete payload.generation_cost_jpy;
    delete payload.generation_run_id;
    delete payload.generation_pipeline_version;
    delete payload.generation_model_summary;

    const fallback = await supabase
      .from('articles')
      .update(payload)
      .eq('id', id);

    error = fallback.error;
  }

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
  slug?: string;
  image_url?: string;
  author?: string;
  source_url?: string | null;
  source_name?: string | null;
  status?: 'draft' | 'published';
  category?: ArticleCategory;
  generation_cost_usd?: number | null;
  generation_cost_jpy?: number | null;
  generation_run_id?: string | null;
  generation_pipeline_version?: string | null;
  generation_model_summary?: string | null;
}): Promise<{ success: boolean; id?: string }> {
  const slug = article.slug?.trim() || `article-${Date.now()}`;
  const category = article.category ?? DEFAULT_ARTICLE_CATEGORY;
  const imageUrl = article.image_url?.trim();
  const status = article.status || 'draft';

  if (!imageUrl) {
    console.error('Error creating article: image_url is required');
    return { success: false };
  }

  const baseInsertPayload = {
    title: repairPossiblyMojibake(article.title),
    slug: slug,
    excerpt: repairPossiblyMojibake(article.excerpt || ''),
    content: repairPossiblyMojibake(article.content),
    tags: buildStoredArticleTags(article.tags, category),
    image_url: imageUrl,
    author: repairPossiblyMojibake(article.author || 'AI Editor'),
    source_url: article.source_url ?? null,
    source_name: article.source_name ?? null,
    status,
    views: 0,
    ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
  };

  const insertPayload = {
    ...baseInsertPayload,
    ...(article.generation_cost_usd != null ? { generation_cost_usd: article.generation_cost_usd } : {}),
    ...(article.generation_cost_jpy != null ? { generation_cost_jpy: article.generation_cost_jpy } : {}),
    ...(article.generation_run_id ? { generation_run_id: article.generation_run_id } : {}),
    ...(article.generation_pipeline_version ? { generation_pipeline_version: article.generation_pipeline_version } : {}),
    ...(article.generation_model_summary ? { generation_model_summary: article.generation_model_summary } : {}),
  };

  let { data, error } = await supabase
    .from('articles')
    .insert(insertPayload)
    .select('id')
    .single();

  if (
    error &&
    (
      article.generation_cost_usd != null ||
      article.generation_cost_jpy != null ||
      article.generation_run_id != null ||
      article.generation_pipeline_version != null ||
      article.generation_model_summary != null
    ) &&
    isMissingGenerationMetadataColumnsError(error)
  ) {
    const fallback = await supabase
      .from('articles')
      .insert(baseInsertPayload)
      .select('id')
      .single();

    data = fallback.data;
    error = fallback.error;
  }

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
