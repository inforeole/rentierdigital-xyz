import { visit, SKIP } from "unist-util-visit";
import { createHash } from "node:crypto";
import { h } from "hastscript";
import type { Root, Element, Parent } from "hast";

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
    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== "img") return;
      if (index === undefined || !parent) return;

      const src = node.properties?.src;
      if (typeof src !== "string" || !src.startsWith("http")) return;

      // URL rewrite → local path
      const ext = getExtension(src);
      const hash = md5(src).slice(0, 12);
      const localSrc = `/blog-images/${hash}.${ext}`;

      // Alt fallback
      const alt = (typeof node.properties.alt === "string" && node.properties.alt.trim() !== "")
        ? node.properties.alt
        : "Illustration";

      // SVG/GIF: keep simple <img>, no <picture> wrapper
      if (ext === "svg" || ext === "gif") {
        node.properties.src = localSrc;
        node.properties.alt = alt;
        node.properties.loading = "lazy";
        node.properties.decoding = "async";
        if (!node.properties.width) node.properties.width = "768";
        if (!node.properties.height) node.properties.height = "432";
        return;
      }

      // Other formats: wrap in <picture> with AVIF source
      const avifSrc = `/blog-images/${hash}.avif`;
      const pictureNode = h("picture", [
        h("source", { srcSet: avifSrc, type: "image/avif" }),
        h("img", {
          src: localSrc,
          alt,
          loading: "lazy",
          decoding: "async",
          width: "768",
          height: "432",
        }),
      ]);

      parent.children[index] = pictureNode as unknown as Element;
      return SKIP;
    });
  };
}
