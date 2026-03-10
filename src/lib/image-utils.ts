import { createHash } from "node:crypto";

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

/**
 * Convert an external image URL to a local /blog-images/ path.
 * Uses the same naming as convex/astro.ts pushImagesToGitHub
 * and rehype-local-images.ts.
 */
export function toLocalImagePath(url: string, descriptor?: string): string {
  if (!url.startsWith("http")) return url;
  // Already rewritten to local blog-images URL by Convex publish — extract path
  const blogImagesMatch = url.match(/\/blog-images\/(.*)/);
  if (blogImagesMatch) return `/blog-images/${blogImagesMatch[1]}`;
  return `/blog-images/${imageFilename(url, descriptor)}`;
}
