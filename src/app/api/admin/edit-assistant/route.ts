import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from "@/lib/supabase";
import type {
    Content,
    GenerateContentResponse,
    GroundingChunk,
    Part,
} from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
});

type AssistantMode = "chat" | "apply";
type AssistantAction = "edit" | "research" | "research-edit";

type ConversationItem = {
    role: "user" | "model" | "ai";
    text: string;
};

type ApplyResponse = {
    pages: string[];
    currentPageIndex: number;
    message?: string;
};

type ResearchSource = {
    title: string;
    uri: string;
    domain: string;
};

const APPLY_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        pages: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
        currentPageIndex: { type: Type.NUMBER },
        message: { type: Type.STRING },
    },
    required: ["pages"],
};

const RESEARCH_PATTERNS = [
    /リサーチ/,
    /調べ/,
    /調査/,
    /検索/,
    /最新/,
    /公式/,
    /出典/,
    /根拠/,
    /裏取り/,
    /ファクトチェック/,
    /確認/,
    /比較/,
    /ソース/,
    /reference/i,
    /\bresearch\b/i,
    /\bsearch\b/i,
    /\blook\s+up\b/i,
    /\blatest\b/i,
    /\bverify\b/i,
    /\bsource\b/i,
    /\bcitation\b/i,
    /\bfact-?check\b/i,
    /\bcompare\b/i,
];

const EDIT_PATTERNS = [
    /修正/,
    /変更/,
    /追記/,
    /更新/,
    /反映/,
    /書き換/,
    /追加/,
    /削除/,
    /改善/,
    /整え/,
    /リライト/,
    /直し/,
    /編集/,
    /\bedit\b/i,
    /\brewrite\b/i,
    /\brevise\b/i,
    /\bupdate\b/i,
    /\bmodify\b/i,
    /\bapply\b/i,
    /\bfix\b/i,
    /\badd\b/i,
    /\bremove\b/i,
];

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
}

function normalizeConversationHistory(history: unknown): ConversationItem[] {
    if (!Array.isArray(history)) return [];

    return history
        .filter((item): item is ConversationItem => {
            return !!item && typeof item === "object" && "role" in item && "text" in item;
        })
        .map((item) => ({
            role: item.role,
            text: typeof item.text === "string" ? item.text.trim() : "",
        }))
        .filter((item) => item.text.length > 0)
        .slice(-20);
}

function classifyAssistantAction(prompt: string): AssistantAction {
    const normalizedPrompt = prompt.trim();
    const wantsResearch = matchesAnyPattern(normalizedPrompt, RESEARCH_PATTERNS);
    const wantsEdit = matchesAnyPattern(normalizedPrompt, EDIT_PATTERNS);

    if (wantsResearch && wantsEdit) return "research-edit";
    if (wantsResearch) return "research";
    return "edit";
}

function shouldUseResearch(
    prompt: string,
    history: ConversationItem[]
): boolean {
    if (matchesAnyPattern(prompt, RESEARCH_PATTERNS)) return true;

    const recentUserMessages = history
        .filter((item) => item.role === "user")
        .slice(-4)
        .map((item) => item.text);

    if (recentUserMessages.some((text) => matchesAnyPattern(text, RESEARCH_PATTERNS))) {
        return true;
    }

    return false;
}

function extractHtmlFromText(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "";

    const markdownMatch = trimmed.match(/```(?:html|xml)?\s*([\s\S]*?)```/i);
    if (markdownMatch?.[1]) return markdownMatch[1].trim();

    const htmlMatch = trimmed.match(/(<[\s\S]*>)/);
    if (htmlMatch?.[1]) return htmlMatch[1].trim();

    return "";
}

function normalizePagesFromRequest(currentPages: unknown, currentHtml?: string): string[] {
    if (Array.isArray(currentPages)) {
        const pages = currentPages
            .filter((value): value is string => typeof value === "string")
            .map((value) => value);

        if (pages.length > 0) return pages;
    }

    return [typeof currentHtml === "string" ? currentHtml : ""];
}

function serializePagesForPrompt(pages: string[], maxCharsPerPage = 12000): string {
    return pages
        .map((page, index) => {
            const clipped = page.length > maxCharsPerPage
                ? `${page.slice(0, maxCharsPerPage)}\n<!-- truncated: original length ${page.length} chars -->`
                : page;

            return `<page index="${index}" human_page="${index + 1}">\n${clipped}\n</page>`;
        })
        .join("\n\n");
}

function clampPageIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    if (Number.isNaN(index)) return 0;
    return Math.min(Math.max(index, 0), length - 1);
}

function coerceApplyResponse(rawText: string, fallbackPageIndex: number): ApplyResponse | null {
    const output = rawText.trim();
    if (!output) return null;

    let parsed: unknown = null;
    try {
        parsed = JSON.parse(output);
    } catch {
        parsed = null;
    }

    let pages: string[] = [];
    let currentPageIndex = fallbackPageIndex;
    let message: string | undefined;

    if (parsed && typeof parsed === "object") {
        const obj = parsed as {
            pages?: unknown;
            currentPageIndex?: unknown;
            message?: unknown;
            html?: unknown;
        };

        if (Array.isArray(obj.pages)) {
            pages = obj.pages.filter((value): value is string => typeof value === "string");
        }

        if (pages.length === 0 && typeof obj.html === "string") {
            pages = [obj.html];
        }

        if (typeof obj.currentPageIndex === "number") {
            currentPageIndex = Math.floor(obj.currentPageIndex);
        }

        if (typeof obj.message === "string" && obj.message.trim()) {
            message = obj.message.trim();
        }
    }

    if (pages.length === 0) {
        const html = extractHtmlFromText(output);
        if (html) pages = [html];
    }

    if (pages.length === 0) return null;

    currentPageIndex = clampPageIndex(currentPageIndex, pages.length);
    return { pages, currentPageIndex, message };
}

function buildSystemInstruction(
    mode: AssistantMode,
    action: AssistantAction,
    researchEnabled: boolean
): string {
    if (mode === "apply") {
        return [
            "You are an editorial HTML assistant for a Japanese multi-page news article.",
            "Return JSON only and match the provided schema exactly.",
            "Preserve valid HTML and keep the existing page structure unless the approved request requires a change.",
            "Only change what is necessary to satisfy the approved request.",
            "If research is needed, use grounded web results only.",
            "Do not invent facts, dates, numbers, quotes, release details, or company statements.",
            "You may add clearly labeled editorial commentary, but never present invented reactions as verified public sentiment.",
            "If you mention X, Reddit, reviews, or forum reactions, use real grounded sources when available and paraphrase them in original wording.",
            "If you cite an X post inside article HTML, place the real status URL in its own paragraph so the frontend can embed it.",
            "If you add Steam store coverage for a game article, keep or add a short intro sentence above the store widget and never invent Steam app IDs or store URLs.",
            "If something cannot be verified, leave that point unchanged and mention it in the JSON message.",
            researchEnabled
                ? "Fresh verification is required for this request."
                : "Focus on the provided draft and approved plan.",
        ].join("\n");
    }

    return [
        "You are an editorial assistant for a Japanese multi-page news article.",
        "The current article pages are provided inside <pages>.",
        "In chat mode, never output raw HTML.",
        "Keep the response concise, practical, and easy to apply.",
        "When you mention a page, refer to it as Page 1, Page 2, and so on.",
        researchEnabled
            ? "Use grounded web research when needed and keep every factual claim tied to retrieved sources."
            : "Base your answer on the current draft unless the user asks for verification.",
        "If the user wants more color, you may suggest either sourced community reaction or a clearly labeled editorial note.",
        "Never present fabricated quotes or made-up public reactions as if they came from real users.",
        "When suggesting an X embed, tell the editor to place the real status URL on its own line or paragraph.",
        action === "research"
            ? "The user asked for research only. Summarize verified findings and note where the article may need updates."
            : action === "research-edit"
                ? "The user asked for research plus editing. Summarize verified findings, then explain the exact page-level edits you would make."
                : "Explain the edits you would make and why.",
    ].join("\n");
}

function buildUserPrompt(params: {
    mode: AssistantMode;
    action: AssistantAction;
    prompt: string;
    pageCount: number;
    currentPageIndex: number;
    pagesContext: string;
    researchEnabled: boolean;
}) {
    const {
        mode,
        action,
        prompt,
        pageCount,
        currentPageIndex,
        pagesContext,
        researchEnabled,
    } = params;

    if (mode === "apply") {
        return [
            "Current article draft:",
            `Page count: ${pageCount}`,
            `Current page index: ${currentPageIndex}`,
            "<pages>",
            pagesContext,
            "</pages>",
            "",
            "Approved request or plan:",
            prompt || "Apply the approved changes to the draft.",
            "",
            "Output requirements:",
            "- Return JSON only.",
            "- Keep page order unless the requested changes require a structural change.",
            "- You may add or remove pages when it is necessary for the approved request.",
            researchEnabled
                ? "- Re-check factual claims with grounded web results before you write them into the article."
                : "- Use the provided draft and plan as the main source of truth.",
            researchEnabled
                ? "- If you add community reaction, ground it in real X/Reddit/review/forum sources when available; otherwise use a clearly labeled editorial note."
                : "- You may add a clearly labeled editorial note for texture, but do not fabricate attributed quotes or public reactions.",
            "- If you include an X post in article HTML, place the real status URL in its own paragraph so it can render as an embed.",
            "- If the article is about a Steam-listed game, you may keep or add a short lead-in sentence above the Steam widget, but do not invent app IDs or store URLs.",
        ].join("\n");
    }

    const goalLine = action === "research"
        ? "- Return research findings and clearly separate verified information from suggestions."
        : action === "research-edit"
            ? "- Return verified findings first, then propose concrete page-level edits."
            : "- Return the edit plan you would apply.";

    return [
        "Current article draft:",
        `Page count: ${pageCount}`,
        `Current page index: ${currentPageIndex}`,
        "<pages>",
        pagesContext,
        "</pages>",
        "",
        "User request:",
        prompt,
        "",
        "Response requirements:",
        "- Do not output HTML in chat mode.",
        "- Reference pages as Page 1, Page 2, and so on when relevant.",
        goalLine,
        researchEnabled
            ? "- Use fresh grounded research when needed and keep claims strictly factual."
            : "- Focus on the draft that is already in the editor.",
        researchEnabled
            ? "- Distinguish sourced community reaction from editorial commentary."
            : "- You may suggest a clearly labeled editorial comment, but not a fabricated sourced reaction.",
        "- If you recommend using an X embed, explicitly say the real status URL should be placed in its own paragraph.",
    ].join("\n");
}

function getDomainFromUri(uri: string): string {
    try {
        return new URL(uri).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

function toResearchSource(chunk: GroundingChunk): ResearchSource | null {
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

function extractResearchSources(response: GenerateContentResponse): ResearchSource[] {
    const sources = new Map<string, ResearchSource>();

    for (const candidate of response.candidates ?? []) {
        for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
            const source = toResearchSource(chunk);
            if (!source) continue;

            sources.set(source.uri, source);
        }
    }

    return Array.from(sources.values()).slice(0, 8);
}

async function recordUsage(model: string, response: GenerateContentResponse) {
    const usage = response.usageMetadata;
    if (!usage) return;

    await supabase.from("api_usage").insert({
        model,
        input_tokens: usage.promptTokenCount,
        output_tokens: usage.candidatesTokenCount,
        operation: "edit",
    });
}

export async function POST(req: Request) {
    try {
        const {
            currentHtml,
            currentPages,
            currentPageIndex,
            prompt,
            model,
            mode,
            image,
            conversationHistory,
        }: {
            currentHtml?: string;
            currentPages?: unknown;
            currentPageIndex?: number;
            prompt?: string;
            model?: string;
            mode?: AssistantMode;
            image?: { data?: string; mimeType?: string };
            conversationHistory?: unknown;
        } = await req.json();

        const effectiveMode: AssistantMode = mode === "apply" ? "apply" : "chat";
        const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";

        if (!normalizedPrompt && effectiveMode === "chat") {
            return NextResponse.json(
                { error: "指示内容が空です。" },
                { status: 400 }
            );
        }

        const pages = normalizePagesFromRequest(currentPages, currentHtml);
        const safeCurrentPageIndex = clampPageIndex(
            typeof currentPageIndex === "number" ? Math.floor(currentPageIndex) : 0,
            pages.length
        );

        const normalizedHistory = normalizeConversationHistory(conversationHistory);
        const assistantAction = classifyAssistantAction(normalizedPrompt);
        const researchEnabled = shouldUseResearch(
            normalizedPrompt,
            normalizedHistory
        );

        const systemInstruction = buildSystemInstruction(
            effectiveMode,
            assistantAction,
            researchEnabled
        );

        const contents: Content[] = normalizedHistory.map((message) => ({
            role: message.role === "user" ? "user" : "model",
            parts: [{ text: message.text }],
        }));

        const userParts: Part[] = [];
        if (
            image &&
            typeof image.data === "string" &&
            typeof image.mimeType === "string" &&
            image.data.length > 0
        ) {
            userParts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.data,
                },
            });
        }

        const pagesContext = serializePagesForPrompt(pages);
        const userPromptText = buildUserPrompt({
            mode: effectiveMode,
            action: assistantAction,
            prompt: normalizedPrompt,
            pageCount: pages.length,
            currentPageIndex: safeCurrentPageIndex,
            pagesContext,
            researchEnabled,
        });

        userParts.push({ text: userPromptText });
        contents.push({ role: "user", parts: userParts });

        const targetModel = model || "gemini-3.1-pro-preview";
        const response = await ai.models.generateContent({
            model: targetModel,
            contents,
            config: effectiveMode === "apply"
                ? {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: APPLY_RESPONSE_SCHEMA,
                    temperature: 0.1,
                    ...(researchEnabled ? { tools: [{ googleSearch: {} }] } : {}),
                }
                : {
                    systemInstruction,
                    responseMimeType: "text/plain",
                    temperature: researchEnabled ? 0.1 : 0.2,
                    ...(researchEnabled ? { tools: [{ googleSearch: {} }] } : {}),
                },
        });

        await recordUsage(targetModel, response);

        const outputText = response.text?.trim() || "";

        if (effectiveMode === "apply") {
            const applyResponse = coerceApplyResponse(outputText, safeCurrentPageIndex);
            if (!applyResponse) {
                return NextResponse.json(
                    { error: "AIの返答を記事データとして解釈できませんでした。" },
                    { status: 502 }
                );
            }

            return NextResponse.json({
                success: true,
                type: "apply",
                pages: applyResponse.pages,
                currentPageIndex: applyResponse.currentPageIndex,
                html:
                    applyResponse.pages[applyResponse.currentPageIndex] ||
                    applyResponse.pages[0] ||
                    "",
                message:
                    applyResponse.message ||
                    "変更を適用しました。プレビューに反映しています。",
            });
        }

        const sources = researchEnabled ? extractResearchSources(response) : [];

        return NextResponse.json({
            success: true,
            type: "chat",
            message: outputText || "提案を生成できませんでした。別の指示で試してください。",
            assistantAction,
            allowApply: assistantAction !== "research",
            researchUsed: researchEnabled,
            sources,
        });
    } catch (error) {
        console.error("AI Edit Assistant API Error:", error);
        return NextResponse.json(
            { error: "AIの処理に失敗しました。サーバー設定を確認してください。" },
            { status: 500 }
        );
    }
}
