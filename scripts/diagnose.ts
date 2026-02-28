import { config } from 'dotenv';
config({ path: '.env.local' });

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import RSSParser from 'rss-parser';
import { writeFileSync } from 'fs';

const log: string[] = [];
function print(msg: string) {
    console.log(msg);
    log.push(msg);
}

async function diagnose() {
    print('========================================');
    print('🔍 全体診断を開始');
    print('========================================\n');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    print('--- 1. 環境変数 ---');
    print(`SUPABASE_URL: ${url ? '✅ ' + url : '❌ 未設定'}`);
    print(`SUPABASE_KEY: ${key ? '✅ ' + key.substring(0, 20) + '...' : '❌ 未設定'}`);
    print(`GEMINI_KEY:   ${geminiKey ? '✅ ' + geminiKey.substring(0, 15) + '...' : '❌ 未設定'}`);
    print('');

    // 2. Supabase
    print('--- 2. Supabase ---');
    try {
        const supabase = createClient(url!, key!);
        const { data, error } = await supabase.from('articles').select('id, title, status').limit(5);
        if (error) {
            print(`❌ SELECT失敗: ${JSON.stringify(error)}`);
        } else {
            print(`✅ SELECT成功: ${data?.length ?? 0}件`);
        }

        // INSERT test
        const { data: ins, error: insErr } = await supabase
            .from('articles')
            .insert({ slug: 'test-' + Date.now(), title: 'テスト', excerpt: 'テスト', content: '<p>テスト</p>', author: 'テスト', image_url: 'https://example.com/test.jpg', tags: ['テスト'], views: 0, status: 'draft' })
            .select('id').single();
        if (insErr) {
            print(`❌ INSERT失敗: ${JSON.stringify(insErr)}`);
        } else {
            print(`✅ INSERT成功: ${ins?.id}`);
            if (ins?.id) await supabase.from('articles').delete().eq('id', ins.id);
            print('✅ DELETE成功（テスト行削除）');
        }
    } catch (err) { print(`❌ Supabase例外: ${err}`); }
    print('');

    // 3. RSS
    print('--- 3. RSS ---');
    const parser = new RSSParser();
    const feeds = [
        { name: '4Gamer', url: 'https://www.4gamer.net/rss/index.xml' },
        { name: 'AUTOMATON', url: 'https://automaton-media.com/feed/' },
        { name: 'GameSpark', url: 'https://www.gamespark.jp/feed/index.xml' },
    ];
    for (const f of feeds) {
        try {
            const r = await parser.parseURL(f.url);
            print(`✅ ${f.name}: ${r.items?.length ?? 0}件`);
        } catch (err) { print(`❌ ${f.name}: ${err instanceof Error ? err.message : err}`); }
    }
    print('');

    // 4. Gemini
    print('--- 4. Gemini API ---');
    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey! });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'テストです。OKとだけ返して。',
        });
        print(`✅ Gemini応答: "${response.text?.trim()}"`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        print(`❌ Gemini失敗: ${msg.substring(0, 300)}`);
    }
    print('');

    print('========================================');
    print('🔍 診断完了');
    print('========================================');

    writeFileSync('diagnosis-result.txt', log.join('\n'), 'utf-8');
    print('\n結果を diagnosis-result.txt に保存しました');
}

diagnose().catch(console.error);
