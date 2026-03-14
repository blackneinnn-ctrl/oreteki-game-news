import Image from "next/image";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getPopularArticles } from "@/data/articles";
import { ARTICLE_CATEGORY_CONFIG, type ArticleCategory } from "@/lib/article-taxonomy";

interface TrendingScrollProps {
    category?: ArticleCategory;
}

export async function TrendingScroll({ category }: TrendingScrollProps) {
    const resolvedCategory = category ?? "game";
    const trending = await getPopularArticles(8, resolvedCategory);
    const categoryConfig = ARTICLE_CATEGORY_CONFIG[resolvedCategory];

    if (trending.length === 0) return null;

    return (
        <section className="bg-zinc-950/50 py-8">
            <div className="mx-auto max-w-[1920px] px-4 sm:px-6 lg:px-12 xl:px-16">
                <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className={`h-5 w-5 ${resolvedCategory === "ai" ? "text-cyan-300" : "text-orange-400"}`} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                        {categoryConfig.label} Trending
                    </h2>
                </div>

                <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16">
                    {trending.map((article) => (
                        <Link
                            key={article.id}
                            href={`/articles/${article.slug}`}
                            className="group flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all duration-300 hover:border-zinc-700 hover:shadow-lg hover:shadow-orange-500/5 sm:w-[280px]"
                        >
                            <div className="relative aspect-[16/10] overflow-hidden">
                                <Image
                                    src={article.image_url}
                                    alt={article.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    sizes="280px"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            </div>
                            <div className="flex flex-1 flex-col p-3">
                                <div className={`mb-2 inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold ${categoryConfig.chipClassName}`}>
                                    {categoryConfig.label}
                                </div>
                                <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-200 transition-colors group-hover:text-orange-400">
                                    {article.title}
                                </h3>
                                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                                    {article.tags.slice(0, 2).map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section >
    );
}
