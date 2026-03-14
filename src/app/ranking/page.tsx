import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getPopularArticles } from "@/data/articles";
import { ARTICLE_CATEGORY_CONFIG, parseArticleCategory } from "@/lib/article-taxonomy";
import { CategoryTabs } from "@/components/category-tabs";

export const revalidate = 60;

export const metadata: Metadata = {
    title: "人気ランキング",
    description: "カテゴリごとの人気記事ランキングを確認できます。",
};

export default async function RankingPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>;
}) {
    const params = await searchParams;
    const category = parseArticleCategory(params.category);
    const categoryConfig = ARTICLE_CATEGORY_CONFIG[category];
    const rankedArticles = await getPopularArticles(10, category);

    return (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="mb-8">
                <CategoryTabs activeCategory={category} />
                <Link
                    href={categoryConfig.href}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {categoryConfig.label}トップへ戻る
                </Link>
                <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${categoryConfig.accentFrom} ${categoryConfig.accentTo}`}>
                        <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">
                            {categoryConfig.label} 人気ランキング
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            閲覧数の多い記事をカテゴリ別に表示しています。
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {rankedArticles.map((article, index) => (
                    <Link
                        key={article.id}
                        href={`/articles/${article.slug}`}
                        className="group flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:gap-5 sm:p-5"
                    >
                        <div className="flex flex-col items-center justify-center">
                            <span
                                className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold sm:h-12 sm:w-12 sm:text-lg ${index === 0
                                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-400/30"
                                    : index === 1
                                        ? "bg-gradient-to-br from-zinc-300 to-zinc-400 text-white dark:from-zinc-500 dark:to-zinc-600"
                                        : index === 2
                                            ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                    }`}
                            >
                                {index + 1}
                            </span>
                        </div>

                        <div className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-xl sm:block sm:w-40">
                            <Image
                                src={article.image_url}
                                alt={article.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="160px"
                            />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                            <div className={`mb-2 inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold ${categoryConfig.chipClassName}`}>
                                {categoryConfig.label}
                            </div>
                            <h2 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-800 transition-colors group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400 sm:text-base">
                                {article.title}
                            </h2>
                            <p className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                                {article.excerpt}
                            </p>
                            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <time>{new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP')}</time>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {rankedArticles.length === 0 && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-zinc-500 dark:text-zinc-400">まだ記事がありません</p>
                    </div>
                )}
            </div>
        </div>
    );
}
