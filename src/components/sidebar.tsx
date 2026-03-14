import Link from "next/link";
import Image from "next/image";
import { Flame } from "lucide-react";
import { getPopularArticles } from "@/data/articles";
import { ARTICLE_CATEGORY_CONFIG, type ArticleCategory } from "@/lib/article-taxonomy";

interface SidebarProps {
    category?: ArticleCategory;
}

export async function Sidebar({ category }: SidebarProps) {
    const resolvedCategory = category ?? "game";
    const popular = await getPopularArticles(5, resolvedCategory);
    const categoryConfig = ARTICLE_CATEGORY_CONFIG[resolvedCategory];

    return (
        <aside className="space-y-8">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className={`flex items-center gap-2 border-b border-zinc-200 bg-gradient-to-r px-5 py-3 dark:border-zinc-800 ${categoryConfig.accentFrom} ${categoryConfig.accentTo}`}>
                    <Flame className="h-4 w-4 shrink-0 text-white" />
                    <div className="whitespace-nowrap text-sm font-bold text-white">人気記事ランキング</div>
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
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
                {popular.length > 0 && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800">
                        <Link
                            href={categoryConfig.rankingHref}
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

            <div className="mt-8 flex justify-center">
                <a
                    href="https://amzn.to/4r33xwU"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block transition-opacity hover:opacity-80"
                >
                    <Image
                        src="https://m.media-amazon.com/images/I/41ImhhWJdmL._AC_.jpg"
                        alt="Amazon Product"
                        width={250}
                        height={250}
                        className="w-full max-w-[250px] rounded-lg object-contain"
                    />
                </a>
            </div>
        </aside>
    );
}
