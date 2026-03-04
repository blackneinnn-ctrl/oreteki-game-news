import Link from "next/link";
import Image from "next/image";
import { Clock, Sparkles } from "lucide-react";
import { getRelatedArticles } from "@/data/articles";

interface RelatedArticlesProps {
    currentId: string;
    tags: string[];
}

export async function RelatedArticles({ currentId, tags }: RelatedArticlesProps) {
    const related = await getRelatedArticles(currentId, tags, 4);

    if (related.length === 0) return null;

    return (
        <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <div className="mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                    あわせて読みたい
                </h2>
            </div>

            <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                {related.map((article) => {
                    const date = new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP');
                    return (
                        <Link
                            key={article.id}
                            href={`/articles/${article.slug}`}
                            className="group flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:w-auto"
                        >
                            <div className="relative aspect-video overflow-hidden">
                                <Image
                                    src={article.image_url}
                                    alt={article.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    sizes="(max-width: 640px) 220px, (max-width: 1024px) 50vw, 25vw"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                            <div className="flex flex-1 flex-col p-3">
                                <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-800 transition-colors group-hover:text-orange-600 dark:text-zinc-200 dark:group-hover:text-orange-400">
                                    {article.title}
                                </h3>
                                <div className="mt-auto flex items-center gap-1 pt-2 text-xs text-zinc-400">
                                    <Clock className="h-3 w-3" />
                                    <time>{date}</time>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
