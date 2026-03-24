import assert from 'node:assert/strict';
import {
    determineArticleFormat,
    getAllowedSourceTypesForAttribute,
    localValidateArticle,
    type ArticleFormat,
    type GeneratedArticlePayload,
    type VerifiedOfficialSource,
} from './generate-articles';

type Scenario = {
    name: string;
    attribute: 'game_news' | 'game_intro' | 'ai_news' | 'ai_research';
    metrics: { factCount: number; sourcePacketCount: number; totalSourceTextLength: number };
    expectedFormat: ArticleFormat;
    article: GeneratedArticlePayload;
    sources: VerifiedOfficialSource[];
};

const scenarios: Scenario[] = [
    {
        name: 'game-major-announcement',
        attribute: 'game_news',
        metrics: { factCount: 5, sourcePacketCount: 3, totalSourceTextLength: 2600 },
        expectedFormat: 'standard',
        article: {
            title: 'Monster Hunter Wilds新映像と発売情報まとめ',
            excerpt: 'Monster Hunter Wildsの最新発表で判明した映像、発売時期、プレイヤー向けの重要ポイントを整理した。',
            content:
                '<p>CapcomがMonster Hunter Wildsの最新情報を公開した。</p><h2>何が起きたか</h2><p>公式映像と発売情報が更新された。</p><h2>重要ポイント</h2><p>新システムや追加要素が明らかになった。</p><h2>ユーザー影響</h2><p>購入判断や復帰タイミングの材料になる。</p><h2>今後</h2><p>次回発表で確認したい点を整理する。</p>',
            tags: ['Monster Hunter Wilds', 'Capcom'],
            references: [{ title: 'Capcom', url: 'https://www.capcom-games.com/mhwilds/' }],
        },
        sources: [
            {
                title: 'Capcom Official',
                url: 'https://www.capcom-games.com/mhwilds/',
                domain: 'capcom-games.com',
                type: 'official_site',
            },
        ],
    },
    {
        name: 'game-thin-brief',
        attribute: 'game_news',
        metrics: { factCount: 2, sourcePacketCount: 1, totalSourceTextLength: 520 },
        expectedFormat: 'brief',
        article: {
            title: 'Steam版の短報アップデートまとめ',
            excerpt: 'Steam告知で確認できた更新内容を短報として整理した。',
            content:
                '<p>公式ストア告知で更新内容が公開された。</p><h2>何が起きたか</h2><p>更新日と主な変更点が案内された。</p><h2>どう見るべきか</h2><p>既存ユーザーは影響範囲だけ確認すればよい。</p>',
            tags: ['Steam', 'アップデート'],
            references: [{ title: 'Steam Store', url: 'https://store.steampowered.com/app/12345/' }],
        },
        sources: [
            {
                title: 'Steam Store',
                url: 'https://store.steampowered.com/app/12345/',
                domain: 'store.steampowered.com',
                type: 'store_page',
            },
        ],
    },
    {
        name: 'ai-model-update',
        attribute: 'ai_news',
        metrics: { factCount: 3, sourcePacketCount: 1, totalSourceTextLength: 740 },
        expectedFormat: 'brief',
        article: {
            title: 'OpenAI API更新の要点まとめ',
            excerpt: 'OpenAI APIの更新内容と利用者への影響を短く整理した。',
            content:
                '<p>OpenAIがAPIの更新内容を公開した。</p><h2>何が起きたか</h2><p>新機能と変更点が追加された。</p><h2>どう見るべきか</h2><p>既存実装の確認ポイントを先に押さえたい。</p>',
            tags: ['OpenAI', 'API'],
            references: [{ title: 'OpenAI', url: 'https://openai.com/index/new-api-release/' }],
        },
        sources: [
            {
                title: 'OpenAI Release Notes',
                url: 'https://openai.com/index/new-api-release/',
                domain: 'openai.com',
                type: 'official_news',
            },
        ],
    },
    {
        name: 'ai-paper-explainer',
        attribute: 'ai_research',
        metrics: { factCount: 5, sourcePacketCount: 2, totalSourceTextLength: 2100 },
        expectedFormat: 'standard',
        article: {
            title: '新しいAI論文の要点と実務インパクト',
            excerpt: '公開されたAI論文の主張、技術的な新規性、実務上の示唆をまとめた。',
            content:
                '<p>新しいAI論文が公開され、技術的な改善点が示された。</p><h2>何が起きたか</h2><p>論文の目的と主張を整理する。</p><h2>重要ポイント</h2><p>新規性と比較優位を確認する。</p><h2>ユーザー影響</h2><p>開発現場での活用余地を検討する。</p><h2>今後</h2><p>今後の検証ポイントをまとめる。</p>',
            tags: ['AI論文', 'LLM'],
            references: [{ title: 'arXiv', url: 'https://arxiv.org/abs/2501.00001' }],
        },
        sources: [
            {
                title: 'arXiv Paper',
                url: 'https://arxiv.org/abs/2501.00001',
                domain: 'arxiv.org',
                type: 'research_paper',
            },
        ],
    },
];

for (const scenario of scenarios) {
    assert.equal(
        determineArticleFormat(scenario.metrics),
        scenario.expectedFormat,
        `${scenario.name}: format selection should match expected density`,
    );
    assert.equal(
        localValidateArticle(scenario.article, scenario.expectedFormat, scenario.sources).isBroken,
        false,
        `${scenario.name}: fixture article should pass validation`,
    );
}

assert(!getAllowedSourceTypesForAttribute('ai_news').includes('store_page'), 'AI scenarios must not allow store_page');
assert(getAllowedSourceTypesForAttribute('game_news').includes('store_page'), 'Game scenarios should continue to allow store_page');

console.log('test-article-generation-scenarios: OK');
