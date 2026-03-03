// synced from convex/schema.ts — contents table
export interface ContentListItem {
  _id: string;
  _creationTime: number;
  title: string;
  slug: string;
  hook_first_lines: string | null;
  lang: "EN" | "FR";
  type: string;
  themes: string[];
  tags: string[];
  published_date: string | null;
  word_count: number | null;
  read_time_minutes: number | null;
}

// synced from convex/schema.ts — contents table (full)
export interface ContentFull {
  _id: string;
  title: string;
  slug: string;
  content_markdown: string;
  hook_first_lines?: string;
  lang: "EN" | "FR";
  type: string;
  themes: string[];
  tags?: string[];
  status: "draft" | "ready" | "published" | "archived";
  published_date?: string;
  word_count?: number;
  read_time_minutes?: number;
  source_url?: string;
  // SEO fields (from seo rewrite pipeline)
  seo_meta_description?: string;
  seo_schema_jsonld?: string;
  seo_target_keyword?: string;
}
