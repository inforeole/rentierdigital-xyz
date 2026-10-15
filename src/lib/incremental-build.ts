import type { ContentListItem } from "../types/content";

type ArticleRevision = Pick<ContentListItem, "_creationTime" | "updated_at">;
type RelatedCard = Pick<ContentListItem, "slug" | "title" | "hook_first_lines">;

export function buildArticleCacheKey(
  article: ArticleRevision,
  related: RelatedCard[]
): string {
  return JSON.stringify({
    revision: article.updated_at ?? article._creationTime,
    related: related.map(({ slug, title, hook_first_lines }) => ({
      slug,
      title,
      hook_first_lines,
    })),
  });
}
