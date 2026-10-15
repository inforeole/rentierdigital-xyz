import type { ContentListItem, ContentFull } from "../types/content";

const CONVEX_SITE_URL = import.meta.env.CONVEX_SITE_URL;

export async function getBlogList(lang = "EN"): Promise<ContentListItem[]> {
  const res = await fetch(`${CONVEX_SITE_URL}/api/blog?lang=${lang}`);
  if (!res.ok) throw new Error(`/api/blog?lang=${lang}: ${res.status}`);
  return res.json();
}

export function getBlogBySlugPath(
  slug: string,
  lang?: string,
  revision?: string | number
): string {
  const params = new URLSearchParams();
  if (lang) params.set("lang", lang);
  if (revision !== undefined) params.set("revision", String(revision));
  const query = params.toString();
  return `/api/blog/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}

export async function getBlogBySlug(
  slug: string,
  lang?: string,
  revision?: string | number
): Promise<ContentFull | null> {
  const path = getBlogBySlugPath(slug, lang, revision);
  const res = await fetch(`${CONVEX_SITE_URL}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}
