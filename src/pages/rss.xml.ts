import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getBlogList } from "../lib/convex";

export async function GET(context: APIContext) {
  const articles = await getBlogList();
  articles.sort(
    (a, b) =>
      new Date(b.published_date ?? 0).getTime() -
      new Date(a.published_date ?? 0).getTime()
  );

  return rss({
    title: "Rentier Digital",
    description:
      "Tools, methods, and guides to ship real products with AI.",
    site: context.site!,
    items: articles.map((article) => ({
      title: article.title,
      pubDate: article.published_date
        ? new Date(article.published_date)
        : undefined,
      description: article.hook_first_lines ?? "",
      link: `/blog/${article.slug}`,
    })),
  });
}
