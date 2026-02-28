import { config } from 'dotenv';
config({ path: '.env.local' });

import RSSParser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// ---- Config ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
    console.error('❌ 環境変数が設定されていません。.env.local を確認してください。');
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
    { name: '4Gamer.net', url: 'https://www.4gamer.net/rss/index.xml' },
    { name: 'AUTOMATON', url: 'https://automaton-media.com/feed/' },
    { name: 'Game*Spark', url: 'https://www.gamespark.jp/feed/index.xml' },
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
}

async function fetchNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`📡 Fetching RSS: ${feed.name}...`);
            const result = await parser.parseURL(feed.url);
            const items = (result.items || []).slice(0, 5);

            for (const item of items) {
                if (item.title && item.link) {
                    allItems.push({
                        title: item.title,
                        link: item.link,
                        sourceName: feed.name,
                        summary: item.contentSnippet || item.content || '',
                    });
                }
            }
            console.log(`  ✅ ${items.length}件取得`);
        } catch (err) {
            console.warn(`  ⚠️ 失敗: ${err instanceof Error ? err.message : err}`);
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

// ---- Generate article with AI (with retry) ----
async function generateArticle(news: NewsItem, retries = 3): Promise<{
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    slug: string;
} | null> {
    const prompt = `あなたはゲームニュースブログ「俺的ゲームニュース」の専属Webリサーチャー兼ライターです。
以下のニュース情報をもとに、事実に基づいた最新情報と独自の深掘りを含めたゲームブログ記事を作成してください。

## リサーチ指令
以下のソースを必ず参考に（グラウンディング・Web検索機能を用いて）リサーチを行い、記事に反映してください。
- 国内メディア: AUTOMATON、ファミ通.com、4Gamer.net
- 海外・コミュニティ: Reddit、X（旧Twitter）のゲーム会社公式アカウントやユーザーの反応
- 動画: YouTube公式トレーラーやプレイ動画

## 記事構成と要件
1. 冒頭の導入文 (<p>タグ) - ニュースの要点を紹介
2. <h2>〇〇とは？</h2> - ゲームやニュースの詳しい紹介
3. <h2>注目ポイント / 最新情報</h2> - リサーチによる最新情報や魅力を解説
4. <h2>民衆の意見・ネットの反応</h2> - XやRedditから拾った事実に基づく率直な意見・感想（推測ではなく実際の声の要約）
5. <h2>公式情報</h2> - スペックや発売日などを箇条書きで

## リッチメディアの抽出
- リサーチ中に発見した**YouTubeの公式動画URL**があれば \`youtubeUrl\` に含めてください（ない場合は空文字）。
- **SteamのストアページURL**があれば \`steamUrl\` に含めてください（ない場合は空文字）。

## ルール
- 本文はHTMLで書く（h2, p, a, ul, liタグを使用）
- 事実に基づいた精度の高い執筆を行うこと
- 決して「この記事はAIが生成しました」といった文言はいれないこと
- YouTubeやSteamの埋め込みタグはシステム側で行うため、本文HTML (\`content\`) の中にはiframeを書かないでください

## ニュース情報
タイトル: ${news.title}
ソース: ${news.sourceName}
概要: ${news.summary.substring(0, 500)}

## 出力形式（JSON）
{
  "title": "読者の興味を引くタイトル（煽りすぎず、キャッチーに）",
  "excerpt": "記事の要約（1-2文、100文字以内）",
  "content": "<p>導入文</p><h2>見出し</h2><p>本文</p>...",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "steamUrl": "https://store.steampowered.com/app/..."
}

JSONのみを出力してください。マークダウンのコードブロックは不要です。`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const text = response.text?.trim() || '';
            const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
            const parsed = JSON.parse(jsonStr);

            let finalContent = '';

            // YouTubeが抽出されていれば冒頭に埋め込み
            if (parsed.youtubeUrl) {
                const videoIdMatch = parsed.youtubeUrl.match(/(?:v=|youtu\.be\/)([^&]+)/);
                if (videoIdMatch && videoIdMatch[1]) {
                    finalContent += `<div class="aspect-video mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoIdMatch[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>\n`;
                }
            }

            finalContent += parsed.content;

            // Steamが抽出されていれば末尾に埋め込み
            if (parsed.steamUrl) {
                const appIdMatch = parsed.steamUrl.match(/\/app\/(\d+)/);
                if (appIdMatch && appIdMatch[1]) {
                    finalContent += `\n<div class="mt-8"><iframe src="https://store.steampowered.com/widget/${appIdMatch[1]}/" frameborder="0" width="100%" height="190"></iframe></div>`;
                }
            }

            return {
                title: parsed.title,
                excerpt: parsed.excerpt,
                content: finalContent,
                tags: parsed.tags || [],
                slug: slugify(parsed.title) || `news-${Date.now()}`,
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`  ⚠️ 試行 ${attempt}/${retries} 失敗: ${msg.substring(0, 100)}`);
            if (attempt < retries) {
                const waitTime = attempt * 15000; // 15s, 30s
                console.log(`  ⏳ ${waitTime / 1000}秒待機中...`);
                await sleep(waitTime);
            }
        }
    }

    console.error(`  ❌ AI生成に完全に失敗`);
    return null;
}

// ---- Save to DB ----
async function saveArticle(
    article: { title: string; excerpt: string; content: string; tags: string[]; slug: string },
    source: NewsItem
): Promise<boolean> {
    const { error } = await supabase.from('articles').insert({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        author: '管理人',
        image_url: `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/1200/630`,
        source_url: source.link,
        source_name: source.sourceName,
        tags: article.tags,
        views: 0,
        status: 'draft',
    });

    if (error) {
        console.error(`  ❌ DB保存失敗: ${error.message}`);
        console.error(`     コード: ${error.code}, 詳細: ${error.details}`);
        return false;
    }
    return true;
}

// ---- Main ----
async function main() {
    console.log('🚀 記事生成を開始...\n');

    // DB接続テスト
    console.log('🔌 Supabase接続テスト...');
    const { error: testError } = await supabase.from('articles').select('id').limit(1);
    if (testError) {
        console.error(`❌ Supabase接続失敗: ${testError.message}`);
        console.error('   SQLが実行済みか確認してください。');
        process.exit(1);
    }
    console.log('✅ Supabase接続OK\n');

    const news = await fetchNews();
    console.log(`\n📰 合計 ${news.length}件のニュースを取得\n`);

    let generated = 0;
    const maxArticles = 1;

    for (const item of news) {
        if (generated >= maxArticles) break;

        if (await isDuplicate(item.link)) {
            console.log(`⏭️  スキップ（既存）: ${item.title.substring(0, 50)}...`);
            continue;
        }

        console.log(`\n✍️  生成中: ${item.title.substring(0, 50)}...`);

        const article = await generateArticle(item);
        if (!article) continue;

        const saved = await saveArticle(article, item);
        if (saved) {
            console.log(`✅ 保存完了: ${article.title.substring(0, 50)}...`);
            generated++;
        }

        // Rate limit対策: 記事間で5秒待機
        if (generated < maxArticles) {
            console.log('⏳ 5秒待機...');
            await sleep(5000);
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 完了！ ${generated}件の下書き記事を生成しました。`);
    if (generated > 0) {
        console.log('📝 管理画面 (/admin) で記事を確認・公開してください。');
    }
}

main().catch(console.error);
