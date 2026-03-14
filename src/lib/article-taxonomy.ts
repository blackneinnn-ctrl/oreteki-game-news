export const ARTICLE_CATEGORIES = ["game", "ai"] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const DEFAULT_ARTICLE_CATEGORY: ArticleCategory = "game";

const INTERNAL_CATEGORY_TAG_PREFIX = "__category:";

export const ARTICLE_CATEGORY_CONFIG: Record<
  ArticleCategory,
  {
    label: string;
    href: string;
    rankingHref: string;
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
    sectionTitle: string;
    emptyMessage: string;
    accentFrom: string;
    accentTo: string;
    glowClassName: string;
    chipClassName: string;
  }
> = {
  game: {
    label: "ゲーム",
    href: "/",
    rankingHref: "/ranking",
    heroEyebrow: "Game Radar",
    heroTitle: "ゲームの最新動向を最短で追う",
    heroDescription:
      "公式発表と一次情報を軸に、注目タイトルの発表、アップデート、セール情報をまとめて追えるゲームニュースページです。",
    sectionTitle: "最新ゲーム記事",
    emptyMessage: "ゲーム記事はまだありません。",
    accentFrom: "from-orange-500",
    accentTo: "to-red-500",
    glowClassName:
      "bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.18),transparent_50%)]",
    chipClassName:
      "border-orange-400/30 bg-orange-500/15 text-orange-100",
  },
  ai: {
    label: "AI",
    href: "/ai",
    rankingHref: "/ranking?category=ai",
    heroEyebrow: "AI Signal",
    heroTitle: "AIの最新発表と実務インパクトを整理する",
    heroDescription:
      "モデル更新、API変更、公式ブログ、研究発表を横断して、AI関連の重要トピックを追える専用ページです。",
    sectionTitle: "最新AI記事",
    emptyMessage: "AI記事はまだありません。",
    accentFrom: "from-cyan-400",
    accentTo: "to-sky-500",
    glowClassName:
      "bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.22),transparent_52%)]",
    chipClassName:
      "border-cyan-400/30 bg-cyan-500/15 text-cyan-50",
  },
};

export const ARTICLE_GENERATION_OPTIONS = [
  {
    value: "game_news",
    label: "ゲームニュース",
    category: "game",
    keywordPlaceholder: "例: Monster Hunter Wilds",
  },
  {
    value: "game_intro",
    label: "ゲーム紹介",
    category: "game",
    keywordPlaceholder: "例: Hades II",
  },
  {
    value: "ai_news",
    label: "AIニュース",
    category: "ai",
    keywordPlaceholder: "例: OpenAI, Gemini, Claude",
  },
  {
    value: "ai_research",
    label: "AIリサーチ",
    category: "ai",
    keywordPlaceholder: "例: AIエージェント, RAG, Sora",
  },
] as const;

export type ArticleGenerationAttribute =
  (typeof ARTICLE_GENERATION_OPTIONS)[number]["value"];

export function isArticleCategory(value: string | null | undefined): value is ArticleCategory {
  return ARTICLE_CATEGORIES.includes((value ?? "") as ArticleCategory);
}

export function parseArticleCategory(value: string | null | undefined): ArticleCategory {
  return isArticleCategory(value) ? value : DEFAULT_ARTICLE_CATEGORY;
}

export function getCategoryTag(category: ArticleCategory): string {
  return `${INTERNAL_CATEGORY_TAG_PREFIX}${category}`;
}

export function getArticleCategoryFromTags(tags: string[] | null | undefined): ArticleCategory {
  const normalizedTags = Array.isArray(tags) ? tags : [];
  const matched = normalizedTags.find((tag) => tag.startsWith(INTERNAL_CATEGORY_TAG_PREFIX));
  if (!matched) return DEFAULT_ARTICLE_CATEGORY;

  const category = matched.slice(INTERNAL_CATEGORY_TAG_PREFIX.length);
  return parseArticleCategory(category);
}

export function stripInternalArticleTags(tags: string[] | null | undefined): string[] {
  const normalizedTags = Array.isArray(tags) ? tags : [];
  const seen = new Set<string>();

  return normalizedTags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && !tag.startsWith(INTERNAL_CATEGORY_TAG_PREFIX))
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

export function buildStoredArticleTags(
  tags: string[] | null | undefined,
  category: ArticleCategory,
): string[] {
  return [getCategoryTag(category), ...stripInternalArticleTags(tags)];
}

export function getCategoryFromGenerationAttribute(
  attribute: ArticleGenerationAttribute,
): ArticleCategory {
  return ARTICLE_GENERATION_OPTIONS.find((option) => option.value === attribute)?.category ?? "game";
}

export function isValidGenerationAttribute(
  value: string | null | undefined,
): value is ArticleGenerationAttribute {
  return ARTICLE_GENERATION_OPTIONS.some((option) => option.value === value);
}

export function getGenerationOption(attribute: ArticleGenerationAttribute) {
  return ARTICLE_GENERATION_OPTIONS.find((option) => option.value === attribute) ?? ARTICLE_GENERATION_OPTIONS[0];
}
