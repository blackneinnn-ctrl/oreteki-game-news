import type { Metadata } from "next";
import { CategoryLanding } from "@/components/category-landing";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "AIニュース",
  description: "AI関連の最新ニュース、公式発表、リサーチ記事をまとめて追えるAIカテゴリページです。",
};

export default function AIPage() {
  return <CategoryLanding category="ai" />;
}
