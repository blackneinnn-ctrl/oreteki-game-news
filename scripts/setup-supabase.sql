-- 俺的ゲームニュース: Supabase テーブル設定
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください

-- 記事テーブル
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '管理人',
  image_url TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_name TEXT,
  tags TEXT[] DEFAULT '{}',
  views INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_views ON articles(views DESC);
CREATE INDEX idx_articles_slug ON articles(slug);

-- 閲覧数インクリメント関数
CREATE OR REPLACE FUNCTION increment_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE articles SET views = views + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) ポリシー
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 公開記事は誰でも読める
CREATE POLICY "Public articles are readable by everyone"
  ON articles FOR SELECT
  USING (status = 'published');

-- anon keyで全操作可能（管理画面用 - 本番では認証強化推奨）
CREATE POLICY "Allow all operations with anon key"
  ON articles FOR ALL
  USING (true)
  WITH CHECK (true);
