import assert from 'node:assert/strict';
import {
    buildResearchGenerationConfig,
    buildStructuredJsonGenerationConfig,
    executeResearchGeneration,
    parseResearchPayloadFromText,
} from './generate-articles';

const researchConfig = buildResearchGenerationConfig();
assert.deepEqual(researchConfig.tools, [{ googleSearch: {} }], 'research config should keep googleSearch enabled');
assert.equal('responseMimeType' in researchConfig, false, 'research config must not include responseMimeType');
assert.equal('responseJsonSchema' in researchConfig, false, 'research config must not include responseJsonSchema');

const structuredConfig = buildStructuredJsonGenerationConfig({ type: 'object' }, 512, 0);
assert.equal(structuredConfig.responseMimeType, 'application/json', 'structured config should keep JSON mime type');
assert.equal(structuredConfig.responseJsonSchema !== undefined, true, 'structured config should keep response schema');

const researchText = `<research>
shouldSkip: false
skipReason:
canonicalTitle: Coffee Talk
eventSummary: Coffee Talk がスマホ向けに配信開始された。
facts:
- Android / iOS 向け配信開始
- 既存PC版から展開された
officialUrlCandidates:
- official_news | Official News | https://example.com/news/coffee-talk
- official_site | Store Page | https://example.com/coffee-talk
primarySourceUrl: https://example.com/news/coffee-talk
basicInfo:
- releaseDate: 2026-03-20
- platforms: iOS, Android
</research>`;

const parsed = parseResearchPayloadFromText(researchText);
assert.equal(parsed.shouldSkip, false, 'parser should read shouldSkip');
assert.equal(parsed.canonicalTitle, 'Coffee Talk', 'parser should read canonicalTitle');
assert.equal(parsed.facts.length, 2, 'parser should read facts');
assert.equal(parsed.officialUrlCandidates.length, 2, 'parser should read officialUrlCandidates');
assert.equal(parsed.primarySourceUrl, 'https://example.com/news/coffee-talk', 'parser should read primary source URL');

async function main() {
    const capturedRequests: Array<{ model: string; contents: string; config: unknown }> = [];
    const mockGenerateContent = async (params: { model: string; contents: string; config: unknown }) => {
        capturedRequests.push(params);
        return {
            text: researchText,
            candidates: [],
        } as any;
    };

    const result = await executeResearchGeneration(
        mockGenerateContent,
        {
            title: 'Coffee Talk がスマホ向けに配信開始',
            link: 'https://media.example.com/article/coffee-talk',
            sourceName: 'Media Example',
            summary: 'Coffee Talk のモバイル版配信開始を伝える候補。',
        },
        'game_intro',
        { keywordMode: false, enforceRecency: false },
    );

    assert.equal(capturedRequests.length, 1, 'research generation should succeed without fallback in the hotfix path');
    assert.equal('responseMimeType' in (capturedRequests[0].config as Record<string, unknown>), false, 'research call should not send responseMimeType');
    assert.equal(
        'responseJsonSchema' in (capturedRequests[0].config as Record<string, unknown>),
        false,
        'research call should not send responseJsonSchema',
    );
    assert.equal(result.payload.canonicalTitle, 'Coffee Talk', 'research flow should parse plain-text response into payload');

    console.log('test-research-hotfix: OK');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
