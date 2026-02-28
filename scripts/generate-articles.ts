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

async function isYouTubeValid(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res.ok;
    } catch {
        return false;
    }
}

// ---- Generate article with AI (with retry) ----
async function generateArticle(news: NewsItem, retries = 3): Promise<{
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    slug: string;
    mainImageUrl: string;
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
3. <h2>注目ポイント / 最新情報</h2> - **（重要）必ず直近1週間以内の最新の動向や発表内容**をGoogle検索でリサーチして解説してください。古い情報は除外してください。
4. <h2>民衆の意見・ネットの反応</h2> - XやRedditから拾った事実に基づく率直な意見・感想（推測ではなく実際の声の要約）
5. <h2>公式情報</h2> - スペックや発売日などを箇条書きで

## リッチメディアの抽出・フォールバック
- リサーチ中に発見した**YouTubeの公式動画URL**があれば \`youtubeUrl\` に含めてください。「確実に外部サイト（iframe）で埋め込み再生できる公式動画」のみ対象とします（年齢制限や限定公開のものは不可）。公式トレーラーがなければ、ティザー映像やPV（プロモーションビデオ）、実機プレイ映像など、公式が公開している何らかの関連動画を諦めずに探して設定してください。
- どうしても見つからない場合のみ \`youtubeUrl\` は空文字にし、代わりに公式の**メイン画像（キービジュアルや高画質なスクリーンショット）**のURLをリサーチして \`mainImageUrl\` に含めてください。
- **SteamのストアページURL**があれば \`steamUrl\` に含めてください。ただし、リサーチ元の情報内に「明確にそのゲーム本編のSteamストアへのリンク」が記載されている場合のみ抽出し、検索して適当なURLを推測することは**絶対にやめてください**（全く別のゲームのURLを出力する事故を防ぐため）。少しでも不確かな場合は必ず空文字にしてください。

## 参照ソースの抽出
- リサーチに利用した情報ソース（元のニュース記事やReddit、公式Xなど）をすべて \`references\` 配列に含めてください。

## ルール
- 本文はHTMLで書く（h2, p, a, ul, liタグを使用）
- 事実に基づいた精度の高い執筆を行うこと
- 決して「この記事はAIが生成しました」といった文言はいれないこと
- 文章ばかりにならないよう、話題ごとに内容に沿う**公式の画像（スクリーンショットなど）**のURLをリサーチし、本文HTML (\`content\`) の中で \`<img src="..." alt="..." class="w-full rounded-xl my-6">\` の形式で適宜追加してください。1つの情報元に画像がなくても諦めず、指定された全てのソース（国内外メディア、公式Xなど）を徹底的に辿って、必ず何らかの公式画像を見つけ出して挿入してください。
- （注意）YouTubeやSteamの埋め込みタグはシステム側で自動付与するため、本文HTML (\`content\`) の中には絶対に \`iframe\` を書かないでください。
- （超重要）指定する全ての画像URLおよび動画URLは、必ず「現在アクセス可能で実在する公式リンク」を記載してください。適当な外部サイトのURLや架空のURL（ハルシネーション）は絶対に使用しないでください。確証がない場合は空文字にしてください。

## ニュース情報
タイトル: ${news.title}
ソース: ${news.sourceName}
URL: ${news.link || 'なし (キーワード指定)'}
概要: ${news.summary.substring(0, 500)}

## 出力形式（JSON）
{
  "title": "読者の興味を引くタイトル（煽りすぎず、キャッチーに）",
  "excerpt": "記事の要約（1-2文、100文字以内）",
  "content": "<p>導入文</p><h2>見出し</h2><p>本文</p><img src='...'>...",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "mainImageUrl": "https://...",
  "steamUrl": "https://store.steampowered.com/app/...",
  "references": [
    { "title": "参考記事のタイトル", "url": "https://..." }
  ]
}

JSONのみを出力してください。マークダウンのコードブロックは不要です。`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            const text = response.text?.trim() || '';
            const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
            const parsed = JSON.parse(jsonStr);

            // リッチメディアのURL検証
            if (parsed.youtubeUrl) {
                const isValid = await isYouTubeValid(parsed.youtubeUrl);
                if (!isValid) {
                    console.log(`  ⚠️ YouTube動画が無効または非公開です: ${parsed.youtubeUrl}`);
                    parsed.youtubeUrl = '';
                }
            }
            if (parsed.mainImageUrl) {
                const isValid = await isUrlValid(parsed.mainImageUrl, true);
                if (!isValid) {
                    console.log(`  ⚠️ メイン画像URLが無効です: ${parsed.mainImageUrl}`);
                    parsed.mainImageUrl = '';
                }
            }

            // 記事内の画像URL検証
            if (parsed.content) {
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
                const invalidImgs: string[] = [];
                const imgMatches = [...parsed.content.matchAll(imgRegex)];
                for (const m of imgMatches) {
                    const src = m[1];
                    const isValid = await isUrlValid(src, true);
                    if (!isValid) {
                        console.log(`  ⚠️ 記事内画像URLが無効のため除外します: ${src}`);
                        invalidImgs.push(m[0]);
                    }
                }
                for (const invalidImg of invalidImgs) {
                    parsed.content = parsed.content.replace(invalidImg, '');
                }
            }

            let finalContent = '';

            // YouTubeが抽出されていれば冒頭に埋め込み、なければメイン画像を挿入
            if (parsed.youtubeUrl) {
                const videoIdMatch = parsed.youtubeUrl.match(/(?:v=|youtu\.be\/)([^&]+)/);
                if (videoIdMatch && videoIdMatch[1]) {
                    finalContent += `<div class="aspect-video mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoIdMatch[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>\n`;
                }
            } else if (parsed.mainImageUrl) {
                finalContent += `<div class="mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><img src="${parsed.mainImageUrl}" alt="Main Image" class="w-full h-auto object-cover max-h-[60vh]"></div>\n`;
            }

            finalContent += parsed.content;

            // Steamが抽出されていれば末尾に埋め込み
            if (parsed.steamUrl) {
                const appIdMatch = parsed.steamUrl.match(/\/app\/(\d+)/);
                if (appIdMatch && appIdMatch[1]) {
                    finalContent += `\n<div class="mt-8"><iframe src="https://store.steampowered.com/widget/${appIdMatch[1]}/" frameborder="0" width="100%" height="190"></iframe></div>`;
                }
            }

            // 参考ソースを末尾に追加
            if (parsed.references && Array.isArray(parsed.references) && parsed.references.length > 0) {
                finalContent += `\n<div class="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">`;
                finalContent += `<h3 class="text-lg font-bold mb-4">参考元</h3>`;
                finalContent += `<ul class="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">`;
                for (const ref of parsed.references) {
                    if (ref.title && ref.url) {
                        finalContent += `<li>・ <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="hover:text-amber-500 hover:underline transition-colors">${ref.title}</a></li>`;
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
                mainImageUrl: parsed.mainImageUrl || '',
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
    article: { title: string; excerpt: string; content: string; tags: string[]; slug: string; mainImageUrl: string },
    source: NewsItem
): Promise<boolean> {
    const { error } = await supabase.from('articles').insert({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        author: '管理人',
        image_url: article.mainImageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/1200/630`,
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

    // コマンドライン引数を取得（例: npm run generate "モンハンワイルズ"）
    const keyword = process.argv[2];

    // DB接続テスト
    console.log('🔌 Supabase接続テスト...');
    const { error: testError } = await supabase.from('articles').select('id').limit(1);
    if (testError) {
        console.error(`❌ Supabase接続失敗: ${testError.message}`);
        console.error('   SQLが実行済みか確認してください。');
        process.exit(1);
    }
    console.log('✅ Supabase接続OK\n');

    let news: NewsItem[] = [];

    if (keyword) {
        console.log(`🎯 キーワード指定モード: 「${keyword}」についてリサーチします\n`);
        news = [{
            title: keyword,
            link: '', // 特定のURLがないため空
            sourceName: 'AI Web Research',
            summary: `「${keyword}」に関する最新のゲームニュースや話題、アップデート情報などを幅広くリサーチして記事を作成してください。`,
        }];
    } else {
        news = await fetchNews();
        console.log(`\n📰 合計 ${news.length}件のニュースを取得\n`);
    }

    let generated = 0;
    const maxArticles = 1;

    for (const item of news) {
        if (generated >= maxArticles) break;

        // キーワード指定モードの場合は重複チェックをスキップするか、URLがないので別の方法で判定
        if (!keyword && await isDuplicate(item.link)) {
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
