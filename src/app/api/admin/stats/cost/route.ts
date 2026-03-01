import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 料金設定 (100万トークンあたりのドル単価)
const PRICING: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-3-pro-3.1': { input: 2.00, output: 12.00 },
    'gemini-1.5-flash': { input: 0.15, output: 0.60 }, // 念のためのフォールバック
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
};

export async function GET() {
    try {
        // 今月の開始日時を取得 (UTC)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 当月分の使用量データを取得
        const { data: usageLogs, error } = await supabase
            .from('api_usage')
            .select('*')
            .gte('created_at', startOfMonth);

        if (error) throw error;

        let totalUsd = 0;
        const modelBreakdown: Record<string, { input: number; output: number; cost: number }> = {};

        usageLogs?.forEach(log => {
            const pricing = PRICING[log.model] || PRICING['gemini-2.5-flash'];
            const inputCost = (log.input_tokens / 1_000_000) * pricing.input;
            const outputCost = (log.output_tokens / 1_000_000) * pricing.output;
            const cost = inputCost + outputCost;

            totalUsd += cost;

            if (!modelBreakdown[log.model]) {
                modelBreakdown[log.model] = { input: 0, output: 0, cost: 0 };
            }
            modelBreakdown[log.model].input += log.input_tokens;
            modelBreakdown[log.model].output += log.output_tokens;
            modelBreakdown[log.model].cost += cost;
        });

        // 簡易的な為替レート変換 (1ドル = 150円)
        const JPY_RATE = 150;
        const totalJpy = Math.round(totalUsd * JPY_RATE);

        return NextResponse.json({
            success: true,
            month: now.getMonth() + 1,
            totalUsd: parseFloat(totalUsd.toFixed(4)),
            totalJpy: totalJpy,
            breakdown: modelBreakdown
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ error: '統計データの取得に失敗しました' }, { status: 500 });
    }
}
