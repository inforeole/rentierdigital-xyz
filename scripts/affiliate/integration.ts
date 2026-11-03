import verifiedRegistry from "./verified-registry.json";
import type { AstroIntegration } from "astro";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { createTrackedAffiliateSiteConfig } from "./vendor/trackedAffiliateObfuscation";
import { buildTrackedAffiliateRuntime } from "./vendor/trackedAffiliateRuntime";
import { assertTrackedAffiliatePublicFiles, outputPathname, transformTrackedAffiliateDirectory } from "./vendor/trackedAffiliateIntegration";
import type { TrackedAffiliateRegistry, VerifiedAffiliate, DirectAffiliateEvidence } from "./vendor/trackedAffiliate";

export interface VerifiedRow {
  slug: string; name: string; lang?: string; url_redirection: string;
  token: string; campaignId: number; destinations: string[];
}
export interface RegistryResponse {
  version: 1; verified: VerifiedRow[]; unverified: {slug: string; reason: string}[];
}
const ORIGIN = "https://rentierdigital.xyz";
const OWN_SLUGS = new Set(["wizard", "vdl", "affiliation", "vibe-coding-for-real"]);
// Existing public placements preserved pending verification of publisher ownership.
export const DEFERRED = [
  {
    "pagePathname": "/blog/i-deployed-my-own-openclaw-ai-agent-in-4-minutes-it-now-runs-my-life-from-a-5-server",
    "href": "https://www.dpbolvw.net/click-100429498-12438672?url=https%3A%2F%2Fcontabo.com%2Fen%2Fopenclaw-hosting%2F",
    "count": 5
  },
  {
    "pagePathname": "/blog/openclaw-architecture-scaling-guide",
    "href": "https://www.dpbolvw.net/click-100429498-12438672?url=https%3A%2F%2Fcontabo.com%2Fen%2Fopenclaw-hosting%2F",
    "count": 3
  },
  {
    "pagePathname": "/blog/anthropic-just-killed-my-200-month-openclaw-setup-so-i-rebuilt-it-for-15",
    "href": "https://www.dpbolvw.net/click-100429498-12438672?url=https%3A%2F%2Fcontabo.com%2Fen%2Fopenclaw-hosting%2F",
    "count": 2
  }
] as const;
export const CONFIG = createTrackedAffiliateSiteConfig("rentierdigital.xyz");

export function createRegistry(response: RegistryResponse): TrackedAffiliateRegistry {
  const verifiedGoLinks: Record<string, VerifiedAffiliate> = {};
  const verifiedPathLinks: Record<string, VerifiedAffiliate> = {};
  const direct = new Map<string, DirectAffiliateEvidence>();
  for (const row of response.verified) {
    if (OWN_SLUGS.has(row.slug) || (row.lang && row.lang.toLowerCase() !== "en")) continue;
    const url = new URL(row.url_redirection);
    if (url.protocol !== "https:" || !["go.rentierdigital.xyz", "go.gozrk.com"].includes(url.hostname)
      || url.pathname !== `/${row.token}` || url.username || url.password || url.search || url.hash) throw new Error("Invalid verified Trackr URL");
    const label = {token: row.token, product: row.name, merchant: row.name, trackerOrigin: url.origin};
    verifiedGoLinks[row.token] = label;
    verifiedPathLinks[`/go/${row.slug}`] = label;
    for (const href of row.destinations) if (!direct.has(href)) direct.set(href, {...label, href, evidence: `Trackr campaign ${row.campaignId}`});
  }
  return {localGoRouteIsAffiliate: true, deferredUnverifiedLinks: DEFERRED, ordinaryLocalPaths: [...OWN_SLUGS].map(slug => `/go/${slug}`), siteOrigin: ORIGIN, trackerOrigin: "https://go.rentierdigital.xyz", locale: "en", verifiedGoLinks, verifiedVLinks: {}, verifiedPathLinks, directAffiliateLinks: [...direct.values()]};
}

export function assertSourceAffiliates(html: string, response: RegistryResponse, pathname = ""): void {
  const document = parse(html);
  for (const entry of DEFERRED) {
    const count = document.querySelectorAll("a[href]").filter(anchor => anchor.getAttribute("href") === entry.href).length;
    if (count && pathname.replace(/\/$/, "") === entry.pagePathname && count > entry.count) throw new Error("Deferred affiliate placement count increased");
  }
  const language = document.querySelector("html")?.getAttribute("lang")?.split("-")[0].toLowerCase() ?? "en";
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")!;
    let url: URL;
    try { url = new URL(href, ORIGIN); } catch { continue; }
    const slug = url.origin === ORIGIN ? url.pathname.match(/^\/go\/([^/]+)\/?$/)?.[1] : undefined;
    if (slug && OWN_SLUGS.has(slug)) continue;
    if (slug && response.unverified.some(row => row.slug === slug)) throw new Error(`Affiliate alias is not verified: ${slug}`);
    const row = response.verified.find(row => row.slug === slug || row.url_redirection === url.origin + url.pathname || row.destinations.some(dest => new URL(dest).href === url.href));
    if (!row) continue;
    if (OWN_SLUGS.has(row.slug)) continue;
    if (language !== "en" || (row.lang && row.lang.toLowerCase() !== language)) throw new Error(`Affiliate language mismatch: ${row.slug}`);
  }
}

export function loadRegistry(): RegistryResponse {
  const value: unknown = verifiedRegistry;
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
    || !("verified" in value) || !Array.isArray(value.verified)
    || !("unverified" in value) || !Array.isArray(value.unverified)) throw new Error("Invalid affiliate registry response");
  for (const row of value.verified) {
    if (!row || typeof row !== "object" || typeof row.slug !== "string" || typeof row.name !== "string"
      || typeof row.url_redirection !== "string" || typeof row.token !== "string" || typeof row.campaignId !== "number"
      || !Array.isArray(row.destinations) || !row.destinations.every((destination: unknown) => typeof destination === "string")
      || (row.lang !== undefined && typeof row.lang !== "string")) throw new Error("Invalid verified affiliate entry");
  }
  for (const row of value.unverified) if (!row || typeof row !== "object" || typeof row.slug !== "string" || typeof row.reason !== "string") throw new Error("Invalid unverified affiliate entry");
  return value as RegistryResponse;
}

async function htmlFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) result.push(path);
  }
  return result;
}

export function rentierTrackedAffiliateIntegration(): AstroIntegration {
  return {name: "rentier-tracked-affiliates", hooks: {
    "astro:build:done": async ({dir}) => {
      const response = loadRegistry();
      const registry = createRegistry(response);
      const root = fileURLToPath(dir);
      const files = await htmlFiles(root);
      for (const file of files) assertSourceAffiliates(await readFile(file, "utf8"), response, outputPathname(root, file));
      const runtimeSource = await buildTrackedAffiliateRuntime({config: CONFIG, cacheDirectory: fileURLToPath(new URL("../../.astro/affiliate", import.meta.url))});
      const result = await transformTrackedAffiliateDirectory({outputRoot: root, registry, config: CONFIG, runtimeSource});
      // L’attribution est initialisée dès la première page, avant consentement et sans décorer les liens ordinaires.
      for (const file of files) {
        const html = await readFile(file, "utf8");
        if (!parse(html).querySelector(`script[${CONFIG.runtimeAttribute}]`)) {
          if (!html.includes("</head>")) throw new Error(`Missing page head: ${outputPathname(root, file)}`);
          await writeFile(file, html.replace("</head>", `<script ${CONFIG.runtimeAttribute}>${runtimeSource}</script></head>`));
        }
      }
      await assertTrackedAffiliatePublicFiles(root, registry);
      console.info(`Affiliate build verified: ${result.controls} buttons on ${result.pages} pages`);
    },
  }};
}
