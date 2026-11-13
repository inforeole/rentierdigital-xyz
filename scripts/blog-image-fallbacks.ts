import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const FALLBACK_SUFFIX = "-fb.jpg";
export const FALLBACK_CONCURRENCY = 4;
export const FALLBACK_SETTINGS = {
  width: 1200,
  background: "#ffffff",
  jpeg: { quality: 80, mozjpeg: true },
} as const;

// Dans node_modules/.cache pour que le cache de build de Vercel conserve les JPEG d'un build à l'autre.
export const FALLBACK_CACHE_DIR = join(ROOT, "node_modules", ".cache", "blog-image-fallbacks", "v1");

const TEXT_EXTENSIONS = new Set([".html", ".xml", ".json", ".txt", ".webmanifest"]);
const BLOG_PNG_REF = /\/blog-images\/([^\s"'<>()\\,;?#]+)\.png(?![A-Za-z0-9])/gi;

export type Encoder = (source: Uint8Array) => Promise<Uint8Array>;

export interface BlogImageFallbackOptions {
  distDir: string;
  cacheDir?: string;
  encode?: Encoder;
}

export interface BlogImageFallbackResult {
  converted: number;
  fromCache: number;
  bytesBefore: number;
  bytesAfter: number;
  rewrittenFiles: number;
}

export const encodeFallback: Encoder = (source) =>
  sharp(source)
    .resize({ width: FALLBACK_SETTINGS.width, withoutEnlargement: true })
    .flatten({ background: FALLBACK_SETTINGS.background })
    .jpeg(FALLBACK_SETTINGS.jpeg)
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

function cacheKey(source: Uint8Array): string {
  return createHash("sha256")
    .update(source)
    .update(JSON.stringify(FALLBACK_SETTINGS))
    .update(sharp.versions.sharp)
    .digest("hex");
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function listTextFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listTextFiles(path);
      return entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) ? [path] : [];
    }),
  );
  return nested.flat();
}

async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await task(item);
    }
  });
  await Promise.all(workers);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Remplace les références PNG des bases converties ; `bases` contient les noms de fichier sans extension. */
export function rewriteReferences(text: string, bases: ReadonlySet<string>): string {
  return text.replace(BLOG_PNG_REF, (match, base: string) =>
    bases.has(base) || bases.has(safeDecode(base)) ? `/blog-images/${base}${FALLBACK_SUFFIX}` : match,
  );
}

function remainingReferences(text: string, bases: ReadonlySet<string>): string[] {
  return [...text.matchAll(BLOG_PNG_REF)]
    .filter((m) => bases.has(m[1] as string) || bases.has(safeDecode(m[1] as string)))
    .map((m) => m[0]);
}

/** Convertit les PNG de dist/blog-images en JPEG `-fb.jpg`, réécrit les références et supprime les PNG. */
export async function convertBlogImageFallbacks(options: BlogImageFallbackOptions): Promise<BlogImageFallbackResult> {
  const imagesDir = join(options.distDir, "blog-images");
  const cacheDir = options.cacheDir ?? FALLBACK_CACHE_DIR;
  const encode = options.encode ?? encodeFallback;
  const result: BlogImageFallbackResult = { converted: 0, fromCache: 0, bytesBefore: 0, bytesAfter: 0, rewrittenFiles: 0 };

  if (!(await exists(imagesDir))) return result;
  const pngs = (await readdir(imagesDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry) => entry.name);
  const bases = new Set(pngs.map((name) => name.slice(0, -4)));

  for (const base of bases) {
    const target = join(imagesDir, `${base}${FALLBACK_SUFFIX}`);
    if (await exists(target)) throw new Error(`Collision : ${target} existe déjà et ne vient pas de blog-image-fallbacks`);
  }

  await mkdir(cacheDir, { recursive: true });
  await runPool(pngs, FALLBACK_CONCURRENCY, async (name) => {
    const base = name.slice(0, -4);
    const source = new Uint8Array(await readFile(join(imagesDir, name)));
    const cached = join(cacheDir, `${cacheKey(source)}.jpg`);
    const target = join(imagesDir, `${base}${FALLBACK_SUFFIX}`);
    if (await exists(cached)) {
      result.fromCache += 1;
      await copyFile(cached, target);
    } else {
      const jpeg = await encode(source);
      const tmp = `${cached}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, jpeg);
      await rename(tmp, cached);
      await copyFile(cached, target);
    }
    result.converted += 1;
    result.bytesBefore += source.length;
    result.bytesAfter += (await stat(target)).size;
  });

  const files = await listTextFiles(options.distDir);
  const leftovers: string[] = [];
  await runPool(files, 16, async (file) => {
    const text = await readFile(file, "utf8");
    const next = rewriteReferences(text, bases);
    if (next !== text) {
      await writeFile(file, next);
      result.rewrittenFiles += 1;
    }
    for (const ref of remainingReferences(next, bases)) leftovers.push(`${file} : ${ref}`);
  });
  if (leftovers.length > 0) {
    throw new Error(`Références PNG restantes vers des images converties :\n${leftovers.join("\n")}`);
  }

  await Promise.all(pngs.map((name) => rm(join(imagesDir, name))));
  return result;
}

export function formatSummary(r: BlogImageFallbackResult): string {
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  return `${r.converted} PNG convertis (${r.fromCache} depuis le cache), ${mb(r.bytesBefore)} Mo -> ${mb(r.bytesAfter)} Mo, ${r.rewrittenFiles} fichiers réécrits`;
}

if (import.meta.main) {
  try {
    console.log(formatSummary(await convertBlogImageFallbacks({ distDir: join(ROOT, "dist") })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
