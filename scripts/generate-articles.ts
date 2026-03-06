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
const ALLOW_IMAGE_DOMAINS = [
    'playstation.com', 'nintendo.co.jp', 'nintendo.com', 'xbox.com',
    'steampowered.com', 'steamstatic.com', 'epicgames.com',
    'prtimes.jp', 'famitsu.com', '4gamer.net', 'automaton-media.com', 'gamespark.jp',
    'capcom.co.jp', 'capcom-games.com', 'square-enix.com', 'bandainamcoent.co.jp', 'sega.jp', 'konami.com'
];

const OFFICIAL_YOUTUBE_CHANNELS = [
    'nintendo', 'playstation', 'xbox', 'capcom', 'square enix', 'bandai namco',
    'sega', 'konami', 'koei tecmo', 'ubisoft', 'ea', 'electronic arts',
    'bethesda', '2k', 'rockstar games', 'cd projekt red', 'mihoyo', 'hoyoverse',
    'level5', 'level-5', 'cygames', 'gemdrops', 'pokemon', 'ポケモン', 'smash bros',
    'ファミ通', '4gamer', 'ign', 'gamespot', 'automaton'
];

const DENY_IMAGE_DOMAINS = [
    'jin115.com', 'mutyun.com', 'esuteru.com', 'blog.esuteru.com',
    'geha', 'matome', 'wikipedia.org', 'fandom.com', 'wiki', 'blog', 'note.com', 'hatenablog.com'
];

function isOfficialOrAllowedSource(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        const hostname = url.hostname.toLowerCase();

        // 1. ブラックリストチェック（含む場合は即NG）
        for (const deny of DENY_IMAGE_DOMAINS) {
            if (hostname.includes(deny)) return false;
        }

        // 2. ホワイトリストチェック（完全一致またはサブドメイン）
        for (const allow of ALLOW_IMAGE_DOMAINS) {
            if (hostname === allow || hostname.endsWith(`.${allow}`)) return true;
        }

        // 3. ゲーム会社の公式ドメインっぽさを判定（簡易的）
        if (hostname.includes('official') || hostname.includes('games') || hostname.includes('studios')) {
            return true;
        }

        return false; // ホワイトリストにない一般サイトは孫引き防止のためNG
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
    fullContent?: string;  // スクレイピングした元記事本文
    pubDate?: Date;        // 記事の公開日時
}

// ---- 元記事本文スクレイピング ----
async function scrapeArticleContent(url: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return '';

        const html = await res.text();
        const $ = cheerio.load(html);

        // 不要な要素を事前に除去
        $('script, style, nav, footer, header, aside, .ad, .advertisement, noscript').remove();

        // 本文候補要素を優先順に試みる
        let text = '';
        const selectors = ['article', 'main', '.article-body', '.entry-content', '.post-content', '#content', '.content'];
        for (const sel of selectors) {
            const el = $(sel);
            if (el.length > 0) {
                text = el.text().replace(/\s+/g, ' ').trim();
                if (text.length > 200) break;
            }
        }

        // どれもヒットしなかった場合は body 全体から取得
        if (text.length < 200) {
            text = $('body').text().replace(/\s+/g, ' ').trim();
        }

        // 8000文字を上限にカット（トークン節約）
        return text.substring(0, 8000);
    } catch {
        return '';
    }
}

async function fetchNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const now = new Date();
    // 48時間以内の記事のみ対象
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`📡 Fetching RSS: ${feed.name}...`);
            const result = await parser.parseURL(feed.url);
            const items = (result.items || []).slice(0, 10); // 多めに取得してフィルター後に絞る

            let fetchedCount = 0;
            for (const item of items) {
                if (!item.title || !item.link) continue;

                // 日付フィルタリング
                const pubDate = item.pubDate ? new Date(item.pubDate) : null;
                if (pubDate && pubDate < cutoff) {
                    console.log(`  ⏭️  スキップ（古い記事 ${pubDate.toLocaleDateString('ja-JP')}）: ${item.title.substring(0, 40)}...`);
                    continue;
                }

                // 元記事本文をスクレイピング
                console.log(`  📄 元記事本文を取得中: ${item.link}`);
                const fullContent = await scrapeArticleContent(item.link);
                if (fullContent) {
                    console.log(`  ✅ 本文取得成功: ${fullContent.length}文字`);
                } else {
                    console.log(`  ⚠️  本文取得失敗。スニペットのみで生成します。`);
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
                if (fetchedCount >= 5) break; // フィードあたり最大5件
            }
            console.log(`  ✅ ${fetchedCount}件取得（48時間以内）`);
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

// ---- Media Fetching Helpers ----

async function searchYouTubeAPI(query: string): Promise<string | null> {
    try {
        console.log(`  🔍 YouTubeを検索中: ${query}`);
        const r = await ytSearch(query);
        // 上位10件から公式チャンネルに近いものを探す
        const videos = r.videos.slice(0, 10);

        for (const video of videos) {
            const authorName = (video.author?.name || '').toLowerCase();

            // 公式チャンネルのリストと部分一致するかチェック
            const isOfficial = OFFICIAL_YOUTUBE_CHANNELS.some(official => authorName.includes(official));

            // Channel名にofficialや公式が含まれているかもチェック
            if (isOfficial || authorName.includes('official') || authorName.includes('公式')) {
                console.log(`  ✅ 公式YouTube動画を採用: ${video.title} (チャンネル: ${video.author.name})`);
                return video.videoId;
            }
        }

        console.log(`  ⚠️ 公式らしいYouTube動画が見つかりませんでした。`);
        return null;
    } catch (e) {
        console.error('  ⚠️ YouTube検索エラー:', e);
        return null;
    }
}

async function searchSteamAppID(query: string): Promise<string | null> {
    try {
        console.log(`  🔍 Steamを検索中: ${query}`);
        const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=japanese&cc=jp`);
        if (!res.ok) return null;

        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
            // 一番関連性の高いものを採用
            // (注意: 日本語名と英語名の揺れ等もあるため、タイトルの文字列が完全に含まれるか等の厳格なチェックを追加することも可能ですが、
            // 公式APIの最初の結果は概ね正確であるためそのまま採用します。)
            return data.items[0].id.toString();
        }
        return null; // 見つからない（未発売など）
    } catch (e) {
        console.error('  ⚠️ Steam検索エラー:', e);
        return null;
    }
}

// ---- AI Image Validation ----
async function validateImageWithAI(imageUrl: string, articleTitle: string, articleExcerpt: string): Promise<boolean> {
    try {
        console.log(`  🔍 画像をAIで視覚判定中...: ${imageUrl}`);
        // 1. 画像の取得とBase64エンコード
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 画像取得は少し長めに待つ
        const res = await fetch(imageUrl, { headers: FETCH_HEADERS, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) return false;

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const mimeType = res.headers.get('content-type') || 'image/jpeg';

        // 有効な画像MIMEタイプか簡易チェック
        if (!mimeType.startsWith('image/')) return false;

        // 2. Gemini Vision APIに判定を依頼
        const prompt = `あなたはゲームメディアの厳格な画像選定エディターです。
以下の記事タイトルと概要に対して、提供された画像が「記事の本文や見出しに挿入されるのにふさわしい、内容に直接関連する画像」かどうかを視覚的に判定してください。

【対象記事】
タイトル: ${articleTitle}
概要: ${articleExcerpt}

【判定基準】
以下の条件のいずれかに当てはまる場合は、**関連性が低い**として「false」を出力してください。
* サイトの単なるロゴマーク（企業ロゴ、メディア名ロゴ）
* 一般的なサイトの部品（アイコン、ナビゲーション用の画像、無関係なバナー広告）
* 記事で扱っているゲーム（またはキャラクター等）とは明らかに無関係なイラストや写真
* 一般的なアバター画像や「No Image」画像

上記に該当せず、ゲームのスクリーンショット、キャラクターイラスト、キービジュアル、パッケージ画像など、記事の内容に関連すると考えられる場合は「true」を出力してください。

【出力要件】
判定結果（true または false）のみを小文字のテキストで出力してください。それ以外の文字（理由の解説など）は一切含めないでください。`;

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

        console.log(`  結果: ${isValid ? '🟢 採用' : '🔴 破棄 (無関係な画像)'} (出力: ${textOutput})`);
        return isValid;

    } catch (e: any) {
        console.error(`  ⚠️ 画像のAI判定中にエラーが発生しました（デフォルトで採用とします）: ${e.message}`);
        // エラーで記事生成が止まるのを防ぐため、最低限のフォールバックとしてtrueを返す
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
    const commonRules = `
## リッチメディア（画像・動画）の抽出とコンプライアンス厳守ルール
- **【コンプライアンス厳守】動画の紹介:** 他者の動画（YouTubeなど）を紹介する構成にする場合は、絶対に直接の動画ファイルへのリンクなどを含めず、必ず各プラットフォーム公式の「埋め込み機能（\`iframe\`等）」を利用する前提のHTMLを生成してください。
- **【コンプライアンス厳守】画像の「引用」ルール（著作権法第32条準拠）:** 他サイトからの画像を記事内に引用引用として挿入する構成にする場合は、以下の条件を**すべて**満たすようにテキストとプレースホルダー（挿入位置の指示）を作成してください。
  1. **主従関係の厳守:** 記事のメインはあくまで「文章（主）」であり、画像は「文章を補足する要素（従）」となるよう、十分なテキスト量と論理的な解説を記述してください。画像がメインとなる構成は不可とします。
  2. **明瞭区別性:** 引用する画像が入る場所には、そこが引用であることを示すタグやカギカッコ（例：\`<blockquote>\`タグなど）を使用する指示を明記してください。
  3. **引用の必然性:** 「ただ見栄えを良くするため」「アイキャッチとして」の画像挿入は避け、その画像がないと文章の説明が成り立たない箇所にのみ引用を指示してください。
  4. **出所の明示:** 画像を引用する箇所のすぐ下に、必ず「出所（サイト名、URL、著作者名など）」を記載するためのプレースホルダー（例：\`出典：<a href="URL">サイト名</a>\`）を設けてください。
  5. **改変禁止の明記:** 引用画像はトリミングや文字入れ、色調補正などの加工を一切行わず、そのまま使用するようシステムに伝える注記（コメントアウト等）を入れてください。
- **通常の画像自動挿入について:** 上記の「引用」とは別に、システム側で自動的にニュースに関連するアイキャッチ画像などを差し込むため、本文HTML (\`content\`) の中には、あなた自身で勝手に \`<img>\` タグを含めないでください（明確な引用プレースホルダーを除く）。

## 参照ソース（references）と画像の公式性・取得ルール
システムはあなたが \`references\` に含めたURLから、自動的に画像をスクレイピングして記事内に挿入します。
そのため、**2次利用画像（他者のブログ、まとめサイト、一般のニュースサイトの切り抜き画像など、「孫引き」となる画像）が記事に挿入されることを防ぐため、以下のルールを絶対に厳守してください。**

1. **【絶対厳守】** \`references\` の配列の**一番最初（先頭のインデックス0）**には、必ず「高品質な公式画像が設定されている」と考えられる**公式HPの該当ニュースページ、公式プレスリリース（PR TIMES等）、ゲームプラットフォームの公式ストア（Steam/PS Store/My Nintendo Store等）、または公式X（Twitter）の該当ポストのURL**を配置してください。この指示は最優先されなければいけません。
2. これらがどうしても見つからない場合（インディーズゲーム等）に限り、ファミ通など信頼できる大手ゲームメディアのURLを配置してください。
3. **いかなる場合でも、まとめサイト、個人ブログ、Wikipedia、非公式WikiなどのURLは \`references\` に絶対含めないでください。これらは「孫引き」の原因となります。**
4. \`references\` 配列には、最終的に記事の執筆に参考にした全てのURL（上記ルールを満たすもの）を含めてください。

## 【最重要】元記事の全文を最優先情報源として使用すること

以下の「元記事全文」セクションに、取材対象の記事の実テキストが含まれています。
**この情報が最も信頼性・鮮度の高い一次情報です。**

記事を書く際は必ずこの全文を参照し、発売日・価格・プラットフォーム・固有名詞・数値などは
**ここに書かれた内容を正確に使用してください。**
推測や記憶に頼って補完することは禁止です。

元記事全文を読んだ上で、Google検索ツール（googleSearch）を補足的に活用し、
最新の追加情報（発売後の評価、公式発表、Steamレビューなど）を加えてください。

## ニュース情報
タイトル: ${news.title}
ソース: ${news.sourceName}
URL: ${news.link || 'なし (キーワード指定)'}
概要: ${news.summary.substring(0, 500)}

## 元記事全文（最優先ソース）
${news.fullContent
            ? `以下が元記事の本文です。この内容を土台にして記事を生成してください。

---
${news.fullContent}
---`
            : `※元記事本文の取得に失敗しました。上記の概要とGoogle検索ツールを使って最新情報をリサーチし、記事を生成してください。情報が不確かな場合でも「不明です」と書かず、必ず検索で事実確認を行ってください。`
        }

## 出力形式（JSON）
{
  "title": "読者の興味を引くタイトル（煽りすぎず、キャッチーに）",
  "excerpt": "記事の要約（1-2文、100文字以内）",
  "content": "<p>導入文</p><h2>見出し</h2><p>本文</p>...",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "references": [
    { "title": "参考記事のタイトル", "url": "https://..." }
  ]
}

JSONのみを出力してください。マークダウンのコードブロックは不要です。`;

    let prompt = "";
    if (attribute === "game_intro") {
        prompt = `# 🎮 ゲーム紹介記事 執筆マニュアル（AI用プロンプト）

## 1. 記事の基本属性（トーン＆マナー）

* ** ターゲット読者:** 次に遊ぶゲームを探している人、そのタイトルの購入を迷っている人。
* ** 文体・トーン:** ひとりのゲームファンとしての「熱量」と、良い点・人を選ぶ点をフラットに伝える「客観性」を両立したプロライター視点。
* ** 目的:** 読者にゲームの核となる面白さを伝え、「自分に合っているか（買うべきか）」の判断材料を提供すること。
* ** 情報の取り扱い（厳守）:** 公式発表や明確なソースに基づく事実のみを記載すること。推測で回答したり、情報を補完してはならない。**ただし、必ずGoogle検索ツールを使用して最新情報を徹底的に調査すること。** 特に発売日や対応機種については、検索すれば分かるものを「不明です」とごまかさないこと。（どうしても未発表の場合のみ「現時点では不明です」と記載する）

## 2. 記事の基本構成（HTML構造）

    以下の順番とHTMLタグ構成で記事を作成すること。

    1. ** トップメディア:**
* 公式のPV動画（\`<iframe>\`）またはアイキャッチ画像（\`<img>\`）を配置。（※後述の通りシステムが自動挿入するため、本テキストへの出力は不要）

2. **導入（リード文）:**
* 読者の興味を惹くキャッチコピー。
* 「一言でいうと、どんな体験ができるゲームか」を端的に伝える。

3. **H2: 『ゲームタイトル』とは？（概要と世界観）**
* 物語のあらすじや、プレイヤーが何をするゲームなのかを簡潔に説明。
* 必要に応じて画像を挿入。（※システムが自動挿入するため出力不要）

4. **H2: 本作の魅力・注目ポイント（3要素）**
* H3（小見出し）を用いて、ゲームの最大のウリを3つピックアップして解説する。
* 例：「爽快感抜群のバトルシステム」「奥深いキャラクター育成」「広大なオープンワールド」など。
* 重要なキーワードや固有名詞は**太字（\`<strong>\`）**で強調する。

5. **H2: ぶっちゃけ、どんな人におすすめ？**
* 箇条書き（\`<ul><li>\`）を使用して、「おすすめできる人」と「好みが分かれそうな点」を明記し、読者のミスマッチを防ぐ。

6. **H2: 総評・まとめ**
* 記事全体の締めくくりと、プレイへの後押しとなる一言。

7. **H2: 製品情報（公式データ）**
* 箇条書き（\`<ul><li>\`）で以下のデータをまとめる。
* タイトル / ジャンル / 対応プラットフォーム / 発売日 / 価格 / 開発・販売元 / 公式サイトリンク

## 3. 執筆・マークアップの厳守ルール

* **装飾による視線誘導:** 画面が文字で埋め尽くされないよう、適度に段落を分け、重要な文言は太字（\`<strong>\`）にする。
* **リストの活用:** 特徴やおすすめのポイントを複数挙げる際は、必ずリストタグ（\`<ul><li>\`）を使用して視覚的に整理する。
* **徹底した最新情報の検索:** 必ずGoogle検索を用いて最新情報を取得し、スペックやシステムについて「不明」と安易に逃げないこと。
* **動画・画像のコンプライアンスルール遵守:** 動画を紹介する場合は必ず公式の\`iframe\`を使用し、画像を引用する場合は主従関係、明瞭区別性(\`<blockquote>\`等の活用)、出所の明示等を定義したコンプライアンスルールに必ず従ってください。それ以外の、システムが自動挿入する目的の不要な \`<img>\` タグは絶対に出力しないでください。

${commonRules}`;
    } else {
        prompt = `# 🎮 ゲーム系ニュース・アップデート記事 執筆マニュアル

## 1. 記事の基本属性（トーン＆マナー）

* **ターゲット読者:** そのゲームの現役プレイヤー、復帰勢、興味を持っている新規層。
* **文体・トーン:** プロのゲームライター視点。読者と同じ目線に立ち、アップデートの「熱量」や「ワクワク感」を共有する共感的なトーン（例：「お待たせしました！」「嬉しい悲鳴ですね」）。
* **目的:** 情報過多な大型アップデートの内容を整理し、「見やすく、最後まで飽きずに読ませる」こと。そして「ゲームをプレイしたい！」というモチベーションを高めること。
* **装飾の基本方針:** 文字の羅列（テキストウォール）を避け、適度な箇条書き、太字、引用符（ブロッククオート）を用いて視覚的なリズムを作る。

## 2. 記事の基本構成（HTML構造）

記事は以下の順番と要素で構成すること。

1. **トップメディア:** 記事の冒頭にYouTubeなどの動画（\`<iframe>\`）を配置。（※後述の通りシステムが自動挿入するため、本テキストへの出力は不要）
2. **導入（リード文）:**
* 読者への呼びかけ。
* 「いつ」「何が」起きたのか（周年記念や大型アプデの概要）を太字で強調。
* この記事を読むメリット（何が分かるのか）を提示。

3. **アイキャッチ画像1:** 最初の見出しの前に配置。（※システムが \`<h2>\` の前に自動挿入するため出力不要）
4. **H2: 全体概要と最大の目玉:**
* アップデートの全体像を簡潔に説明。
* H3（①、②…）を用いて、目玉となる要素（新キャラ、新シナリオなど）を3つ程度に分けて解説。

5. **アイキャッチ画像2:** 次の大きなテーマの前に配置。（※システムが自動挿入するため出力不要）
6. **H2: システム変更・詳細な注目ポイント:**
* 読者が最も知るべき「環境の変化」や「お得な情報」をまとめる。
* 小見出し（H3）と箇条書き（\`<ul><li>\`）を組み合わせ、要点を分かりやすく整理する。重要な数値や要素は**太字**にする。

7. **H2: ネットの反応・コミュニティの声:**
* SNS等でのリアルな反響をまとめる。
* 引用タグ（\`<blockquote>\`）を使用し、テーマごと（キャラについて、システムについて等）にユーザーの声を模擬的に配置して共感を生む。
* 例: \`<blockquote class="border-l-4 border-zinc-400 pl-4 my-4 italic text-zinc-700 dark:text-zinc-300">\` のようなクラスを使用。

8. **H2: 公式情報（データ）:**
* ゲームの基本スペック、公式サイトへのリンクなどをボックス要素（背景色付きの\`<div>\`など）で囲み、スッキリと見せる。
* 例: \`<div class="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl mb-8"><ul>...\` のようにスタイリング。

9. **参考元:**
* 記事の作成にあたって参考にしたソースのリンク集を最後にまとめる。（※これもシステムが自動生成するため出力不要）

## 3. 執筆・マークアップの厳守ルール

* **重要なキーワードの強調:** 日付、新キャラクター名、重要なステータス数値、無料ガチャの回数などは必ず太字（\`<strong>\`）にして視線を誘導する。
* **箇条書きの活用:** 3つ以上並ぶ要素や、特徴を列挙する場合は、必ずリスト（\`<ul><li>\`）を使用し、文章をスッキリさせる。
* **見出しの階層化:** \`<h2>\`（大見出し）と\`<h3>\`（小見出し）を正しく使い、情報の大小を明確にする。
* **動画・画像のコンプライアンスルール遵守:** 動画を紹介する場合は必ず公式の\`iframe\`を使用し、画像を引用する場合は主従関係、明瞭区別性(\`<blockquote>\`等の活用)、出所の明示等を定義したコンプライアンスルールに必ず従ってください。それ以外の、システムが自動挿入する目的の不要な \`<img>\` タグは絶対に出力しないでください。

${commonRules}`;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            onProgress?.('記事の本文をAIで生成中...', 1);
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json'
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

            // JSON内のエスケープされていない制御文字（改行、タブなど）をサニタイズ
            jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, "");

            const parsed = JSON.parse(jsonStr);
            // 画像URLのスクレイピング抽出 (OGP)
            onProgress?.('記事に関連する画像を収集中...', 2);
            const validImages: { url: string; sourceUrl: string; sourceName: string }[] = [];
            if (parsed.references && Array.isArray(parsed.references)) {
                for (const ref of parsed.references) {
                    if (!ref.url) continue;

                    // 孫引き防止: 公式・許可されたドメインのみスクレイピング対象とする
                    if (!isOfficialOrAllowedSource(ref.url)) {
                        console.log(`  🚫 孫引き防止スキップ: ${ref.url} (推測される非公式/一般ソース)`);
                        continue;
                    }

                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        const res = await fetch(ref.url, { headers: FETCH_HEADERS, signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!res.ok) continue;

                        const html = await res.text();
                        const $ = cheerio.load(html);
                        let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');

                        if (ogImage && !validImages.find(img => img.url === ogImage)) {
                            // 相対パスの場合は絶対パスに変換
                            if (ogImage.startsWith('/')) {
                                const urlObj = new URL(ref.url);
                                ogImage = urlObj.origin + ogImage;
                            }
                            const isValidLink = await isUrlValid(ogImage, true);
                            if (isValidLink) {
                                onProgress?.(`画像候補のAI視覚判定中 (${validImages.length + 1}/3)...`, 3);
                                const isRelevant = await validateImageWithAI(ogImage, parsed.title, parsed.excerpt);
                                if (isRelevant) {
                                    validImages.push({
                                        url: ogImage,
                                        sourceUrl: ref.url,
                                        sourceName: ref.title || new URL(ref.url).hostname
                                    });
                                    if (validImages.length >= 3) break; // 最大3枚まで
                                }
                            }
                        }
                    } catch (e) {
                        // エラーは無視して次のURLへ
                    }
                }
            }

            let finalContent = '';
            let mainImage: { url: string; sourceUrl: string; sourceName: string } | null = null;
            let mainImageUrl = '';

            if (validImages.length > 0) {
                mainImage = validImages.shift()!;
                mainImageUrl = mainImage.url;
                console.log(`  📸 メイン画像を取得しました: ${mainImageUrl}`);
            }

            // Node側でYouTubeとSteamのIDを確実に検索
            onProgress?.('関連動画とストア情報を検索中...', 4);
            // 検索精度を上げるため、AIが付けた長いタイトルではなくシンプルなキーワードを抽出する
            const simpleGameTitle = parsed.title.split('：')[0].split(' - ')[0].replace(/【.*?】/g, '').trim();
            const searchQuery = `${simpleGameTitle} 公式 トレイラー`;
            const videoId = await searchYouTubeAPI(searchQuery);
            const steamId = await searchSteamAppID(parsed.title);

            // YouTubeが検索できれば冒頭に埋め込み、なければメイン画像を挿入
            if (videoId) {
                finalContent += `<div class="aspect-video mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>\n`;

                // YouTubeサムネイルをフォールバックに設定
                if (!mainImageUrl) {
                    mainImageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                    console.log(`  📸 YouTubeサムネイルをメイン画像に代用します: ${mainImageUrl}`);
                }
            } else if (mainImage) {
                finalContent += `<figure class="mb-8 w-full"><div class="overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><img src="${mainImage.url}" alt="Main Image" class="w-full h-auto object-cover max-h-[60vh]"></div><figcaption class="text-right text-xs text-zinc-500 mt-2">画像引用元: <a href="${mainImage.sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline px-2">${mainImage.sourceName}</a></figcaption></figure>\n`;
            } else if (mainImageUrl) {
                finalContent += `<div class="mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><img src="${mainImageUrl}" alt="Main Image" class="w-full h-auto object-cover max-h-[60vh]"></div>\n`;
            }

            // 記事本文の <h2> の直前に残りの画像を順番に挿入
            let contentWithImages = parsed.content;
            if (validImages.length > 0) {
                console.log(`  🖼️ 記事内に ${validImages.length} 枚の画像を挿入します`);
                let imgIndex = 0;
                contentWithImages = contentWithImages.replace(/<h2>/g, (match: string) => {
                    if (validImages[imgIndex]) {
                        const img = validImages[imgIndex];
                        const imgTag = `<figure class="my-8"><img src="${img.url}" alt="Article Image" class="w-full rounded-xl"><figcaption class="text-right text-xs text-zinc-500 mt-2">画像引用元: <a href="${img.sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline px-2">${img.sourceName}</a></figcaption></figure>\n`;
                        imgIndex++;
                        return imgTag + match;
                    }
                    return match;
                });
            } else {
                console.log(`  ⚠️ 挿入できる追加の画像が見つかりませんでした。`);
            }

            finalContent += contentWithImages;

            // Steam IDが存在すれば末尾に埋め込み
            if (steamId) {
                finalContent += `\n<div class="mt-8"><iframe src="https://store.steampowered.com/widget/${steamId}/" frameborder="0" width="100%" height="190"></iframe></div>`;
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
                mainImageUrl: mainImageUrl
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
    writeProgress(0, '初期化中...');
    console.log('🚀 記事生成を開始...\n');

    // コマンドライン引数と属性を取得
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

    // DB接続テスト
    console.log('🔌 Supabase接続テスト...');
    const { error: testError } = await supabase.from('articles').select('id').limit(1);
    if (testError) {
        writeProgress(0, `Supabase接続失敗: ${testError.message}`, 'error');
        console.error(`❌ Supabase接続失敗: ${testError.message}`);
        console.error('   SQLが実行済みか確認してください。');
        process.exit(1);
    }
    console.log('✅ Supabase接続OK\n');
    writeProgress(5, 'ニュースソースを取得中...');

    let news: NewsItem[] = [];

    if (keyword) {
        console.log(`🎯 キーワード指定モード: 「${keyword}」についてリサーチします\n`);
        news = [{
            title: keyword,
            link: '', // 特定のURLがないため空
            sourceName: 'AI Web Research',
            summary: `必ずGoogle検索ツールを使用して最新情報をリサーチし、「${keyword}」に関する解説記事、最新ニュース、またはアップデート情報を執筆してください。絶対に自分の内部知識だけで書かず、検索で事実確認を行ってください。`,
        }];
    } else {
        news = await fetchNews();
        console.log(`\n📰 合計 ${news.length}件のニュースを取得\n`);
    }

    let generated = 0;
    const maxArticles = 1;

    for (let i = 0; i < news.length; i++) {
        if (generated >= maxArticles) break;

        const item = news[i];

        // キーワード指定モードの場合は重複チェックをスキップするか、URLがないので別の方法で判定
        if (!keyword && await isDuplicate(item.link)) {
            console.log(`⏭️  スキップ（既存）: ${item.title.substring(0, 50)}...`);
            continue;
        }

        console.log(`\n✍️  生成中: ${item.title.substring(0, 50)}...`);
        const baseProgress = 10 + (generated / maxArticles) * 80;
        writeProgress(Math.floor(baseProgress), `AI記事生成を開始... ${generated + 1}/${maxArticles}件目`);

        const article = await generateArticle(item, attribute, (msg, offset) => {
            writeProgress(Math.floor(baseProgress + offset), `${generated + 1}/${maxArticles}件目: ${msg}`);
        });
        if (!article) continue;

        writeProgress(Math.floor(baseProgress + 5), `データベースに保存中...`);
        const saved = await saveArticle(article, item);
        if (saved) {
            console.log(`✅ 保存完了: ${article.title.substring(0, 50)}...`);
            generated++;
        }

        // Rate limit対策: 記事間で5秒待機
        if (generated < maxArticles) {
            writeProgress(Math.floor(baseProgress + 8), `次の記事のために待機中...`);
            console.log('⏳ 5秒待機...');
            await sleep(5000);
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 完了！ ${generated}件の下書き記事を生成しました。`);
    writeProgress(100, `完了しました。${generated}件の下書き記事を生成しました。`, 'completed');
    if (generated > 0) {
        console.log('📝 管理画面 (/admin) で記事を確認・公開してください。');
    }
}

main().catch((err) => {
    console.error(err);
    writeProgress(0, `エラーが発生しました: ${err.message}`, 'error');
});
