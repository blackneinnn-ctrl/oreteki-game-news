import type { GenerateContentResponse, GroundingChunk } from "@google/genai";

export type GroundingSource = {
  title: string;
  uri: string;
  domain: string;
};

export function getDomainFromUri(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toGroundingSource(chunk: GroundingChunk): GroundingSource | null {
  const uri = chunk.web?.uri?.trim();
  if (!uri) return null;

  const domain = getDomainFromUri(uri);
  const title = chunk.web?.title?.trim() || domain || uri;

  return {
    title,
    uri,
    domain,
  };
}

export function extractGroundingSources(response: GenerateContentResponse): GroundingSource[] {
  const sources = new Map<string, GroundingSource>();

  for (const candidate of response.candidates ?? []) {
    for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
      const source = toGroundingSource(chunk);
      if (!source) continue;

      sources.set(source.uri, source);
    }
  }

  return Array.from(sources.values());
}
