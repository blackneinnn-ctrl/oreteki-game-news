import assert from 'node:assert/strict';
import {
    canRepairArticleStructureLocally,
    determineArticleFormat,
    ensureMinimumArticleStructure,
    getAllowedSourceTypesForAttribute,
    isOverHardCostLimit,
    localValidateArticle,
    normalizeUrlForCompare,
    shouldRunOptionalAiStage,
    summarizeSourcePacketText,
    type GeneratedArticlePayload,
    type VerifiedOfficialSource,
} from './generate-articles';

function createArticle(content: string, referenceUrl: string): GeneratedArticlePayload {
    return {
        title: 'OpenAI API更新まとめ',
        excerpt: 'OpenAIの最新API更新点を1本で把握できるように整理した要約です。',
        content,
        tags: ['OpenAI', 'API'],
        references: [{ title: 'Primary source', url: referenceUrl }],
    };
}

const approvedSources: VerifiedOfficialSource[] = [
    {
        title: 'OpenAI Release Notes',
        url: 'https://openai.com/index/new-api-release/',
        domain: 'openai.com',
        type: 'official_news',
    },
    {
        title: 'arXiv Paper',
        url: 'https://arxiv.org/abs/2501.00001',
        domain: 'arxiv.org',
        type: 'research_paper',
    },
];

assert.equal(
    determineArticleFormat({ factCount: 5, sourcePacketCount: 2, totalSourceTextLength: 2400 }),
    'standard',
    'dense source packets should select standard format',
);
assert.equal(
    determineArticleFormat({ factCount: 2, sourcePacketCount: 1, totalSourceTextLength: 600 }),
    'brief',
    'thin source packets should select brief format',
);

const aiAllowed = getAllowedSourceTypesForAttribute('ai_news');
assert(aiAllowed.includes('research_paper'), 'AI articles should allow research papers');
assert(!aiAllowed.includes('store_page'), 'AI articles should not allow store pages');

assert.equal(
    normalizeUrlForCompare('https://openai.com/index/new-api-release/?utm_source=test#section'),
    'https://openai.com/index/new-api-release',
    'URL normalization should remove tracking parameters and hashes',
);

const validBrief = createArticle(
    '<p>OpenAIが新しいAPI更新を公開した。</p><h2>何が起きたか</h2><p>主な変更点を整理する。</p><h2>どう見るべきか</h2><p>既存実装への影響を簡潔にまとめる。</p>',
    approvedSources[0].url,
);
assert.equal(localValidateArticle(validBrief, 'brief', approvedSources).isBroken, false, 'brief article should pass with one or two h2 sections');

const tooLongBrief = createArticle(
    '<p>OpenAIが新しいAPI更新を公開した。</p><h2>何が起きたか</h2><p>主な変更点を整理する。</p><h2>重要ポイント</h2><p>追加の詳細。</p><h2>どう見るべきか</h2><p>既存実装への影響。</p>',
    approvedSources[0].url,
);
assert(
    localValidateArticle(tooLongBrief, 'brief', approvedSources).issues.some((issue) => issue.includes('Brief format')),
    'brief article should reject more than two h2 headings',
);
assert(
    canRepairArticleStructureLocally(localValidateArticle(tooLongBrief, 'brief', approvedSources).issues),
    'brief structure-only issues should be repairable locally',
);
const repairedBrief = ensureMinimumArticleStructure(tooLongBrief, 'brief');
assert.equal(
    localValidateArticle(repairedBrief, 'brief', approvedSources).isBroken,
    false,
    'brief article should pass after one local structure repair',
);

const invalidReferenceArticle = createArticle(
    '<p>OpenAIが新しいAPI更新を公開した。</p><h2>何が起きたか</h2><p>主な変更点を整理する。</p><h2>重要ポイント</h2><p>追加の詳細。</p><h2>ユーザー影響</h2><p>導入時の注意点。</p><h2>今後</h2><p>今後の展望。</p>',
    'https://example.com/summary',
);
assert(
    localValidateArticle(invalidReferenceArticle, 'standard', approvedSources).issues.some((issue) =>
        issue.includes('Reference not in approved official sources'),
    ),
    'references outside approved sources should be rejected',
);

const longPacketText = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1}.`).join(' ');
const summarizedPacket = summarizeSourcePacketText(longPacketText, 600);
assert(summarizedPacket.length <= 600, 'source packet summary should stay within the configured prompt budget');

assert.equal(
    shouldRunOptionalAiStage(8, 10, false),
    false,
    'optional AI stages should stay disabled by default',
);
assert.equal(
    shouldRunOptionalAiStage(8, 10, true),
    true,
    'optional AI stages can run only under the target budget',
);
assert.equal(
    shouldRunOptionalAiStage(12, 10, true),
    false,
    'optional AI stages should not run after the target budget is exceeded',
);
assert.equal(
    isOverHardCostLimit(16, 15),
    true,
    'hard cost limit should reject over-budget articles',
);
assert.equal(
    isOverHardCostLimit(15, 15),
    false,
    'hard cost limit should allow articles exactly at the cap',
);

console.log('test-article-generation-unit: OK');
