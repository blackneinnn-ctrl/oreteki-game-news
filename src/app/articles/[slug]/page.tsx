import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, User, ArrowLeft, Tag, ExternalLink, BookOpen, Sparkles } from "lucide-react";
import { getArticleBySlug, getPublishedArticles } from "@/data/articles";
import { Sidebar } from "@/components/sidebar";
import { ShareButton } from "@/components/share-button";
import { ViewTracker } from "@/components/view-tracker";
import { ReadingProgress } from "@/components/reading-progress";
import { RelatedArticles } from "@/components/related-articles";
import type { Metadata } from "next";

const SITE_NAME = "俺的ゲームニュース";

export const revalidate = 0;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticleBySlug(slug);

    if (!article) {
        return { title: `記事が見つかりません - ${SITE_NAME}` };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return {
        title: `${article.title} - ${SITE_NAME}`,
        description: article.excerpt || article.title,
        openGraph: {
            title: article.title,
            description: article.excerpt || article.title,
            type: "article",
            url: `${siteUrl}/articles/${slug}`,
            images: [
                {
                    url: article.image_url,
                    width: 1200,
                    height: 630,
                    alt: article.title,
                },
            ],
            siteName: SITE_NAME,
            publishedTime: article.published_at ?? article.created_at,
            authors: [article.author],
            tags: article.tags,
        },
        twitter: {
            card: "summary_large_image",
            title: article.title,
            description: article.excerpt || article.title,
            images: [article.image_url],
        },
    };
}

export async function generateStaticParams() {
    const articles = await getPublishedArticles();
    return articles.map((article) => ({
        slug: article.slug,
    }));
}

function estimateReadingTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    const charCount = text.length;
    return Math.max(1, Math.ceil(charCount / 500));
}

function extractSectionHeadings(html: string): string[] {
    return [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
        .map((match) =>
            match[1]
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        )
        .filter((heading) => heading.length > 0)
        .slice(0, 3);
}

export default async function ArticlePage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { slug } = await params;
    const searchParamsResolved = await searchParams;

    const pageParam = searchParamsResolved.page;
    const currentPage = typeof pageParam === "string" ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

    const article = await getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    const date = new Date(article.published_at ?? article.created_at).toLocaleDateString("ja-JP");

    const pages = article.content ? article.content.split("<!-- PAGE_BREAK -->") : [""];
    const totalPages = pages.length;
    const validPageIndex = Math.min(Math.max(0, currentPage - 1), totalPages - 1);
    const pageContent = pages[validPageIndex] || "";

    const readingTime = estimateReadingTime(article.content || "");
    const sectionHeadings = extractSectionHeadings(article.content || "");
    const highlights = [article.excerpt, ...sectionHeadings].filter((text) => text.trim().length > 0).slice(0, 4);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        image: article.image_url,
        datePublished: article.published_at ?? article.created_at,
        author: {
            "@type": "Person",
            name: article.author,
        },
        publisher: {
            "@type": "Organization",
            name: SITE_NAME,
        },
        url: `${siteUrl}/articles/${slug}`,
        keywords: article.tags.join(", "),
    };

    return (
        <>
            <ReadingProgress />
            <ViewTracker articleId={article.id} />

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="relative h-[44vh] min-h-[320px] w-full overflow-hidden sm:h-[54vh] md:h-[58vh]">
                <Image
                    src={article.image_url}
                    alt={article.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent" />
                <div className="article-hero-noise absolute inset-0" />
                <div className="pointer-events-none absolute -right-14 top-14 h-52 w-52 rounded-full bg-orange-500/35 blur-3xl" />
                <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />

                <Link
                    href="/"
                    className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/60 sm:left-6 sm:top-6"
                >
                    <ArrowLeft className="h-4 w-4" />
                    トップへ戻る
                </Link>

                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
                    <div className="mx-auto max-w-4xl">
                        {article.tags.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {article.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-white/20 bg-orange-500/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-5xl md:leading-tight">
                            {article.title}
                        </h1>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 sm:py-12 lg:px-12 xl:px-16">
                <div className="flex flex-col gap-10 md:flex-row md:justify-between lg:gap-16">
                    <article className="min-w-0 max-w-5xl flex-1">
                        <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
                                    <User className="h-4 w-4" />
                                </div>
                                <span className="font-medium">{article.author}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                <Clock className="h-4 w-4" />
                                <time>{date}</time>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                <BookOpen className="h-4 w-4" />
                                <span>約{readingTime}分で読めます</span>
                            </div>
                            <ShareButton
                                url={`${siteUrl}/articles/${slug}`}
                                title={article.title}
                            />
                        </div>

                        <section className="article-stage">
                            <div className="article-stage__glow" />
                            <div className="relative z-10">
                                <div className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                                    <div className="article-cinematic-in rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-5 backdrop-blur-sm sm:p-6">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-300">
                                            LEAD
                                        </p>
                                        <p className="mt-3 text-sm leading-7 text-zinc-100 sm:text-base">
                                            {article.excerpt}
                                        </p>
                                    </div>

                                    {highlights.length > 0 && (
                                        <div className="article-cinematic-in article-cinematic-in--delay rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 sm:p-6">
                                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                                                <Sparkles className="h-4 w-4" />
                                                この記事の見どころ
                                            </div>
                                            <ul className="article-highlight-list text-sm text-zinc-100">
                                                {highlights.map((item, index) => (
                                                    <li key={`${item}-${index}`}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div
                                    className="article-content text-white"
                                    dangerouslySetInnerHTML={{ __html: pageContent }}
                                />
                            </div>
                        </section>

                        {totalPages > 1 && (
                            <div className="mt-12 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
                                {validPageIndex > 0 ? (
                                    <Link
                                        href={`/articles/${slug}?page=${validPageIndex}`}
                                        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        前のページ
                                    </Link>
                                ) : (
                                    <div />
                                )}

                                <div className="hidden items-center gap-2 sm:flex">
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <Link
                                            key={i}
                                            href={`/articles/${slug}?page=${i + 1}`}
                                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                                                i === validPageIndex
                                                    ? "bg-orange-500 text-white shadow-md"
                                                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                            }`}
                                        >
                                            {i + 1}
                                        </Link>
                                    ))}
                                </div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 sm:hidden">
                                    {validPageIndex + 1} / {totalPages}
                                </div>

                                {validPageIndex < totalPages - 1 ? (
                                    <Link
                                        href={`/articles/${slug}?page=${validPageIndex + 2}`}
                                        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                    >
                                        次のページ
                                        <ArrowLeft className="h-4 w-4 rotate-180" />
                                    </Link>
                                ) : (
                                    <div />
                                )}
                            </div>
                        )}

                        {article.source_url && (
                            <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    出典:
                                    <a
                                        href={article.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 inline-flex items-center gap-1 text-orange-600 underline hover:text-orange-700 dark:text-orange-400"
                                    >
                                        {article.source_name ?? article.source_url}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </p>
                            </div>
                        )}

                        <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                <Tag className="h-4 w-4" />
                                <span className="font-medium">タグ:</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {article.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-orange-500/30 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <RelatedArticles currentId={article.id} tags={article.tags} />
                    </article>

                    <div className="w-full shrink-0 md:w-72 lg:w-80">
                        <div className="md:sticky md:top-24">
                            <Sidebar />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
