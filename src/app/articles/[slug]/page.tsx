import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, User, ArrowLeft, Tag, ExternalLink, BookOpen } from "lucide-react";
import { getArticleBySlug, getPublishedArticles } from "@/data/articles";
import { Sidebar } from "@/components/sidebar";
import { ShareButton } from "@/components/share-button";
import { ViewTracker } from "@/components/view-tracker";
import { ReadingProgress } from "@/components/reading-progress";
import { RelatedArticles } from "@/components/related-articles";
import type { Metadata } from "next";

export const revalidate = 0; // 常に最新データを取得

// --- SEO: Dynamic Metadata ---
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = await getArticleBySlug(slug);

    if (!article) {
        return { title: "記事が見つかりません - 俺的ゲームニュース" };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return {
        title: `${article.title} - 俺的ゲームニュース`,
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
            siteName: "俺的ゲームニュース",
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

// Estimate reading time (Japanese: ~500 chars/min)
function estimateReadingTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    const charCount = text.length;
    return Math.max(1, Math.ceil(charCount / 500));
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
    const currentPage = typeof pageParam === 'string' ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

    const article = await getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    const date = new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP');

    const pages = article.content ? article.content.split('<!-- PAGE_BREAK -->') : [""];
    const totalPages = pages.length;

    // Ensure the requested page is within valid bounds
    const validPageIndex = Math.min(Math.max(0, currentPage - 1), totalPages - 1);
    const pageContent = pages[validPageIndex] || "";

    const readingTime = estimateReadingTime(article.content || "");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // JSON-LD Structured Data
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
            name: "俺的ゲームニュース",
        },
        url: `${siteUrl}/articles/${slug}`,
        keywords: article.tags.join(", "),
    };

    return (
        <>
            <ReadingProgress />
            <ViewTracker articleId={article.id} />

            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Hero Image */}
            <div className="relative h-[40vh] min-h-[320px] w-full overflow-hidden sm:h-[50vh] md:h-[55vh]">
                <Image
                    src={article.image_url}
                    alt={article.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

                <Link
                    href="/"
                    className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:left-6 sm:top-6"
                >
                    <ArrowLeft className="h-4 w-4" />
                    トップへ戻る
                </Link>

                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
                    <div className="mx-auto max-w-4xl">
                        {/* Tags on hero */}
                        {article.tags.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {article.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full bg-orange-500/80 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
                            {article.title}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Article Content */}
            <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 sm:py-12 lg:px-12 xl:px-16">
                <div className="flex flex-col gap-10 md:flex-row md:justify-between lg:gap-16">
                    <article className="min-w-0 flex-1 max-w-5xl">
                        {/* Meta Info */}
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

                        {/* Article Body */}
                        <div
                            className="article-content text-white"
                            dangerouslySetInnerHTML={{ __html: pageContent }}
                        />

                        {/* Pagination Controls */}
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
                                    <div /> /* Empty div to maintain spacing */
                                )}

                                <div className="hidden sm:flex items-center gap-2">
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <Link
                                            key={i}
                                            href={`/articles/${slug}?page=${i + 1}`}
                                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${i === validPageIndex
                                                ? "bg-orange-500 text-white shadow-md"
                                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                }`}
                                        >
                                            {i + 1}
                                        </Link>
                                    ))}
                                </div>
                                <div className="sm:hidden text-sm font-medium text-zinc-500 dark:text-zinc-400">
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
                                    <div /> /* Empty div to maintain spacing */
                                )}
                            </div>
                        )}

                        {/* Source */}
                        {article.source_url && (
                            <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    引用元:
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

                        {/* Tags */}
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

                        {/* Related Articles */}
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
