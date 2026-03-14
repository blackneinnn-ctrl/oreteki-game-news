import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

type Args = {
  slug: string;
  appId: string;
  youtubeId: string | null;
};

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
};

type SteamMedia = {
  headerImageUrl: string | null;
  screenshots: string[];
};

const MEDIA_REPAIR_START = '<!-- MEDIA_REPAIR:START -->';
const MEDIA_REPAIR_END = '<!-- MEDIA_REPAIR:END -->';

function parseArgs(argv: string[]): Args {
  let slug = '';
  let appId = '';
  let youtubeId: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slug') slug = argv[i + 1] ?? '';
    if (arg === '--app') appId = argv[i + 1] ?? '';
    if (arg === '--youtube') youtubeId = argv[i + 1] ?? null;
  }

  if (!slug || !appId) {
    throw new Error('Usage: npm run repair:article-media -- --slug <slug> --app <steamAppId> [--youtube <youtubeId>]');
  }

  return { slug, appId, youtubeId };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripExistingMediaRepairBlock(content: string): string {
  const start = content.indexOf(MEDIA_REPAIR_START);
  const end = content.indexOf(MEDIA_REPAIR_END);

  if (start === -1 || end === -1 || end < start) {
    return content.trim();
  }

  const before = content.slice(0, start).trim();
  const after = content.slice(end + MEDIA_REPAIR_END.length).trim();
  return [before, after].filter(Boolean).join('\n\n').trim();
}

async function fetchSteamMedia(appId: string): Promise<SteamMedia> {
  const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=japanese&cc=jp`);
  if (!response.ok) {
    throw new Error(`Steam appdetails request failed: ${response.status}`);
  }

  const payload = await response.json();
  const app = payload?.[appId];
  if (!app?.success || !app.data) {
    throw new Error(`Steam appdetails returned no data for app ${appId}`);
  }

  const screenshots = Array.isArray(app.data.screenshots)
    ? app.data.screenshots
        .map((item: { path_full?: string }) => item?.path_full)
        .filter((url: string | undefined): url is string => Boolean(url))
        .slice(0, 2)
    : [];

  return {
    headerImageUrl: typeof app.data.header_image === 'string' ? app.data.header_image : null,
    screenshots,
  };
}

function buildYouTubeBlock(title: string, youtubeId: string): string {
  const iframeTitle = `${title} - Official Trailer`;
  return [
    '<h2>Official Trailer</h2>',
    '<div class="video-wrapper">',
    `<iframe src="https://www.youtube.com/embed/${escapeHtmlAttr(youtubeId)}" title="${escapeHtmlAttr(iframeTitle)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`,
    '</div>',
  ].join('\n');
}

function buildScreenshotBlock(title: string, appId: string, screenshots: string[]): string {
  const steamUrl = `https://store.steampowered.com/app/${appId}/`;
  const figures = screenshots.map((url, index) => [
    '<figure>',
    `<img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(`${title} screenshot ${index + 1}`)}" loading="lazy">`,
    `<figcaption>Image: <a href="${escapeHtmlAttr(steamUrl)}" target="_blank" rel="noopener noreferrer">Steam</a></figcaption>`,
    '</figure>',
  ].join('\n'));

  return [
    '<h2>Screenshots</h2>',
    '<div class="grid gap-4 md:grid-cols-2">',
    ...figures,
    '</div>',
  ].join('\n');
}

function buildSteamWidgetBlock(appId: string): string {
  return [
    '<h2>Steam</h2>',
    `<div class="mt-8"><iframe src="https://store.steampowered.com/widget/${escapeHtmlAttr(appId)}/" frameborder="0" width="100%" height="190"></iframe></div>`,
  ].join('\n');
}

function buildMediaRepairBlock(title: string, appId: string, youtubeId: string | null, screenshots: string[]): string {
  const parts = [MEDIA_REPAIR_START];

  if (youtubeId) {
    parts.push(buildYouTubeBlock(title, youtubeId));
  }

  if (screenshots.length > 0) {
    parts.push(buildScreenshotBlock(title, appId, screenshots));
  }

  parts.push(buildSteamWidgetBlock(appId));
  parts.push(MEDIA_REPAIR_END);

  return parts.join('\n\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('id, slug, title, content, image_url, source_url, source_name')
    .eq('slug', args.slug)
    .maybeSingle<ArticleRow>();

  if (fetchError) {
    throw new Error(`Failed to fetch article: ${fetchError.message}`);
  }
  if (!article) {
    throw new Error(`Article not found for slug: ${args.slug}`);
  }

  const steamMedia = await fetchSteamMedia(args.appId);
  const baseContent = stripExistingMediaRepairBlock(article.content ?? '');
  const repairBlock = buildMediaRepairBlock(article.title, args.appId, args.youtubeId, steamMedia.screenshots);
  const nextContent = [baseContent, repairBlock].filter(Boolean).join('\n\n').trim();
  const steamStoreUrl = `https://store.steampowered.com/app/${args.appId}/`;
  const nextSourceUrl = article.source_url ?? steamStoreUrl;
  const nextSourceName = nextSourceUrl === steamStoreUrl ? 'Steam' : (article.source_name ?? 'Steam');

  const updates: Partial<ArticleRow> & { content: string } = {
    content: nextContent,
    image_url: steamMedia.headerImageUrl ?? article.image_url,
    source_url: nextSourceUrl,
    source_name: nextSourceName,
  };

  const { error: updateError } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', article.id);

  if (updateError) {
    throw new Error(`Failed to update article: ${updateError.message}`);
  }

  console.log(JSON.stringify({
    slug: article.slug,
    updated: true,
    image_url: updates.image_url,
    source_url: updates.source_url,
    source_name: updates.source_name,
    hasYouTube: Boolean(args.youtubeId),
    screenshotCount: steamMedia.screenshots.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
