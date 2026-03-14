import { CategoryLanding } from "@/components/category-landing";

export const revalidate = 0;

export default function Home() {
  return <CategoryLanding category="game" />;
}
