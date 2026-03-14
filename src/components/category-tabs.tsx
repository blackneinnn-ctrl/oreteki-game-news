import Link from "next/link";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_CONFIG, type ArticleCategory } from "@/lib/article-taxonomy";

interface CategoryTabsProps {
  activeCategory: ArticleCategory;
}

export function CategoryTabs({ activeCategory }: CategoryTabsProps) {
  return (
    <div className="mb-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
      {ARTICLE_CATEGORIES.map((category) => {
        const config = ARTICLE_CATEGORY_CONFIG[category];
        const isActive = category === activeCategory;

        return (
          <Link
            key={category}
            href={config.href}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "bg-white text-zinc-950 shadow-lg"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {config.label}
          </Link>
        );
      })}
    </div>
  );
}
