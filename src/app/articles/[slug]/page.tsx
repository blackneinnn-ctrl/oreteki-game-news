import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, User, ArrowLeft, Tag, ExternalLink } from "lucide-react";
import { getArticleBySlug, getPublishedArticles } from "@/data/articles";
import { Sidebar } from "@/components/sidebar";
import { ShareButton } from "@/components/share-button";
import { ViewTracker } from "@/components/view-tracker";

export const revalidate = 0; // 常に最新データを取得

export async function generateStaticParams() {
    const articles = await getPublishedArticles();
    return articles.map((article) => ({
        slug: article.slug,
    }));
}

export default async function ArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article = await getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    const date = new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP');

    return (
        <>
            <ViewTracker articleId={article.id} />
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
                        <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
                            {article.title}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Article Content */}
            <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-12">
                <div className="flex flex-col gap-10 lg:flex-row">
                    <article className="min-w-0 flex-1">
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
                            <ShareButton
                                url={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/articles/${slug}`}
                                title={article.title}
                            />
                        </div>

                        {/* Article Body */}
                        <div
                            className="article-content text-zinc-700 dark:text-zinc-300"
                            dangerouslySetInnerHTML={{ __html: article.content }}
                        />

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
                                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </article>

                    <div className="w-full shrink-0 lg:w-80">
                        <div className="lg:sticky lg:top-24">
                            <Sidebar />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
