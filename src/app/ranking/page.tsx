import Link from "next/link";
import Image from "next/image";
import { Trophy, Clock, ArrowLeft } from "lucide-react";
import { getPopularArticles } from "@/data/articles";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
    title: "閲覧ランキング - 俺的ゲームニュース",
    description: "俺的ゲームニュースの人気記事ランキング。閲覧数順に記事を表示しています。",
};

export default async function RankingPage() {
    const rankedArticles = await getPopularArticles(10);

    return (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="mb-8">
                <Link
                    href="/"
                    className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
                >
                    <ArrowLeft className="h-4 w-4" />
                    トップへ戻る
                </Link>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25">
                        <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">
                            閲覧ランキング
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            人気の記事を閲覧数順に表示
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
