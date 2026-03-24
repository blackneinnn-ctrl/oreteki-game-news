import { NextResponse } from 'next/server';
import {
    computeCostDistribution,
    CURRENT_GENERATION_PIPELINE_VERSION,
    normalizeGenerationPipelineVersion,
} from '@/lib/article-generation-pipeline';
import { calculateUsageCostUsd } from '@/lib/api-usage-cost';
import { supabase } from '@/lib/supabase';

type ArticleCostRow = {
    created_at: string;
    generation_cost_jpy: number | null;
    generation_cost_usd: number | null;
    generation_pipeline_version?: string | null;
};

function isMissingArticleGenerationColumnsError(
    error: { code?: string; details?: string | null; message?: string } | null,
) {
    if (!error) return false;
    return (
        error.code === '42703' ||
        /generation_(cost_(usd|jpy)|pipeline_version|run_id|model_summary)/i.test(
            `${error.message ?? ''} ${error.details ?? ''}`,
        )
    );
}

function isMissingApiUsageMetadataColumnsError(
    error: { code?: string; details?: string | null; message?: string } | null,
) {
    if (!error) return false;
    return (
        error.code === '42703' ||
        /generation_run_id|pipeline_version/i.test(`${error.message ?? ''} ${error.details ?? ''}`)
    );
}

function isMissingApiUsageTableError(error: { code?: string; message?: string } | null) {
    if (!error) return false;
    return error.code === 'PGRST205' || /public\.api_usage/i.test(error.message ?? '');
}

function sumCosts(rows: ArticleCostRow[]) {
    let totalUsd = 0;
    let totalJpy = 0;

    for (const row of rows) {
        const rowJpy = row.generation_cost_jpy ?? 0;
        const rowUsd = row.generation_cost_usd ?? rowJpy / 150;
        totalUsd += rowUsd;
        totalJpy += rowJpy;
    }

    return {
        totalUsd: Number(totalUsd.toFixed(4)),
        totalJpy,
    };
}

export async function GET() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const emptyDistribution = computeCostDistribution([]);

        const { data: articles, error: articleError } = await supabase
            .from('articles')
            .select(
                'created_at,generation_cost_jpy,generation_cost_usd,generation_pipeline_version',
            )
            .gte('created_at', startOfMonth)
            .not('generation_cost_jpy', 'is', null);

        const generationMetadataColumnsMissing = isMissingArticleGenerationColumnsError(articleError);
        if (articleError && !generationMetadataColumnsMissing) {
            throw articleError;
        }

        const normalizedArticles = ((articles ?? []) as ArticleCostRow[]).map((article) => ({
            ...article,
            generation_pipeline_version: normalizeGenerationPipelineVersion(
                article.generation_pipeline_version,
            ),
        }));

        const currentArticles = normalizedArticles.filter(
            (article) =>
                article.generation_pipeline_version === CURRENT_GENERATION_PIPELINE_VERSION,
        );
        const legacyArticles = normalizedArticles.filter(
            (article) =>
                article.generation_pipeline_version !== CURRENT_GENERATION_PIPELINE_VERSION,
        );

        let breakdown: Record<string, { input: number; output: number; cost: number }> = {};
        const usageSelect =
            'model,input_tokens,output_tokens' +
            (generationMetadataColumnsMissing ? '' : ',pipeline_version');
        const { data: usageLogs, error: usageError } = await supabase
            .from('api_usage')
            .select(usageSelect)
            .gte('created_at', startOfMonth);

        if (usageError && !isMissingApiUsageTableError(usageError) && !isMissingApiUsageMetadataColumnsError(usageError)) {
            throw usageError;
        }

        if (usageLogs && !isMissingApiUsageTableError(usageError)) {
            const normalizedUsageLogs = (usageLogs ?? []) as unknown as Array<{
                input_tokens: number;
                model: string;
                output_tokens: number;
                pipeline_version?: string | null;
            }>;

            for (const log of normalizedUsageLogs) {
                const pipelineVersion = normalizeGenerationPipelineVersion(log.pipeline_version);
                if (!generationMetadataColumnsMissing && pipelineVersion !== CURRENT_GENERATION_PIPELINE_VERSION) {
                    continue;
                }

                const cost = calculateUsageCostUsd(log.model, log.input_tokens, log.output_tokens);
                if (!breakdown[log.model]) {
                    breakdown[log.model] = { input: 0, output: 0, cost: 0 };
                }
                breakdown[log.model].input += log.input_tokens;
                breakdown[log.model].output += log.output_tokens;
                breakdown[log.model].cost += cost;
            }
        }

        const currentTotals = sumCosts(currentArticles);
        const legacyTotals = sumCosts(legacyArticles);

        return NextResponse.json({
            success: true,
            month: now.getMonth() + 1,
            totalUsd: currentTotals.totalUsd,
            totalJpy: currentTotals.totalJpy,
            legacyTotalUsd: legacyTotals.totalUsd,
            legacyTotalJpy: legacyTotals.totalJpy,
            breakdown,
            distribution: computeCostDistribution(
                currentArticles
                    .map((article) => article.generation_cost_jpy)
                    .filter((cost): cost is number => typeof cost === 'number'),
            ),
            legacyDistribution: computeCostDistribution(
                legacyArticles
                    .map((article) => article.generation_cost_jpy)
                    .filter((cost): cost is number => typeof cost === 'number'),
            ),
            schemaMissing: Boolean(
                generationMetadataColumnsMissing || isMissingApiUsageTableError(usageError),
            ),
            generationCostColumnsMissing: generationMetadataColumnsMissing,
            generationMetadataColumnsMissing,
            currentPipelineVersion: CURRENT_GENERATION_PIPELINE_VERSION,
            legacyPipelineVersion: 'legacy',
            emptyDistribution,
        });
    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ error: '統計データの取得に失敗しました' }, { status: 500 });
    }
}
