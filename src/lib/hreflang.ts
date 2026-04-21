export type AlternateLink = { lang: string; url: string };
export type TranslationRef = { lang: string; slug: string; title?: string };

export const SITE = "https://rentierdigital.xyz";

export function buildAlternateLinks(
  currentLang: string,
  currentSlug: string,
  translations: TranslationRef[],
): AlternateLink[] {
  const all: TranslationRef[] = [
    { lang: currentLang, slug: currentSlug },
    ...translations,
  ];
  const seen = new Set<string>();
  const links: AlternateLink[] = [];
  for (const t of all) {
    const lang = t.lang.toLowerCase();
    if (seen.has(lang)) continue;
    seen.add(lang);
    const prefix = lang === "en" ? "" : `/${lang}`;
    links.push({ lang, url: `${SITE}${prefix}/blog/${t.slug}` });
  }
  const en = links.find((l) => l.lang === "en");
  if (en) links.push({ lang: "x-default", url: en.url });
  return links;
}
