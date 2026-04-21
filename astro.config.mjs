// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { buildAlternateLinks, SITE } from "./src/lib/hreflang.ts";

const LANGS = ["EN", "FR", "ES", "DE"];

/** @type {Map<string, Array<{ lang: string; url: string }>> | undefined} */
let hreflangMap;

async function fetchHreflangMap() {
  const convex = process.env.CONVEX_SITE_URL;
  if (!convex) {
    console.warn("[hreflang] CONVEX_SITE_URL not set — skipping sitemap hreflang injection");
    return new Map();
  }

  const byGroup = new Map();
  for (const lang of LANGS) {
    const res = await fetch(`${convex}/api/blog?lang=${lang}`);
    if (!res.ok) throw new Error(`[hreflang] /api/blog?lang=${lang} failed: ${res.status}`);
    const items = await res.json();
    for (const it of items) {
      if (!it.translation_group_id) continue;
      if (!byGroup.has(it.translation_group_id)) byGroup.set(it.translation_group_id, []);
      byGroup.get(it.translation_group_id).push({ lang, slug: it.slug });
    }
  }

  const map = new Map();
  for (const siblings of byGroup.values()) {
    if (siblings.length < 2) continue;
    for (const self of siblings) {
      const others = siblings.filter((s) => s.slug !== self.slug);
      const links = buildAlternateLinks(self.lang, self.slug, others);
      const prefix = self.lang.toLowerCase() === "en" ? "" : `/${self.lang.toLowerCase()}`;
      const selfUrl = `${SITE}${prefix}/blog/${self.slug}`;
      map.set(selfUrl, links);
    }
  }
  console.log(`[hreflang] built map for ${map.size} URLs across ${byGroup.size} translation groups`);
  return map;
}

const hreflangIntegration = {
  name: "fetch-hreflang-map",
  hooks: {
    "astro:build:start": async () => {
      hreflangMap = await fetchHreflangMap();
    },
  },
};

export default defineConfig({
  site: "https://rentierdigital.xyz",
  trailingSlash: "never",
  build: {
    inlineStylesheets: "always",
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "es", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    hreflangIntegration,
    sitemap({
      filter: (page) => !page.includes("/test-avif"),
      serialize(item) {
        const links = hreflangMap?.get(item.url);
        if (links && links.length > 0) item.links = links;
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
