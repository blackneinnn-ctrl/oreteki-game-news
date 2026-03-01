import { config } from 'dotenv';
config({ path: '.env.local' });

import RSSParser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import ytSearch from 'yt-search';

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

// ---- Media Fetching Helpers ----

async function searchYouTubeAPI(query: string): Promise<string | null> {
    try {
        console.log(`  🔍 YouTubeを検索中: ${query}`);
        const r = await ytSearch(query);
        const videos = r.videos.slice(0, 3);
        if (videos.length > 0) {
            // トレイラーや公式っぽいものを優先したいが、ここでは一番上を採用
            return videos[0].videoId;
        }
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
            model: 'gemini-2.5-flash',
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
                model: 'gemini-2.5-flash',
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
async function generateArticle(news: NewsItem, attribute: string = 'game_news', retries = 3): Promise<{
    title: string;
    excerpt: string;
    content: string;
    tags: string[];
    slug: string;
    mainImageUrl: string;
} | null> {
    const commonRules = `
## リッチメディア（画像・動画）の抽出と厳守ルール
- **画像と動画タグのご法度:** システム側で自動的に画像・動画を差し込むため、本文HTML (\`content\`) の中には「**絶対に \`<img>\` \`<iframe>\` タグを含めない**」でください。

## 参照ソース（references）と画像の公式性・取得ルール
システムはあなたが \`references\` に含めたURLから、自動的に画像をスクレイピングして記事内に挿入します。
そのため、**2次利用画像（他者のブログ、まとめサイト、一般のニュースサイトの切り抜き画像など）が記事に挿入されることを防ぐため、以下のルールを厳守してください。**

1. \`references\` の配列の**一番最初（先頭）**には、必ず「高品質な公式画像が設定されている」と考えられる**公式HPの該当ニュースページ、公式プレスリリース（PR TIMES等）、または公式X（Twitter）の該当ポストのURL**を配置してください。
2. これらがどうしても見つからない場合に限り、ファミ通など信頼できる大手ゲームメディアのURLを配置してください。
3. いかなる場合でも、まとめサイト、個人ブログ、WikipediaなどのURLは \`references\` に含めないでください。
4. \`references\` 配列には、最終的に記事の執筆に参考にした全てのURL（上記ルールを満たすもの）を含めてください。

## 【最重要】Google検索ツールを用いた徹底的なリサーチ
あなたは強力なGoogle検索ツール（googleSearch）を使用できます。
「情報がない」「不明である」と回答する前に、**必ず検索ツールを複数回活用して**最新の事実（発売日、対応機種、最新アップデート内容、プレイヤーの評価など）を徹底的にリサーチしてください。
特に、既に発売・リリースされているゲームに関して「現時点では詳細は不明です」と記載することは**重大な執筆エラー**とみなされます。リリース済みのタイトルや発表済みの情報については、必ず検索して正確な情報を記載してください。

## ニュース情報
タイトル: ${news.title}
ソース: ${news.sourceName}
URL: ${news.link || 'なし (キーワード指定)'}
概要: ${news.summary.substring(0, 500)}

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
* **画像と動画タグのご法度:** システム側で \`<img>\` \`<iframe>\` タグを差し込むため、本文となるHTML文字列の中には絶対にメディアタグを出力しないこと。

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
* **画像と動画タグのご法度:** システム側で \`<img>\` \`<iframe>\` タグを差し込むため、本文となるHTML文字列の中には絶対にメディアタグを出力しないこと。

${commonRules}`;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            // Record usage in Supabase
            const usage = response.usageMetadata;
            if (usage) {
                await supabase.from('api_usage').insert({
                    model: 'gemini-2.5-flash',
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
            const validImageUrls: string[] = [];
            if (parsed.references && Array.isArray(parsed.references)) {
                for (const ref of parsed.references) {
                    if (!ref.url) continue;
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        const res = await fetch(ref.url, { headers: FETCH_HEADERS, signal: controller.signal });
                        clearTimeout(timeoutId);
                        if (!res.ok) continue;

                        const html = await res.text();
                        const $ = cheerio.load(html);
                        let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');

                        if (ogImage && !validImageUrls.includes(ogImage)) {
                            // 相対パスの場合は絶対パスに変換
                            if (ogImage.startsWith('/')) {
                                const urlObj = new URL(ref.url);
                                ogImage = urlObj.origin + ogImage;
                            }
                            const isValidLink = await isUrlValid(ogImage, true);
                            if (isValidLink) {
                                const isRelevant = await validateImageWithAI(ogImage, parsed.title, parsed.excerpt);
                                if (isRelevant) {
                                    validImageUrls.push(ogImage);
                                    if (validImageUrls.length >= 3) break; // 最大3枚まで
                                }
                            }
                        }
                    } catch (e) {
                        // エラーは無視して次のURLへ
                    }
                }
            }

            let finalContent = '';
            let mainImageUrl = '';

            if (validImageUrls.length > 0) {
                mainImageUrl = validImageUrls.shift()!;
                console.log(`  📸 メイン画像を取得しました: ${mainImageUrl}`);
            }

            // Node側でYouTubeとSteamのIDを確実に検索
            const searchQuery = `${parsed.title} 公式 トレイラー`;
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
            } else if (mainImageUrl) {
                finalContent += `<div class="mb-8 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"><img src="${mainImageUrl}" alt="Main Image" class="w-full h-auto object-cover max-h-[60vh]"></div>\n`;
            }

            // 記事本文の <h2> の直前に残りの画像を順番に挿入
            let contentWithImages = parsed.content;
            if (validImageUrls.length > 0) {
                console.log(`  🖼️ 記事内に ${validImageUrls.length} 枚の画像を挿入します`);
                let imgIndex = 0;
                contentWithImages = contentWithImages.replace(/<h2>/g, (match: string) => {
                    if (validImageUrls[imgIndex]) {
                        const imgTag = `<img src="${validImageUrls[imgIndex]}" alt="Article Image" class="w-full rounded-xl my-6">\n`;
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
        writeProgress(Math.floor(baseProgress), `AI記事生成中... ${generated + 1}/${maxArticles}件目`);

        const article = await generateArticle(item, attribute);
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
