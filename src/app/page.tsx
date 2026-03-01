import Link from "next/link";
import Image from "next/image";
import { Clock, ChevronRight, Flame } from "lucide-react";
import { getPublishedArticles, getFeaturedArticles } from "@/data/articles";
import { ArticleCard } from "@/components/article-card";
import { Sidebar } from "@/components/sidebar";

export const revalidate = 0; // 常に最新データを取得

export default async function Home() {
  const featured = await getFeaturedArticles();
  const allArticles = await getPublishedArticles();
  // 記事が少ない場合は注目記事もフィードに表示する
  const feedArticles = allArticles.length > featured.length
    ? allArticles.filter((a) => !featured.some((f) => f.id === a.id))
    : allArticles;

  return (
    <>
      {/* Hero Section */}
      {featured.length > 0 && (
        <section className="relative overflow-hidden bg-zinc-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,88,12,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(220,38,38,0.1),transparent_50%)]" />

          <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-12">
            <div className="mb-6 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                注目の記事
              </h2>
            </div>

            {/* 1件の場合: 全幅カード */}
            {featured.length === 1 && (
              <Link
                href={`/articles/${featured[0].slug}`}
                className="group relative block overflow-hidden rounded-2xl"
              >
                <div className="relative aspect-[21/9]">
                  <Image
                    src={featured[0].image_url}
                    alt={featured[0].title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    priority
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <h2 className="mt-3 text-xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
                      {featured[0].title}
                    </h2>
                    <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-zinc-300 sm:text-base">
                      {featured[0].excerpt}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                      <span>{featured[0].author}</span>
                      <span>·</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <time>{new Date(featured[0].published_at ?? featured[0].created_at).toLocaleDateString('ja-JP')}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* 2件の場合: 2カラム */}
            {featured.length === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                {featured.map((article) => (
                  <Link
                    key={article.id}
                    href={`/articles/${article.slug}`}
                    className="group relative overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={article.image_url}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                        <h2 className="mt-2 line-clamp-2 text-lg font-extrabold leading-tight text-white sm:text-xl">
                          {article.title}
                        </h2>
                        <p className="mt-1.5 line-clamp-2 text-sm text-zinc-300">
                          {article.excerpt}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                          <span>{article.author}</span>
                          <span>·</span>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <time>{new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP')}</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* 3件以上の場合: メイン+サブ2件 */}
            {featured.length >= 3 && (
              <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
                <Link
                  href={`/articles/${featured[0].slug}`}
                  className="group relative col-span-1 row-span-2 overflow-hidden rounded-2xl lg:col-span-2"
                >
                  <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full">
                    <Image
                      src={featured[0].image_url}
                      alt={featured[0].title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      priority
                      sizes="(max-width: 1024px) 100vw, 66vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                      <h2 className="mt-3 text-xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
                        {featured[0].title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-300 sm:text-base">
                        {featured[0].excerpt}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                        <span>{featured[0].author}</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <time>{new Date(featured[0].published_at ?? featured[0].created_at).toLocaleDateString('ja-JP')}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {featured.slice(1, 3).map((article) => (
                  <Link
                    key={article.id}
                    href={`/articles/${article.slug}`}
                    className="group relative overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={article.image_url}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 1024px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white sm:text-base">
                          {article.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                          <Clock className="h-3 w-3" />
                          <time>{new Date(article.published_at ?? article.created_at).toLocaleDateString('ja-JP')}</time>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Content + Sidebar */}
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-10 lg:flex-row">
          <div className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-orange-500 to-red-500" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  最新記事
                </h2>
              </div>
              <Link
                href="/ranking"
                className="flex items-center gap-1 text-sm font-medium text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
              >
                ランキング
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {feedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            {feedArticles.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-500 dark:text-zinc-400">まだ記事がありません</p>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 lg:w-80">
            <Sidebar />
          </div>
        </div>
      </section>
    </>
  );
}
