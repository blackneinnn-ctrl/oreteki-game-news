import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, Flame } from "lucide-react";
import { getFeaturedArticles, getPublishedArticles } from "@/data/articles";
import { ARTICLE_CATEGORY_CONFIG, type ArticleCategory } from "@/lib/article-taxonomy";
import { ArticleCard } from "@/components/article-card";
import { CategoryTabs } from "@/components/category-tabs";
import { ScrollAnimate } from "@/components/scroll-animate";
import { Sidebar } from "@/components/sidebar";
import { TrendingScroll } from "@/components/trending-scroll";

interface CategoryLandingProps {
  category: ArticleCategory;
}

function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleDateString("ja-JP");
}

function isNewArticle(dateValue: string | null | undefined): boolean {
  if (!dateValue) return false;
  const publishedDate = new Date(dateValue);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return publishedDate > threeDaysAgo;
}

export async function CategoryLanding({ category }: CategoryLandingProps) {
  const config = ARTICLE_CATEGORY_CONFIG[category];
  const featured = await getFeaturedArticles(category);
  const allArticles = await getPublishedArticles(category);
  const feedArticles = allArticles.length > featured.length
    ? allArticles.filter((article) => !featured.some((feature) => feature.id === article.id))
    : allArticles;

  const secondaryGlowClassName = category === "ai"
    ? "bg-[radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.14),transparent_50%)]"
    : "bg-[radial-gradient(ellipse_at_bottom_right,rgba(220,38,38,0.1),transparent_50%)]";

  return (
    <>
      <section className="relative overflow-hidden bg-zinc-950">
        <div className={`absolute inset-0 ${config.glowClassName}`} />
        <div className={`absolute inset-0 ${secondaryGlowClassName}`} />

        <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 sm:py-12 lg:px-12 xl:px-16">
          <CategoryTabs activeCategory={category} />

          <div className="mb-10 max-w-3xl">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${config.chipClassName}`}>
              {config.heroEyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              {config.heroTitle}
            </h1>
            <p className="mt-4 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
              {config.heroDescription}
            </p>
          </div>

          {featured.length > 0 && (
            <div>
              <div className="mb-6 flex items-center gap-2">
                <Flame className={`h-5 w-5 ${category === "ai" ? "text-cyan-300" : "text-orange-400"}`} />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Featured
                </h2>
              </div>

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
                        <span className={`rounded-full px-2.5 py-1 font-semibold ${config.chipClassName}`}>
                          {config.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <time>{formatDate(featured[0].published_at ?? featured[0].created_at)}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

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
                            <span className={`rounded-full px-2 py-1 font-semibold ${config.chipClassName}`}>
                              {config.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <time>{formatDate(article.published_at ?? article.created_at)}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

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
                          <span className={`rounded-full px-2.5 py-1 font-semibold ${config.chipClassName}`}>
                            {config.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <time>{formatDate(featured[0].published_at ?? featured[0].created_at)}</time>
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
                            <time>{formatDate(article.published_at ?? article.created_at)}</time>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <TrendingScroll category={category} />

      <section className="mx-auto max-w-[1920px] px-4 py-10 sm:px-6 sm:py-14 lg:px-12 xl:px-16">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-8 lg:gap-16">
          <div className="max-w-6xl min-w-0 flex-1">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-1 rounded-full bg-gradient-to-b ${config.accentFrom} ${config.accentTo}`} />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {config.sectionTitle}
                </h2>
              </div>
              <Link
                href={config.rankingHref}
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  category === "ai"
                    ? "text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                    : "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                }`}
              >
                ランキング
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {feedArticles.map((article, index) => {
                const isFirst = index === 0;
                const articleDate = article.published_at ?? article.created_at;

                return (
                  <ScrollAnimate
                    key={article.id}
                    delay={index * 50}
                    className={isFirst ? "sm:col-span-2 xl:col-span-3" : ""}
                  >
                    {isFirst ? (
                      <Link
                        href={`/articles/${article.slug}`}
                        className="group relative flex h-[350px] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-zinc-900/50 sm:h-[400px]"
                      >
                        <Image
                          src={article.image_url}
                          alt={article.title}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width: 1024px) 100vw, 66vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent sm:via-black/40" />

                        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                          {isNewArticle(articleDate) && (
                            <span className="rounded-md bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                              New
                            </span>
                          )}
                          <span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${config.chipClassName}`}>
                            {config.label}
                          </span>
                          {article.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-8 md:w-2/3">
                          <h3 className="line-clamp-3 text-xl font-bold leading-snug text-white sm:text-2xl md:text-3xl">
                            {article.title}
                          </h3>
                          <p className="mt-3 hidden line-clamp-2 text-sm leading-relaxed text-zinc-300 sm:block sm:text-base">
                            {article.excerpt}
                          </p>
                          <div className="mt-4 flex items-center gap-1.5 text-zinc-400">
                            <Clock className="h-4 w-4" />
                            <time className="text-sm">{formatDate(articleDate)}</time>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="h-full">
                        <ArticleCard article={article} />
                      </div>
                    )}
                  </ScrollAnimate>
                );
              })}
            </div>

            {feedArticles.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-500 dark:text-zinc-400">{config.emptyMessage}</p>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 md:w-72 lg:w-80">
            <div className="sticky top-24">
              <Sidebar category={category} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
