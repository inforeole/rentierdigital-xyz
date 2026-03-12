// synced from convex/schema.ts — contents table
export interface ContentListItem {
  _id: string;
  _creationTime: number;
  title: string;
  slug: string;
  hook_first_lines: string | null;
  lang: "EN" | "FR" | "ES" | "DE";
  type: string;
  tags: string[];
  published_date: string | null;
  word_count: number | null;
  read_time_minutes: number | null;
  translation_group_id?: string | null;
}

// synced from convex/schema.ts — contents table (full)
export interface ContentFull {
  _id: string;
  title: string;
  slug: string;
  content_markdown: string;
  hook_first_lines?: string;
  lang: "EN" | "FR" | "ES" | "DE";
  type: string;
  tags: string[];
  status: "draft" | "ready" | "published" | "archived";
  published_date?: string;
  word_count?: number;
  read_time_minutes?: number;
  source_url?: string;
  seo_meta_description?: string;
  seo_meta_title?: string;
  seo_schema_jsonld?: string;
  seo_target_keyword?: string;
  cover_image_url?: string;
  cover_image_alt?: string;
  translations?: { lang: string; slug: string; title: string }[];
}
