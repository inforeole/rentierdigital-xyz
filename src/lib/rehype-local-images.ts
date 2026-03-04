import { visit } from "unist-util-visit";
import { createHash } from "node:crypto";
import type { Root, Element } from "hast";

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

export function rehypeLocalImages() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") return;

      const src = node.properties?.src;
      if (typeof src !== "string" || !src.startsWith("http")) return;

      // URL rewrite → local path
      const ext = getExtension(src);
      const hash = md5(src).slice(0, 12);
      node.properties.src = `/blog-images/${hash}.${ext}`;

      // Alt fallback
      if (!node.properties.alt || (typeof node.properties.alt === "string" && node.properties.alt.trim() === "")) {
        node.properties.alt = "Illustration";
      }

      // Lazy loading + async decoding + CLS prevention
      node.properties.loading = "lazy";
      node.properties.decoding = "async";
      if (!node.properties.width) node.properties.width = "768";
      if (!node.properties.height) node.properties.height = "432";
    });
  };
}
