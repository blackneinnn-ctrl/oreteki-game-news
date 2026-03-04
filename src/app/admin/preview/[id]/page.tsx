import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, User, ArrowLeft, Tag, ExternalLink } from "lucide-react";
import { getArticleById } from "@/data/articles";
import { Sidebar } from "@/components/sidebar";
import { ShareButton } from "@/components/share-button";
import { PreviewEditor } from "@/components/preview-editor";

export const revalidate = 0; // 常に最新データを取得（プレビューのため）

export default async function PreviewArticlePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const article = await getArticleById(id);

    if (!article) {
        notFound();
    }

    const date = new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP');

    return (
        <>
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
                    href={`/admin?edit=${article.id}`}
                    className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-orange-500/80 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-orange-600 sm:left-6 sm:top-6 shadow-md"
                >
                    <ArrowLeft className="h-4 w-4" />
                    管理画面へ戻る (プレビュー終了)
                </Link>

                <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
                    <div className="rounded-full bg-black/60 px-4 py-2 text-sm font-bold tracking-widest text-emerald-400 backdrop-blur-sm border border-emerald-500/30 uppercase flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        プレビューモード
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
                    <div className="mx-auto max-w-4xl">
                        <div className="flex gap-2 mb-3">
                            <span className="rounded-md bg-white/20 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white border border-white/20">
                                {article.status === 'draft' ? '下書き' : '公開済み'}
                            </span>
                        </div>
                        <h1 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
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
                            <ShareButton
                                url={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/articles/${article.slug}`}
                                title={article.title}
                            />
                        </div>

                        {/* Article Body Editor (Preview & Direct Edit) */}
                        <PreviewEditor articleId={article.id} initialContent={article.content} />

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
                        {article.tags.length > 0 && (
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
                        )}
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
