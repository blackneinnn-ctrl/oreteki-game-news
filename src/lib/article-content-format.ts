const PAGE_BREAK_TOKEN = "<!-- PAGE_BREAK -->";

export function normalizeLegacyArticleContent(content: string | null | undefined): string {
  if (!content) return "";

  if (!content.includes(PAGE_BREAK_TOKEN)) {
    return content;
  }

  return content
    .split(PAGE_BREAK_TOKEN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n<hr>\n");
}

export function serializeArticleContent(content: string | null | undefined): string {
  if (!content) return "";

  return normalizeLegacyArticleContent(content).trim();
}
