import { config } from 'dotenv';
config({ path: '.env.local' });

import RSSParser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import ytSearch from 'yt-search';

// ---- Media Source Rules ----
const OFFICIAL_SOURCE_DOMAINS = [
    'blog.playstation.com',
    'blog.ja.playstation.com',
    'news.xbox.com',
    'xbox.com',
    'nintendo.com',
    'nintendo.co.jp',
    'store.steampowered.com',
    'steamcommunity.com',
    'steampowered.com',
    'store.epicgames.com',
    'epicgames.com',
    'capcom.co.jp',
    'capcom-games.com',
    'capcom.com',
    'square-enix.com',
    'square-enix-games.com',
    'bandainamcoent.co.jp',
    'bandainamcoent.com',
    'sega.jp',
    'sega.com',
    'konami.com',
    'konami.net',
    'koeitecmo.co.jp',
    'fromsoftware.jp',
    'atlus.co.jp',
    'cygames.co.jp',
    'pokemon.com',
    'pokemon.co.jp',
    'prtimes.jp'
];

const OFFICIAL_YOUTUBE_CHANNELS = [
    'nintendo', 'playstation', 'xbox', 'capcom', 'square enix', 'bandai namco',
    'sega', 'konami', 'koei tecmo', 'ubisoft', 'ea', 'electronic arts',
    'bethesda', '2k', 'rockstar games', 'cd projekt red', 'mihoyo', 'hoyoverse',
    'level5', 'level-5', 'cygames', 'gemdrops', 'pokemon', 'pokemon jp', 'smash bros',
    'famitsu', '4gamer', 'ign', 'gamespot', 'automaton'
];

const DENY_IMAGE_DOMAINS = [
    'jin115.com', 'mutyun.com', 'esuteru.com', 'blog.esuteru.com',
    'geha', 'matome', 'wikipedia.org', 'fandom.com', 'wiki', 'note.com', 'hatenablog.com',
    '4gamer.net', 'famitsu.com', 'automaton-media.com', 'gamespark.jp', 'inside-games.jp'
];

function isOfficialOrAllowedSource(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        const hostname = url.hostname.toLowerCase();

        // 1. 繝悶Λ繝・け繝ｪ繧ｹ繝医メ繧ｧ繝・け・亥性繧蝣ｴ蜷医・蜊ｳNG・・
        for (const deny of DENY_IMAGE_DOMAINS) {
            if (hostname.includes(deny)) return false;
        }

        // 2. 蜈ｬ蠑上ラ繝｡繧､繝ｳ縺ｮ縺ｿ險ｱ蜿ｯ・亥ｮ悟・荳閾ｴ or 繧ｵ繝悶ラ繝｡繧､繝ｳ・・
        for (const allow of OFFICIAL_SOURCE_DOMAINS) {
            if (hostname === allow || hostname.endsWith(`.${allow}`)) return true;
        }

        return false; // 蜈ｬ蠑上ラ繝｡繧､繝ｳ莉･螟悶・蟄ｫ蠑輔″髦ｲ豁｢縺ｮ縺溘ａNG
    } catch {
        return false;
    }
}

// ---- Progress Reporting ----
const PROGRESS_FILE = path.join(process.cwd(), '.generation-progress.json');

function writeProgress(progress: number, message: string, status: 'running' | 'completed' | 'error' = 'running') {
    try {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ progress, message, status, timestamp: Date.now() }));
    } catch (e) {
        console.error('Failed to write progress file:', e);
    }
}

// ---- Config ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
    console.error('Missing environment variables. Check .env.local.');
    console.error('  SUPABASE_URL:', !!SUPABASE_URL);
    console.error('  SUPABASE_KEY:', !!SUPABASE_KEY);
    console.error('  GEMINI_KEY:', !!GEMINI_KEY);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
const parser = new RSSParser();

// ---- RSS Sources ----
const RSS_FEEDS = [
    { name: 'PlayStation.Blog JP', url: 'https://blog.ja.playstation.com/feed/' },
    { name: 'PlayStation.Blog', url: 'https://blog.playstation.com/feed/' },
    { name: 'Xbox Wire', url: 'https://news.xbox.com/en-us/feed/' },
    { name: 'Steam News', url: 'https://store.steampowered.com/feeds/news.xml' },
];

// ---- Helper: slugify ----
function slugify(text: string): string {
    const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60)
        .replace(/-$/, '');
    return slug || `article-${Date.now()}`;
}

// ---- Helper: sleep ----
function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// ---- Fetch RSS ----
interface NewsItem {
    title: string;
    link: string;
    sourceName: string;
    summary: string;
    fullContent?: string;  // スクレイピングした元記事本文
    pubDate?: Date;        // 記事の公開日時
}

interface ArticleReference {
    title: string;
    url: string;
}

interface GeneratedArticlePayload {
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    references: ArticleReference[];
}

interface ImageCandidate {
    url: string;
    sourceUrl: string;
    sourceName: string;
    sourceTitle: string;
    altText: string;
    contextText: string;
    order: number;
}

interface ContentSection {
    index: number;
    headingHtml: string;
    headingText: string;
    bodyHtml: string;
    contextText: string;
}

interface SplitContentResult {
    introHtml: string;
    sections: ContentSection[];
}

// ---- 蜈・ｨ倅ｺ区悽譁・せ繧ｯ繝ｬ繧､繝斐Φ繧ｰ ----
const CHARSET_ALIAS_MAP: Record<string, string> = {
    'utf8': 'utf-8',
    'utf-8': 'utf-8',
    'shift_jis': 'shift_jis',
    'shift-jis': 'shift_jis',
    'sjis': 'shift_jis',
    'x-sjis': 'shift_jis',
    'ms932': 'shift_jis',
    'cp932': 'shift_jis',
    'windows-31j': 'shift_jis',
    'euc-jp': 'euc-jp',
    'eucjp': 'euc-jp',
    'iso-2022-jp': 'iso-2022-jp'
};

function normalizeCharset(charset: string | null | undefined): string {
    if (!charset) return 'utf-8';
    const key = charset.trim().toLowerCase().replace(/["']/g, '');
    return CHARSET_ALIAS_MAP[key] || 'utf-8';
}

function detectCharsetFromHtmlHead(headLatin1: string): string | null {
    const metaCharset = headLatin1.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9._-]+)/i);
    if (metaCharset?.[1]) return metaCharset[1];

    const contentTypeMeta = headLatin1.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-zA-Z0-9._-]+)/i);
    if (contentTypeMeta?.[1]) return contentTypeMeta[1];

    return null;
}

function decodeHtmlResponse(buffer: Buffer, contentType: string | null): string {
    const headerCharset = contentType?.match(/charset\s*=\s*([a-zA-Z0-9._-]+)/i)?.[1] ?? null;
    const headLatin1 = buffer.subarray(0, 4096).toString('latin1');
    const metaCharset = detectCharsetFromHtmlHead(headLatin1);
    const charset = normalizeCharset(headerCharset || metaCharset);

    try {
        return new TextDecoder(charset).decode(buffer);
    } catch {
        return new TextDecoder('utf-8').decode(buffer);
    }
}

async function scrapeArticleContent(url: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return '';

        const htmlBuffer = Buffer.from(await res.arrayBuffer());
        const html = decodeHtmlResponse(htmlBuffer, res.headers.get('content-type')); 
        const $ = cheerio.load(html);

        // 荳崎ｦ√↑隕∫ｴ繧剃ｺ句燕縺ｫ髯､蜴ｻ
        $('script, style, nav, footer, header, aside, .ad, .advertisement, noscript').remove();

        // 譛ｬ譁・呵｣懆ｦ∫ｴ繧貞━蜈磯・↓隧ｦ縺ｿ繧・
        let text = '';
        const selectors = ['article', 'main', '.article-body', '.entry-content', '.post-content', '#content', '.content'];
        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0) {
                text = el.text().replace(/\s+/g, ' ').trim();
                if (text.length > 200) break;
            }
        }

        // 縺ｩ繧後ｂ繝偵ャ繝医＠縺ｪ縺九▲縺溷ｴ蜷医・ body 蜈ｨ菴薙°繧牙叙蠕・
        if (text.length < 200) {
            text = $('body').text().replace(/\s+/g, ' ').trim();
        }

        // 8000譁・ｭ励ｒ荳企剞縺ｫ繧ｫ繝・ヨ・医ヨ繝ｼ繧ｯ繝ｳ遽邏・ｼ・
        return text.substring(0, 8000);
    } catch {
        return '';
    }
}

async function fetchNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const now = new Date();
    // 48譎る俣莉･蜀・・險倅ｺ九・縺ｿ蟇ｾ雎｡
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`[RSS] Fetching: ${feed.name}...`);
            const result = await parser.parseURL(feed.url);
            const items = (result.items || []).slice(0, 10); // 螟壹ａ縺ｫ蜿門ｾ励＠縺ｦ繝輔ぅ繝ｫ繧ｿ繝ｼ蠕後↓邨槭ｋ

            let fetchedCount = 0;
            for (const item of items) {
                if (!item.title || !item.link) continue;

                // 蜈ｬ蠑上ラ繝｡繧､繝ｳ莉･螟悶・RSS險倅ｺ九・髯､螟・
                if (!isOfficialOrAllowedSource(item.link)) {
                    console.log(`  [skip] non-official domain: ${item.link}`);
                    continue;
                }

                // 譌･莉倥ヵ繧｣繝ｫ繧ｿ繝ｪ繝ｳ繧ｰ
                const pubDate = item.pubDate ? new Date(item.pubDate) : null;
                if (pubDate && pubDate < cutoff) {
                    console.log(`  [skip] older article (${pubDate.toLocaleDateString('ja-JP')}): ${item.title.substring(0, 40)}...`);
                    continue;
                }

                // 蜈・ｨ倅ｺ区悽譁・ｒ繧ｹ繧ｯ繝ｬ繧､繝斐Φ繧ｰ
                console.log(`  [scrape] fetching article body: ${item.link}`);
                const fullContent = await scrapeArticleContent(item.link);
                if (fullContent) {
                    console.log('  Scraped article body successfully.');
                } else {
                    console.log('  ⚠️ Failed to scrape article body; summary-only mode.');
                }

                allItems.push({
                    title: item.title,
                    link: item.link,
                    sourceName: feed.name,
                    summary: item.contentSnippet || item.content || '',
                    fullContent: fullContent || undefined,
                    pubDate: pubDate || undefined,
                });

                fetchedCount++;
                if (fetchedCount >= 5) break; // 繝輔ぅ繝ｼ繝峨≠縺溘ｊ譛螟ｧ5莉ｶ
            }
            console.log('  Fetched recent items.');
        } catch (err) {
            console.warn(`  [error] ${err instanceof Error ? err.message : err}`);
        }
    }

    return allItems;
}

// ---- Check duplicates ----
async function isDuplicate(sourceUrl: string): Promise<boolean> {
    const { data } = await supabase
        .from('articles')
        .select('id')
        .eq('source_url', sourceUrl)
        .limit(1);

    return (data?.length ?? 0) > 0;
}

// ---- Validation Helpers ----
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
};

async function isUrlValid(url: string, isImage = false): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let res = await fetch(url, { method: 'HEAD', headers: FETCH_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            if (isImage) {
                const contentType = res.headers.get('content-type');
                if (contentType && !contentType.startsWith('image/')) return false;
            }
            return true;
        }

        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
        res = await fetch(url, { method: 'GET', headers: { ...FETCH_HEADERS, Range: 'bytes=0-100' }, signal: controller2.signal });
        clearTimeout(timeoutId2);

        if (res.ok || res.status === 206) {
            if (isImage) {
                const contentType = res.headers.get('content-type');
                if (contentType && !contentType.startsWith('image/')) return false;
            }
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

const CONTENT_IMAGE_SELECTORS = 'article img, main img, .article-body img, .entry-content img, .post-content img, #content img, .content img';
const MATCH_STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'news', 'article', 'game', 'games', 'official',
    'week', 'share', 'update', 'video', 'image', 'images', 'playstation', 'xbox', 'steam',
    '公式', '今週', '記事', '画像', '動画', '紹介', 'ニュース', 'ゲーム', 'その', 'これ', 'それ'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeGeneratedArticlePayload(value: unknown): GeneratedArticlePayload | null {
    if (!isRecord(value)) return null;

    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const excerpt = typeof value.excerpt === 'string' ? value.excerpt.trim() : '';
    const content = typeof value.content === 'string' ? value.content.trim() : '';

    if (!title || !excerpt || !content) return null;

    const tags = Array.isArray(value.tags)
        ? value.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
            .map((tag) => tag.trim())
            .slice(0, 12)
        : [];

    const references: ArticleReference[] = Array.isArray(value.references)
        ? value.references
            .filter(isRecord)
            .map((ref) => ({
                title: typeof ref.title === 'string' ? ref.title.trim() : '',
                url: typeof ref.url === 'string' ? ref.url.trim() : ''
            }))
            .filter((ref) => ref.url.length > 0)
        : [];

    return { title, excerpt, content, tags, references };
}

function toPlainTextFromHtml(input: string): string {
    const $ = cheerio.load(`<div>${input}</div>`);
    return $('div').text().replace(/\s+/g, ' ').trim();
}

function escapeHtmlAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function extractUrlFromSrcset(srcset: string): string | null {
    const parts = srcset.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const best = parts[parts.length - 1];
    const urlPart = best.split(/\s+/)[0]?.trim();
    return urlPart || null;
}

function normalizeImageUrl(rawUrl: string, baseUrl: string): string | null {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;

    try {
        if (trimmed.startsWith('//')) {
            return new URL(`https:${trimmed}`).toString();
        }
        return new URL(trimmed, baseUrl).toString();
    } catch {
        return null;
    }
}

function isLikelyDecorativeImage(url: string, altText: string, className: string, widthAttr?: string, heightAttr?: string): boolean {
    const lowerUrl = url.toLowerCase();
    const lowerAlt = altText.toLowerCase();
    const lowerClass = className.toLowerCase();

    if (lowerUrl.endsWith('.svg')) return true;
    if (lowerUrl.includes('favicon')) return true;
    if (lowerUrl.includes('/avatar') || lowerUrl.includes('profile')) return true;

    const decorativeHints = [
        'logo', 'icon', 'sprite', 'spacer', 'placeholder', 'blank',
        'share', 'social', 'button', 'banner', 'ads', 'advert', 'tracking', 'pixel'
    ];

    if (decorativeHints.some((hint) => lowerUrl.includes(hint))) return true;
    if (decorativeHints.some((hint) => lowerAlt.includes(hint))) return true;
    if (decorativeHints.some((hint) => lowerClass.includes(hint))) return true;

    const width = widthAttr ? Number.parseInt(widthAttr, 10) : NaN;
    const height = heightAttr ? Number.parseInt(heightAttr, 10) : NaN;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width < 220 && height < 220) {
        return true;
    }

    return false;
}

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function buildUrlTokenText(url: string): string {
    try {
        const parsed = new URL(url);
        const tokenSource = `${parsed.hostname} ${parsed.pathname} ${parsed.search}`
            .replace(/[\/_\-.?=&+%]+/g, ' ')
            .toLowerCase();
        return safeDecodeURIComponent(tokenSource);
    } catch {
        return url.toLowerCase();
    }
}

function tokenizeForMatch(text: string): string[] {
    const normalized = text.toLowerCase();
    const latin = normalized.match(/[a-z0-9]{2,}/g) ?? [];
    const cjk = normalized.match(/[\u3040-\u30ff\u3400-\u9fffー]{2,}/g) ?? [];

    const tokens = [...latin, ...cjk].map((token) => token.trim()).filter(Boolean);
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
        if (MATCH_STOP_WORDS.has(token)) continue;
        if (seen.has(token)) continue;
        seen.add(token);
        unique.push(token);
    }

    return unique;
}

function scoreCandidateForContext(contextText: string, candidate: ImageCandidate): number {
    const contextTokens = tokenizeForMatch(contextText);
    if (contextTokens.length === 0) return 0;

    const candidateText = `${candidate.altText} ${candidate.contextText} ${candidate.sourceTitle} ${buildUrlTokenText(candidate.url)}`;
    const candidateTokens = new Set(tokenizeForMatch(candidateText));
    let score = 0;

    for (const token of contextTokens) {
        if (!candidateTokens.has(token)) continue;
        if (token.length >= 8) score += 5;
        else if (token.length >= 5) score += 3;
        else score += 2;
    }

    return score;
}

function rankCandidatesByContext(contextText: string, candidates: ImageCandidate[], usedUrls?: Set<string>): Array<{ candidate: ImageCandidate; score: number }> {
    return candidates
        .filter((candidate) => !usedUrls || !usedUrls.has(candidate.url))
        .map((candidate) => ({ candidate, score: scoreCandidateForContext(contextText, candidate) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.candidate.order - b.candidate.order;
        });
}

function splitContentByH2(content: string): SplitContentResult {
    const headingRegex = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
    const matches = [...content.matchAll(headingRegex)];

    if (matches.length === 0) {
        return {
            introHtml: content,
            sections: []
        };
    }

    const introHtml = content.slice(0, matches[0].index ?? 0);
    const sections: ContentSection[] = [];

    for (let i = 0; i < matches.length; i++) {
        const headingHtml = matches[i][0];
        const start = (matches[i].index ?? 0) + headingHtml.length;
        const nextIndex = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
        const bodyHtml = content.slice(start, nextIndex);
        const headingText = toPlainTextFromHtml(headingHtml);
        const contextText = `${headingText} ${toPlainTextFromHtml(bodyHtml).slice(0, 500)}`.trim();

        sections.push({
            index: i,
            headingHtml,
            headingText,
            bodyHtml,
            contextText
        });
    }

    return { introHtml, sections };
}

function buildImageFigureTag(image: ImageCandidate, altBase: string): string {
    const altText = altBase.trim().length > 0 ? altBase : image.sourceTitle || 'Article image';
    const escapedAlt = escapeHtmlAttr(altText);
    const escapedUrl = escapeHtmlAttr(image.url);
    const escapedSourceUrl = escapeHtmlAttr(image.sourceUrl);
    const escapedSourceName = escapeHtmlText(image.sourceName);

    return `<figure class="my-8"><img src="${escapedUrl}" alt="${escapedAlt}" class="w-full rounded-xl"><figcaption class="text-right text-xs text-zinc-500 mt-2">画像引用元: <a href="${escapedSourceUrl}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline px-2">${escapedSourceName}</a></figcaption></figure>\n`;
}

function buildContentWithSectionImages(split: SplitContentResult, sectionImages: Map<number, ImageCandidate>): string {
    if (split.sections.length === 0) return split.introHtml;

    let rebuilt = split.introHtml;
    for (const section of split.sections) {
        rebuilt += section.headingHtml;
        const matchedImage = sectionImages.get(section.index);
        if (matchedImage) {
            rebuilt += buildImageFigureTag(matchedImage, section.headingText);
        }
        rebuilt += section.bodyHtml;
    }

    return rebuilt;
}

function scrapeImageCandidatesFromHtml(html: string, pageUrl: string): Array<{ url: string; altText: string; contextText: string }> {
    const $ = cheerio.load(html);
    const output: Array<{ url: string; altText: string; contextText: string }> = [];
    const seen = new Set<string>();
    const documentTitle = $('title').first().text().trim();

    const pushCandidate = (
        rawUrl: string | undefined,
        altText = '',
        contextText = '',
        className = '',
        widthAttr?: string,
        heightAttr?: string
    ) => {
        if (!rawUrl) return;
        const normalized = normalizeImageUrl(rawUrl, pageUrl);
        if (!normalized) return;
        if (seen.has(normalized)) return;
        if (isLikelyDecorativeImage(normalized, altText, className, widthAttr, heightAttr)) return;

        seen.add(normalized);
        output.push({
            url: normalized,
            altText: altText.trim(),
            contextText: `${documentTitle} ${contextText}`.replace(/\s+/g, ' ').trim()
        });
    };

    const metaImageSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]'
    ];

    for (const selector of metaImageSelectors) {
        pushCandidate($(selector).attr('content'), '', documentTitle);
    }

    let imageNodes = $(CONTENT_IMAGE_SELECTORS).toArray();
    if (imageNodes.length === 0) {
        imageNodes = $('img').toArray();
    }

    for (const node of imageNodes.slice(0, 80)) {
        const img = $(node);
        const srcsetUrl = extractUrlFromSrcset(img.attr('srcset') || img.attr('data-srcset') || '');
        const rawUrl = srcsetUrl
            || img.attr('src')
            || img.attr('data-src')
            || img.attr('data-lazy-src')
            || img.attr('data-original');

        const altText = img.attr('alt') || '';
        const caption = img.closest('figure').find('figcaption').first().text() || '';
        const nearbyHeading = img.parent().prevAll('h1,h2,h3').first().text() || '';
        const titleText = img.attr('title') || '';
        const contextText = `${caption} ${nearbyHeading} ${titleText}`.replace(/\s+/g, ' ').trim();

        pushCandidate(rawUrl, altText, contextText, img.attr('class') || '', img.attr('width') || undefined, img.attr('height') || undefined);
    }

    return output;
}

async function collectImageCandidatesFromReferences(references: ArticleReference[], fallbackNews: NewsItem): Promise<ImageCandidate[]> {
    const candidates: ImageCandidate[] = [];
    const seen = new Set<string>();
    let order = 0;

    const collectFromSource = async (sourceUrl: string, sourceTitle: string, sourceName: string) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            const res = await fetch(sourceUrl, { headers: FETCH_HEADERS, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) return;

            const html = await res.text();
            const scraped = scrapeImageCandidatesFromHtml(html, sourceUrl);

            for (const item of scraped) {
                if (seen.has(item.url)) continue;
                seen.add(item.url);
                candidates.push({
                    url: item.url,
                    sourceUrl,
                    sourceName,
                    sourceTitle,
                    altText: item.altText,
                    contextText: item.contextText,
                    order: order++
                });
            }
        } catch {
            // Ignore source-level fetch failures and continue with the next source.
        }
    };

    for (const ref of references) {
        if (!ref.url || !isOfficialOrAllowedSource(ref.url)) continue;

        let sourceName = ref.title;
        if (!sourceName) {
            try {
                sourceName = new URL(ref.url).hostname;
            } catch {
                sourceName = ref.url;
            }
        }

        await collectFromSource(ref.url, ref.title || sourceName, sourceName);
    }

    if (candidates.length === 0 && fallbackNews.link && isOfficialOrAllowedSource(fallbackNews.link)) {
        const fallbackSourceName = fallbackNews.sourceName || new URL(fallbackNews.link).hostname;
        await collectFromSource(fallbackNews.link, fallbackNews.title, fallbackSourceName);
    }

    return candidates.slice(0, 60);
}
// ---- Media Fetching Helpers ----

async function searchYouTubeAPI(query: string): Promise<string | null> {
    try {
        console.log(`  [search] YouTube: ${query}`);
        const r = await ytSearch(query);
        // 荳贋ｽ・0莉ｶ縺九ｉ蜈ｬ蠑上メ繝｣繝ｳ繝阪Ν縺ｫ霑代＞繧ゅ・繧呈爾縺・
        const videos = r.videos.slice(0, 10);

        for (const video of videos) {
            const authorName = (video.author?.name || '').toLowerCase();

            // 蜈ｬ蠑上メ繝｣繝ｳ繝阪Ν縺ｮ繝ｪ繧ｹ繝医→驛ｨ蛻・ｸ閾ｴ縺吶ｋ縺九メ繧ｧ繝・け
            const isOfficial = OFFICIAL_YOUTUBE_CHANNELS.some(official => authorName.includes(official));

            // Channel蜷阪↓official繧・・蠑上′蜷ｫ縺ｾ繧後※縺・ｋ縺九ｂ繝√ぉ繝・け
            if (isOfficial || authorName.includes('official')) {
                console.log(`  [ok] official YouTube video: ${video.title} (channel: ${video.author.name})`);
                return video.videoId;
            }
        }

        console.log('  No official-looking YouTube video found.');
        return null;
    } catch (e) {
        console.error('  [error] YouTube search failed:', e);
        return null;
    }
}

async function searchSteamAppID(query: string): Promise<string | null> {
    try {
        console.log(`  [search] Steam: ${query}`);
        const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=japanese&cc=jp`);
        if (!res.ok) return null;

        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
            // 荳逡ｪ髢｢騾｣諤ｧ縺ｮ鬮倥＞繧ゅ・繧呈治逕ｨ
            // (豕ｨ諢・ 譌･譛ｬ隱槫錐縺ｨ闍ｱ隱槫錐縺ｮ謠ｺ繧檎ｭ峨ｂ縺ゅｋ縺溘ａ縲√ち繧､繝医Ν縺ｮ譁・ｭ怜・縺悟ｮ悟・縺ｫ蜷ｫ縺ｾ繧後ｋ縺狗ｭ峨・蜴ｳ譬ｼ縺ｪ繝√ぉ繝・け繧定ｿｽ蜉縺吶ｋ縺薙→繧ょ庄閭ｽ縺ｧ縺吶′縲・
            // 蜈ｬ蠑就PI縺ｮ譛蛻昴・邨先棡縺ｯ讎ゅ・豁｣遒ｺ縺ｧ縺ゅｋ縺溘ａ縺昴・縺ｾ縺ｾ謗｡逕ｨ縺励∪縺吶・
            return data.items[0].id.toString();
        }
        return null; // 隕九▽縺九ｉ縺ｪ縺・ｼ域悴逋ｺ螢ｲ縺ｪ縺ｩ・・
    } catch (e) {
        console.error('  [error] Steam search failed:', e);
        return null;
    }
}

// ---- AI Image Validation ----
async function validateImageWithAI(imageUrl: string, articleTitle: string, articleExcerpt: string): Promise<boolean> {
    try {
        console.log(`  [vision] checking image relevance: ${imageUrl}`);
        // 1. 逕ｻ蜒上・蜿門ｾ励→Base64繧ｨ繝ｳ繧ｳ繝ｼ繝・
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 逕ｻ蜒丞叙蠕励・蟆代＠髟ｷ繧√↓蠕・▽
        const res = await fetch(imageUrl, { headers: FETCH_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) return false;

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = res.headers.get('content-type') || 'image/jpeg';

        // 譛牙柑縺ｪ逕ｻ蜒舟IME繧ｿ繧､繝励°邁｡譏薙メ繧ｧ繝・け
        if (!mimeType.startsWith('image/')) return false;

        // 2. Gemini Vision API縺ｫ蛻､螳壹ｒ萓晞ｼ
        const prompt = `
You are a strict visual relevance checker for game news articles.
Decide whether the provided image is directly relevant to the article context.

Article title: ${articleTitle}
Article excerpt: ${articleExcerpt}

Output rule:
- Return only "true" or "false".
- true: screenshot, key art, character art, package art that clearly matches the article.
- false: logos, icons, avatars, ads, generic banners, or unrelated images.
`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]
        });

        // Record usage in Supabase
        const usage = response.usageMetadata;
        if (usage) {
            await supabase.from('api_usage').insert({
                model: 'gemini-3.1-pro-preview',
                input_tokens: usage.promptTokenCount,
                output_tokens: usage.candidatesTokenCount,
                operation: 'image_validation'
            });
        }

        const textOutput = response.text?.trim().toLowerCase() || '';
        const isValid = textOutput.includes('true');

        console.log('  Image validation result: ' + (isValid ? 'accepted' : 'rejected') + ' (' + textOutput + ')');
        return isValid;

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('  Image validation failed; defaulting to accepted. Error: ' + errorMessage);
        // 繧ｨ繝ｩ繝ｼ縺ｧ險倅ｺ狗函謌舌′豁｢縺ｾ繧九・繧帝亟縺舌◆繧√∵怙菴朱剞縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺ｨ縺励※true繧定ｿ斐☆
        return true;
    }
}

// ---- Generate article with AI (with retry) ----
async function generateArticle(
    news: NewsItem,
    attribute: string = 'game_news',
    onProgress?: (msg: string, offset: number) => void,
    retries = 3
): Promise<{
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    slug: string;
    mainImageUrl: string;
} | null> {
    const mediaPlacementRule = `
- Use only official sources for media and factual claims.
- Keep text as the primary content; media should support each section.
- For roundup or multi-title articles, include at least one official reference URL per major H2 section.
- Do not output <img> tags in content. The system inserts images automatically.
`;

    const basePrompt = `
You are a Japanese gaming news editor.
Write a complete article in Japanese using the source information below.
Use only verifiable facts from official sources. If information is unknown, write "現時点では未発表です".

Output requirements:
- Return JSON only (no markdown fences).
- JSON keys: title, excerpt, content, tags, references.
 - content must be valid HTML with multiple <h2> sections.
 - Do not cap article body length. Write as much detail as needed when facts justify it.
- references must contain only official URLs and should be ordered by relevance.
${mediaPlacementRule}

News title: ${news.title}
Source name: ${news.sourceName}
Source URL: ${news.link || 'N/A'}
Summary: ${news.summary.substring(0, 500)}

Scraped body:
${news.fullContent
            ? `${news.fullContent.substring(0, 8000)}`
            : 'No scraped body available. Use web search to fill factual gaps.'}

JSON schema:
{
  "title": "string",
  "excerpt": "string",
  "content": "<p>...</p><h2>...</h2>...",
  "tags": ["tag1", "tag2", "tag3"],
  "references": [
    { "title": "official source title", "url": "https://..." }
  ]
}
`;

    const modePrompt = attribute === "game_intro"
        ? `
Style guidance:
- Write as an introductory feature for readers who are new to the game.
- Explain core appeal, gameplay loop, and who will enjoy it.
- Include one <h2> section for official product facts (platform, release date, price if available).
`
        : `
Style guidance:
- Write as a timely news article.
- Focus on what changed, why it matters, and player impact.
- Include one <h2> section that summarizes official facts and links.
`;

    const prompt = `${basePrompt}
${modePrompt}`;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            onProgress?.('Generating article body with AI...', 1);
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json',
                    maxOutputTokens: 65535
                }
            });

            // Record usage in Supabase
            const usage = response.usageMetadata;
            if (usage) {
                await supabase.from('api_usage').insert({
                    model: 'gemini-3.1-pro-preview',
                    input_tokens: usage.promptTokenCount,
                    output_tokens: usage.candidatesTokenCount,
                    operation: 'generate'
                });
            }

            const text = response.text?.trim() || '';
            let jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

            // JSON蜀・・繧ｨ繧ｹ繧ｱ繝ｼ繝励＆繧後※縺・↑縺・宛蠕｡譁・ｭ暦ｼ域隼陦後√ち繝悶↑縺ｩ・峨ｒ繧ｵ繝九ち繧､繧ｺ
            jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, "");

            // AI縺後∪繧後↓蜃ｺ蜉帙☆繧徽SON莉･螟悶・荳崎ｦ√↑蜑咲ｽｮ縺阪・蠕梧嶌縺阪ｒ蜑企勁縺吶ｋ縺溘ａ縲∵怙蛻昴→譛蠕後・荳ｭ諡ｬ蠑ｧ繧呈歓蜃ｺ
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const parsedRaw = JSON.parse(jsonStr);
            const parsed = normalizeGeneratedArticlePayload(parsedRaw);
            if (!parsed) {
                throw new Error('AI response is missing required fields.');
            }

            onProgress?.('記事に関連する画像を収集中...', 2);
            const imageCandidates = await collectImageCandidatesFromReferences(parsed.references, news);

            const urlValidityCache = new Map<string, boolean>();
            const aiRelevanceCache = new Map<string, boolean>();

            const validateImageForContext = async (image: ImageCandidate, contextTitle: string, contextExcerpt: string): Promise<boolean> => {
                const urlCache = urlValidityCache.get(image.url);
                if (urlCache === false) return false;

                if (urlCache === undefined) {
                    const isValidLink = await isUrlValid(image.url, true);
                    urlValidityCache.set(image.url, isValidLink);
                    if (!isValidLink) return false;
                }

                const contextKey = `${image.url}::${contextTitle}::${contextExcerpt.slice(0, 160)}`;
                const cached = aiRelevanceCache.get(contextKey);
                if (cached !== undefined) return cached;

                const isRelevant = await validateImageWithAI(image.url, contextTitle, contextExcerpt);
                aiRelevanceCache.set(contextKey, isRelevant);
                return isRelevant;
            };

            const articleContext = `${parsed.title} ${parsed.excerpt}`;
            const rankedForArticle = rankCandidatesByContext(articleContext, imageCandidates);
            const approvedCandidates: ImageCandidate[] = [];

            for (const ranked of rankedForArticle.slice(0, 12)) {
                onProgress?.(`画像候補のAI視覚判定中 (${approvedCandidates.length + 1}/8)...`, 3);
                const isRelevant = await validateImageForContext(ranked.candidate, parsed.title, parsed.excerpt);
                if (!isRelevant) continue;
                approvedCandidates.push(ranked.candidate);
                if (approvedCandidates.length >= 8) break;
            }

            if (approvedCandidates.length === 0 && imageCandidates.length > 0) {
                approvedCandidates.push(...imageCandidates.slice(0, 4));
            }

            const split = splitContentByH2(parsed.content);
            const sectionImages = new Map<number, ImageCandidate>();
            const usedUrls = new Set<string>();

            for (const section of split.sections) {
                const rankedForSection = rankCandidatesByContext(section.contextText, approvedCandidates, usedUrls).slice(0, 4);

                for (const ranked of rankedForSection) {
                    if (ranked.score <= 0) continue;

                    const contextTitle = `${parsed.title} / ${section.headingText}`;
                    const contextExcerpt = section.contextText.slice(0, 450);
                    const isSectionRelevant = await validateImageForContext(ranked.candidate, contextTitle, contextExcerpt);
                    if (!isSectionRelevant) continue;

                    sectionImages.set(section.index, ranked.candidate);
                    usedUrls.add(ranked.candidate.url);
                    console.log(`  ? セクションに画像割り当て: ${section.headingText}`);
                    break;
                }
            }

            let contentWithImages = parsed.content;
            if (split.sections.length > 0 && sectionImages.size > 0) {
                contentWithImages = buildContentWithSectionImages(split, sectionImages);
                console.log(`  [image] inserted context-matched images: ${sectionImages.size}`);
            } else if (split.sections.length === 0 && approvedCandidates.length > 0) {
                contentWithImages += buildImageFigureTag(approvedCandidates[0], parsed.title);
            }

            let finalContent = '';
            let mainImageUrl = '';

            const topImage = approvedCandidates[0] || null;
            const firstSectionImage = split.sections
                .map((section) => sectionImages.get(section.index))
                .find((image): image is ImageCandidate => Boolean(image)) || null;

            if (topImage) {
                mainImageUrl = topImage.url;
            } else if (firstSectionImage) {
                mainImageUrl = firstSectionImage.url;
            }

            // Node環境でYouTubeとSteamのIDを検索
            onProgress?.('関連動画とストア情報を検索中...', 4);
            // 検索精度を上げるため、AIが付けた長いタイトルではなくシンプルなキーワードを抽出する
            const simpleGameTitle = parsed.title.split('｜')[0].split(' - ')[0].replace(/「.*?」/g, '').trim();
            const searchQuery = `${simpleGameTitle} 公式 トレイラー`;
            const videoId = await searchYouTubeAPI(searchQuery);
            const steamId = await searchSteamAppID(parsed.title);

            // YouTubeが検索できれば冒頭に埋め込み、なければ必要時のみトップ画像を挿入
            if (videoId) {
                finalContent += `<div class="aspect-video mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>\n`;

                // YouTubeサムネイルをフォールバック画像に設定
                if (!mainImageUrl) {
                    mainImageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                    console.log(`  [image] using YouTube thumbnail as main image: ${mainImageUrl}`);
                }
            } else if (sectionImages.size === 0 && topImage) {
                finalContent += `<figure class="mb-8 w-full"><div class="overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><img src="${escapeHtmlAttr(topImage.url)}" alt="${escapeHtmlAttr(parsed.title)}" class="w-full h-auto object-cover max-h-[60vh]"></div><figcaption class="text-right text-xs text-zinc-500 mt-2">画像引用元: <a href="${escapeHtmlAttr(topImage.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline px-2">${escapeHtmlText(topImage.sourceName)}</a></figcaption></figure>\n`;
            }

            finalContent += contentWithImages;

            // Steam ID縺悟ｭ伜惠縺吶ｌ縺ｰ譛ｫ蟆ｾ縺ｫ蝓九ａ霎ｼ縺ｿ
            if (steamId) {
                finalContent += `\n<div class="mt-8"><iframe src="https://store.steampowered.com/widget/${steamId}/" frameborder="0" width="100%" height="190"></iframe></div>`;
            }

            // 蜿り・た繝ｼ繧ｹ繧呈忰蟆ｾ縺ｫ霑ｽ蜉
            if (parsed.references && Array.isArray(parsed.references) && parsed.references.length > 0) {
                finalContent += `\n<div class="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">`;
                finalContent += `<h3 class=\"text-lg font-bold mb-4\">References</h3>`;
                finalContent += `<ul class="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">`;
                for (const ref of parsed.references) {
                    if (ref.title && ref.url) {
                        finalContent += `<li>- <a href=\"${ref.url}\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"hover:text-amber-500 hover:underline transition-colors\">${ref.title}</a></li>`;
                    }
                }
                finalContent += `</ul></div>`;
            }

            return {
                title: parsed.title,
                excerpt: parsed.excerpt,
                content: finalContent,
                tags: parsed.tags || [],
                slug: slugify(parsed.title) || `news-${Date.now()}`,
                mainImageUrl: mainImageUrl
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`  [retry ${attempt}/${retries}] ${msg.substring(0, 100)}`);
            if (attempt < retries) {
                const waitTime = attempt * 15000; // 15s, 30s
                console.log(`  waiting ${waitTime / 1000}s before retry...`);
                await sleep(waitTime);
            }
        }
    }

    console.error('  AI article generation failed after retries.');
    return null;
}

// ---- Save to DB ----
async function saveArticle(
    article: { title: string; excerpt: string; content: string; tags: string[]; slug: string; mainImageUrl: string },
    source: NewsItem
): Promise<boolean> {
    const { error } = await supabase.from('articles').insert({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        author: 'AI Editor',
        image_url: article.mainImageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/1200/630`,
        source_url: source.link,
        source_name: source.sourceName,
        tags: article.tags,
        views: 0,
        status: 'draft',
    });

    if (error) {
        console.error(`  [error] DB insert failed: ${error.message}`);
        console.error(`          code=${error.code}, details=${error.details}`);
        return false;
    }
    return true;
}

// ---- Main ----
async function main() {
    writeProgress(0, 'Initializing...');
    console.log('[start] article generation started\n');

    // 繧ｳ繝槭Φ繝峨Λ繧､繝ｳ蠑墓焚縺ｨ螻樊ｧ繧貞叙蠕・
    const args = process.argv.slice(2);
    let keyword = '';
    let attribute = 'game_news';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--attribute') {
            attribute = args[i + 1] || 'game_news';
            i++;
        } else if (!args[i].startsWith('--')) {
            keyword = args[i];
        }
    }

    // DB謗･邯壹ユ繧ｹ繝・
    console.log('[check] testing Supabase connection...');
    const { error: testError } = await supabase.from('articles').select('id').limit(1);
    if (testError) {
        writeProgress(0, `Supabase connection failed: ${testError.message}`, 'error');
        console.error(`[error] Supabase connection failed: ${testError.message}`);
        console.error('   Please verify DB schema/setup SQL.');
        process.exit(1);
    }
    console.log('[ok] Supabase connected\n');
    writeProgress(5, 'Collecting news sources...');

    let news: NewsItem[] = [];

    if (keyword) {
        console.log(`[mode] keyword mode: searching for "${keyword}"\n`);
        news = [{
            title: keyword,
            link: '', // 迚ｹ螳壹・URL縺後↑縺・◆繧∫ｩｺ
            sourceName: 'AI Web Research',
            summary: 'Use web search to gather official and up-to-date information.',
        }];
    } else {
        news = await fetchNews();
        console.log(`\n[info] collected news items: ${news.length}\n`);
    }

    let generated = 0;
    const maxArticles = 1;

    for (let i = 0; i < news.length; i++) {
        if (generated >= maxArticles) break;

        const item = news[i];

        // 繧ｭ繝ｼ繝ｯ繝ｼ繝画欠螳壹Δ繝ｼ繝峨・蝣ｴ蜷医・驥崎､・メ繧ｧ繝・け繧偵せ繧ｭ繝・・縺吶ｋ縺九ゞRL縺後↑縺・・縺ｧ蛻･縺ｮ譁ｹ豕輔〒蛻､螳・
        if (!keyword && await isDuplicate(item.link)) {
            console.log(`[skip] duplicate article: ${item.title.substring(0, 50)}...`);
            continue;
        }

        console.log(`\n[generate] ${item.title.substring(0, 50)}...`);
        const baseProgress = 10 + (generated / maxArticles) * 80;
        writeProgress(Math.floor(baseProgress), `Generating article with AI... ${generated + 1}/${maxArticles}`);

        const article = await generateArticle(item, attribute, (msg, offset) => {
            writeProgress(Math.floor(baseProgress + offset), `${generated + 1}/${maxArticles}: ${msg}`);
        });
        if (!article) continue;

        writeProgress(Math.floor(baseProgress + 5), 'Saving to database...');
        const saved = await saveArticle(article, item);
        if (saved) {
            console.log(`[saved] ${article.title.substring(0, 50)}...`);
            generated++;
        }

        // Rate limit蟇ｾ遲・ 險倅ｺ矩俣縺ｧ5遘貞ｾ・ｩ・
        if (generated < maxArticles) {
            writeProgress(Math.floor(baseProgress + 8), 'Waiting before next article...');
            console.log('[wait] 5s...');
            await sleep(5000);
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('✅ Completed. Generated articles: ' + generated);
    writeProgress(100, 'Completed. Generated articles: ' + generated, 'completed');
    if (generated > 0) {
        console.log('Open /admin to review generated drafts.');
    }
}

main().catch((err) => {
    console.error(err);
    writeProgress(0, `An error occurred: ${err.message}`, 'error');
});







