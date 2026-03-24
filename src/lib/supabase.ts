import { createClient } from '@supabase/supabase-js';
import type { ArticleCategory } from './article-taxonomy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Article {
    id: string;
    slug: string;
    category: ArticleCategory;
    title: string;
    excerpt: string;
    content: string;
    author: string;
    image_url: string;
    source_url: string | null;
    source_name: string | null;
    tags: string[];
    views: number;
    status: 'draft' | 'published';
    generation_cost_usd?: number | null;
    generation_cost_jpy?: number | null;
    generation_run_id?: string | null;
    generation_pipeline_version?: string | null;
    generation_model_summary?: string | null;
    created_at: string;
    published_at: string | null;
}
