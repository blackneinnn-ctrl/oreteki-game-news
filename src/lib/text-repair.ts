import iconv from 'iconv-lite';

const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/g;
const HALF_WIDTH_KANA = /[\uff61-\uff9f]/g;
const REPLACEMENT_CHAR = /\ufffd/g;
const DOT_SU_MARKER = /\u30fb\uff7d/g;
const LATIN1_MOJIBAKE = /[\u00c2\u00c3\u00d0]/g;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function countMojibakeMarkers(text: string): number {
  return (
    countMatches(text, REPLACEMENT_CHAR) +
    countMatches(text, DOT_SU_MARKER) +
    countMatches(text, LATIN1_MOJIBAKE)
  );
}

function scoreJapaneseText(text: string): number {
  if (!text) return -9999;

  const japaneseChars = countMatches(text, JAPANESE_TEXT);
  const replacementChars = countMatches(text, REPLACEMENT_CHAR);
  const dotSuMarkers = countMatches(text, DOT_SU_MARKER);
  const latinMarkers = countMatches(text, LATIN1_MOJIBAKE);
  const halfWidthKana = countMatches(text, HALF_WIDTH_KANA);

  return japaneseChars * 2 - replacementChars * 10 - dotSuMarkers * 8 - latinMarkers * 4 - halfWidthKana * 2;
}

function tryDecodeLatin1ToUtf8(value: string): string {
  return Buffer.from(value, 'latin1').toString('utf8');
}

function tryDecodeShiftJisToUtf8(value: string): string {
  return iconv.decode(Buffer.from(value, 'binary'), 'cp932');
}

function pickBestCandidate(original: string, candidates: string[]): string {
  const uniqueCandidates = Array.from(
    new Set([original, ...candidates].map((candidate) => candidate.trim()).filter(Boolean)),
  );

  let best = original;
  let bestScore = scoreJapaneseText(original);

  for (const candidate of uniqueCandidates) {
    const candidateScore = scoreJapaneseText(candidate);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return best;
}

export function repairPossiblyMojibake(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const hasJapanese = countMatches(trimmed, JAPANESE_TEXT) > 0;
  const markerCount = countMojibakeMarkers(trimmed);

  if (hasJapanese && markerCount === 0) {
    return value;
  }

  const repaired = pickBestCandidate(value, [
    tryDecodeLatin1ToUtf8(value),
    tryDecodeShiftJisToUtf8(value),
    tryDecodeLatin1ToUtf8(tryDecodeShiftJisToUtf8(value)),
    tryDecodeShiftJisToUtf8(tryDecodeLatin1ToUtf8(value)),
  ]);

  return scoreJapaneseText(repaired) > scoreJapaneseText(value) ? repaired : value;
}

export function repairArticleTextFields<T extends { title: string; excerpt: string; content: string }>(
  article: T,
): T {
  return {
    ...article,
    title: repairPossiblyMojibake(article.title),
    excerpt: repairPossiblyMojibake(article.excerpt),
    content: repairPossiblyMojibake(article.content),
  };
}
