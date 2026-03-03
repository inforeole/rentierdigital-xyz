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

/**
 * Convert an external image URL to a local /blog-images/ path.
 * Uses the same md5 hash as convex/astro.ts pushImagesToGitHub
 * and rehype-local-images.ts.
 */
export function toLocalImagePath(url: string): string {
  if (!url.startsWith("http")) return url;
  const ext = getExtension(url);
  const hash = md5(url).slice(0, 12);
  return `/blog-images/${hash}.${ext}`;
}
