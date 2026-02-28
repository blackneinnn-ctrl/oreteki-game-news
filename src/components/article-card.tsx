import Link from "next/link";
import Image from "next/image";
import { Clock, Eye } from "lucide-react";
import type { Article } from "@/data/articles";

export function ArticleCard({ article }: { article: Article }) {
    return (
        <Link
            href={`/articles/${article.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-zinc-900/50"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
                <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-3 text-sm font-bold leading-relaxed text-zinc-800 transition-colors group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400 sm:text-base">
                    {article.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {article.excerpt}
                </p>
                <div className="mt-auto flex items-center gap-3 pt-3">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {article.author}
                    </span>
                    <div className="flex items-center gap-1 text-zinc-400">
                        <Clock className="h-3 w-3" />
                        <time className="text-xs">{article.publishedAt}</time>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-zinc-400">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">{(article.views / 1000).toFixed(0)}K</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
