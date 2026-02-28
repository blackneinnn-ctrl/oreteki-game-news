# 俺的ゲームニュース (News Blog)

Next.js (App Router) + Supabase + Gemini API を使用したゲームニュースブログシステムです。

## 🚀 記事の自動生成機能について

本プロジェクトには、AI（Gemini）を利用してゲームニュース記事を自動でリサーチ・生成するスクリプトが用意されています。

### 1. 通常モード（RSSからの取得）
登録されているゲームメディア（AUTOMATON、ファミ通.com、4Gamer.netなど）のRSSフィードから最新ニュースを取得し、それをもとに記事を1件自動作成します。
```bash
npm run generate
```

### 2. キーワード指定モード（手動リサーチ）
特定のゲームタイトルやニュースについてAIにゼロからリサーチさせて記事を作りたい場合は、コマンドの後ろにキーワードを指定します。

```bash
# スペースが含まれない単語の場合はそのまま指定可能
npm run generate モンハンワイルズ
npm run generate GTA6

# ⚠️ 注意: スペースが含まれる言葉は必ず "" (ダブルクォーテーション) で囲んでください
npm run generate "GTA6 最新リーク"
npm run generate "Switch 後継機"
```

※ もし `""` で囲わずに `npm run generate GTA6 最新リーク` と打った場合、コンピューターは最初の単語である「GTA6」だけをキーワードとして認識してしまいまうので注意してください。

## ⚙️ 環境構築手順

```bash
# 1. パッケージのインストール
npm install

# 2. 環境変数の設定
# .env.local ファイルを作成し、SupabaseとGeminiのキーを設定してください

# 3. 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスすると確認できます。
