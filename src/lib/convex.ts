import type { ContentListItem, ContentFull } from "../types/content";

const CONVEX_SITE_URL = import.meta.env.CONVEX_SITE_URL;

export async function getBlogList(): Promise<ContentListItem[]> {
  const res = await fetch(`${CONVEX_SITE_URL}/api/blog`);
  if (!res.ok) throw new Error(`/api/blog: ${res.status}`);
  return res.json();
}

export async function getBlogBySlug(
  slug: string
): Promise<ContentFull | null> {
  const res = await fetch(
    `${CONVEX_SITE_URL}/api/blog/${encodeURIComponent(slug)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`/api/blog/${slug}: ${res.status}`);
  return res.json();
}
