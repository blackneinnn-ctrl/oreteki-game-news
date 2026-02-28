import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";
import { getPopularArticles } from "@/data/articles";
import { formatViews } from "@/lib/format";

export async function Sidebar() {
    const popular = await getPopularArticles(5);

    return (
        <aside className="space-y-8">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 border-b border-zinc-200 bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 dark:border-zinc-800">
                    <Flame className="h-4 w-4 text-white" />
                    <h2 className="text-sm font-bold text-white">人気記事ランキング</h2>
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {popular.map((article, index) => (
                        <li key={article.id}>
                            <Link
                                href={`/articles/${article.slug}`}
                                className="group flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                                <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0
                                        ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-400/30"
                                        : index === 1
                                            ? "bg-gradient-to-br from-zinc-300 to-zinc-400 text-white dark:from-zinc-500 dark:to-zinc-600"
                                            : index === 2
                                                ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                        }`}
                                >
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-700 transition-colors group-hover:text-orange-600 dark:text-zinc-300 dark:group-hover:text-orange-400">
                                        {article.title}
                                    </p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <TrendingUp className="h-3 w-3 text-zinc-400" />
                                        <span className="text-xs text-zinc-400">
                                            {formatViews(article.views)} views
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
                {popular.length > 0 && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800">
                        <Link
                            href="/ranking"
                            className="flex items-center justify-center py-3 text-sm font-medium text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                        >
                            ランキングをもっと見る →
                        </Link>
                    </div>
                )}
                {popular.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-zinc-400">
                        まだ記事がありません
                    </div>
                )}
            </div>
        </aside>
    );
}
