import { parse } from "node-html-parser";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  transformTrackedAffiliateHtml,
  transformTrackedAffiliateFeedFragment,
  type TrackedAffiliateRegistry,
} from "./trackedAffiliate";
import type { TrackedAffiliateSiteConfig } from "./trackedAffiliateObfuscation";
import { buildTrackedAffiliateRuntime } from "./trackedAffiliateRuntime";

interface BuildDoneHookContext {
  readonly dir: URL;
}

interface AstroIntegrationLike {
  readonly name: string;
  readonly hooks: {
    readonly "astro:build:done": (context: BuildDoneHookContext) => void | Promise<void>;
  };
}

async function htmlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
    }
  }
  await walk(root);
  return files.sort();
}

async function xmlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".xml")) files.push(path);
    }
  }
  await walk(root);
  return files.sort();
}

export async function opaqueFeedEntries(xml: string, registry: TrackedAffiliateRegistry): Promise<{ xml: string; controls: number }> {
  const blockPattern = /<(item|entry)>[\s\S]*?<\/\1>/g;
  let output = "";
  let cursor = 0;
  let controls = 0;
  for (const match of xml.matchAll(blockPattern)) {
    const block = match[0];
    const index = match.index;
    const articleURL = block.match(/<link>\s*(?:<!\[CDATA\[\s*)?(https?:\/\/[^\s<\]]+)\s*(?:\]\]>\s*)?<\/link>/)?.[1]
      ?? block.match(/<link\s+href="(https?:\/\/[^"]+)"\s+rel="alternate"/)?.[1];
    if (!articleURL) continue;
    const content = block.match(/(<(?:content:encoded|content)\b[^>]*><!\[CDATA\[)([\s\S]*?)(\]\]><\/(?:content:encoded|content)>)/);
    if (!content || content.index === undefined) continue;
    const pathname = new URL(articleURL).pathname;
    const transformed = await transformTrackedAffiliateFeedFragment({ html: content[2] ?? "", pagePathname: pathname, registry });
    const updated = `${block.slice(0, content.index)}${content[1]}${transformed.html}${content[3]}${block.slice(content.index + content[0].length)}`;
    output += xml.slice(cursor, index) + updated;
    cursor = index + block.length;
    controls += transformed.count;
  }
  return { xml: output + xml.slice(cursor), controls };
}

export function outputPathname(outputRoot: string, file: string): string {
  const parts = relative(outputRoot, file).split(sep);
  if (parts[0] === "client") parts.shift();
  const relativeFile = parts.join("/");
  if (relativeFile === "index.html") return "/";
  if (relativeFile.endsWith("/index.html")) {
    return `/${relativeFile.slice(0, -"index.html".length)}`;
  }
  return `/${relativeFile}`;
}

export function containsClearAffiliateValue(source: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (value.startsWith("/")) return new RegExp(`${escaped}(?=$|[/?#\"'<>\\s&])`).test(source);
  if (/^[A-Za-z0-9_-]+$/.test(value)) return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}($|[^A-Za-z0-9_-])`).test(source);
  return source.includes(value);
}

/** Les reports autorisés masquent uniquement le href de l'ancre, jamais son texte ou un script. */
export function maskDeferredAffiliateHrefs(html: string, pathname: string, registry: TrackedAffiliateRegistry): string {
  const allowed = new Set((registry.deferredUnverifiedLinks ?? [])
    .filter(entry => entry.pagePathname === pathname).map(entry => entry.href));
  if (allowed.size === 0) return html;
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<!--[\s\S]*?-->|<a\b[^>]*>/gi, tag => {
    if (!/^<a\b/i.test(tag)) return tag;
    const anchor = parse(`${tag}</a>`).querySelector("a");
    const href = anchor?.getAttribute("href");
    if (!anchor || !href || !allowed.has(href)) return tag;
    anchor.removeAttribute("href");
    return anchor.toString().replace(/<\/a>$/, "");
  });
}

export async function assertTrackedAffiliatePublicFiles(publicRoot: string, registry: TrackedAffiliateRegistry): Promise<void> {
  const forbidden = [new URL(registry.trackerOrigin).host,
    ...Object.values(registry.verifiedGoLinks).flatMap(label => label.trackerOrigin ? [new URL(label.trackerOrigin).host] : []),
    ...Object.keys(registry.verifiedGoLinks),
    ...Object.keys(registry.verifiedVLinks).map(slug => `/v/${slug}`),
    ...Object.values(registry.verifiedVLinks).map(link => link.token),
    ...(registry.directAffiliateLinks ?? []).flatMap(link => [link.href, ...(link.token ? [link.token] : [])]),
  ].filter(Boolean);
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(?:html|xml|json|js|mjs|css|map)$/.test(entry.name)) {
        const source = await readFile(path, "utf8");
        const text = entry.name.endsWith(".html")
          ? maskDeferredAffiliateHrefs(source, outputPathname(publicRoot, path), registry) : source;
        if (forbidden.some(value => containsClearAffiliateValue(text, value))) throw new Error(`tracked affiliates: destination, jeton ou clé en clair dans ${path}`);
      }
    }
  }
  await walk(publicRoot);
}

export async function transformTrackedAffiliateDirectory(input: {
  outputRoot: string;
  registry: TrackedAffiliateRegistry;
  config: TrackedAffiliateSiteConfig;
  runtimeSource: string;
}): Promise<{ pages: number; controls: number }> {
  let pages = 0;
  let controls = 0;
  for (const file of await htmlFiles(input.outputRoot)) {
    const pathname = outputPathname(input.outputRoot, file);
    const before = await readFile(file, "utf8");
    const transformed = await transformTrackedAffiliateHtml({
      html: before,
      pagePathname: pathname,
      registry: input.registry,
      config: input.config,
      runtimeSource: input.runtimeSource,
    });
    await writeFile(file, transformed.html, "utf8");
    if (transformed.report.transformedAffiliateCount === 0) continue;
    if (transformed.report.originalAffiliateCount < 1) {
      throw new Error(`tracked affiliates: ${pathname} a perdu ses liens affiliés`);
    }
    pages++;
    controls += transformed.report.transformedAffiliateCount;
  }
  for (const file of await xmlFiles(input.outputRoot)) {
    const before = await readFile(file, "utf8");
    const transformed = await opaqueFeedEntries(before, input.registry);
    if (transformed.controls > 0) await writeFile(file, transformed.xml, "utf8");
  }
  if (controls === 0) {
    throw new Error("tracked affiliates: aucun lien affilié confirmé trouvé dans le build resilientes.fr");
  }
  return { pages, controls };
}

export function trackedAffiliateIntegration(input: {
  readonly loadRegistry: () => Promise<TrackedAffiliateRegistry>;
  readonly config: TrackedAffiliateSiteConfig;
  readonly runtimeCacheDirectory: string;
}): AstroIntegrationLike {
  return {
    name: "pbn-tracked-affiliates",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const registry = await input.loadRegistry();
        const runtimeSource = await buildTrackedAffiliateRuntime({
          config: input.config,
          cacheDirectory: input.runtimeCacheDirectory,
        });
        const result = await transformTrackedAffiliateDirectory({
          outputRoot: fileURLToPath(dir),
          registry,
          config: input.config,
          runtimeSource,
        });
        await assertTrackedAffiliatePublicFiles(fileURLToPath(dir), registry);
        console.info(`tracked affiliates: ${result.controls} contrôles validés sur ${result.pages} pages`);
      },
    },
  };
}
