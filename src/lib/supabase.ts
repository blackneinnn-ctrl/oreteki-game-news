import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Article {
    id: string;
    slug: string;
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
    created_at: string;
    published_at: string | null;
}
