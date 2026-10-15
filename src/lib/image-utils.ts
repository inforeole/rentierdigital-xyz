import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { resolve, sep } from "node:path";

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(\w+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) {
        return ext;
      }
    }
  } catch {
    // invalid URL
  }
  return "jpg";
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Generate a descriptive image filename from URL + optional descriptor.
 * Format: {slugified-descriptor}-{hash8}.{ext}
 * Fallback (no descriptor): {hash12}.{ext}
 *
 * Must match the logic in convex/astro.ts and rehype-local-images.ts.
 */
export function imageFilename(url: string, descriptor?: string): string {
  const ext = getExtension(url);
  const hash = md5(url).slice(0, 8);
  if (descriptor && descriptor.trim()) {
    const slug = slugify(descriptor);
    if (slug) return `${slug}-${hash}.${ext}`;
  }
  return `${hash}.${ext}`;
}

/** Return whether a public /blog-images/ URL has a matching file on disk. */
export function localImageExists(path: string): boolean {
  if (!path.startsWith("/blog-images/")) return false;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(path.slice("/blog-images/".length));
  } catch {
    return false;
  }

  const imagesDirectory = resolve(process.cwd(), "public/blog-images");
  const imagePath = resolve(imagesDirectory, relativePath);
  if (!imagePath.startsWith(`${imagesDirectory}${sep}`)) return false;

  try {
    return statSync(imagePath).isFile();
  } catch {
    return false;
  }
}

function blogImagePath(url: string): string | undefined {
  try {
    const match = new URL(url).pathname.match(/\/blog-images\/(.+)$/);
    if (!match) return undefined;

    return `/blog-images/${match[1]}`;
  } catch {
    return undefined;
  }
}

/**
 * Convert an external image URL to a local /blog-images/ path.
 * Uses the same naming as convex/astro.ts pushImagesToGitHub
 * and rehype-local-images.ts.
 */
export function toLocalImagePath(url: string, descriptor?: string): string {
  if (!url.startsWith("http")) return url;

  const publishedPath = blogImagePath(url);
  if (publishedPath) return localImageExists(publishedPath) ? publishedPath : url;

  const generatedPath = `/blog-images/${imageFilename(url, descriptor)}`;
  return localImageExists(generatedPath) ? generatedPath : url;
}
