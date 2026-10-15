import { visit, SKIP } from "unist-util-visit";
import { h } from "hastscript";
import { localImageExists, toLocalImagePath } from "./image-utils";
import type { Root, Element, Parent } from "hast";

function imageExtension(src: string): string | undefined {
  try {
    const pathname = src.startsWith("http") ? new URL(src).pathname : src;
    return pathname.match(/\.([^.\/]+)$/)?.[1].toLowerCase();
  } catch {
    return undefined;
  }
}

export function rehypeLocalImages() {
  return (tree: Root) => {
    let isFirstImage = true;

    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== "img") return;
      if (index === undefined || !parent) return;

      const src = node.properties?.src;
      if (typeof src !== "string" || !src.startsWith("http")) return;

      // Alt fallback
      const alt = (typeof node.properties?.alt === "string" && node.properties.alt.trim() !== "")
        ? node.properties.alt
        : "Illustration";

      // First image = LCP candidate: eager load, high priority
      const loading = typeof node.properties.loading === "string"
        ? node.properties.loading
        : isFirstImage ? "eager" : "lazy";
      const extraProps = isFirstImage ? { fetchpriority: "high" } : {};
      isFirstImage = false;

      const resolvedSrc = toLocalImagePath(src, alt);
      const filename = resolvedSrc.startsWith("/blog-images/")
        ? resolvedSrc.split("/").pop() || ""
        : "";
      const ext = imageExtension(resolvedSrc);

      node.properties.src = resolvedSrc;
      node.properties.alt = alt;
      node.properties.loading = loading;
      node.properties.decoding = "async";
      Object.assign(node.properties, extraProps);
      if (!node.properties.width) node.properties.width = "768";
      if (!node.properties.height) node.properties.height = "auto";
      node.properties.style = "width:100%;height:auto";

      // SVG/GIF: keep simple <img>, no <picture> wrapper
      if (ext === "svg" || ext === "gif") {
        return;
      }

      if (!filename) return;

      const base = filename.replace(/\.\w+$/, "");
      const avif768 = `/blog-images/${base}.avif`;
      const avif480 = `/blog-images/${base}-480w.avif`;
      const avifCandidates = [
        localImageExists(avif480) ? `${avif480} 480w` : undefined,
        localImageExists(avif768) ? `${avif768} 768w` : undefined,
      ].filter((candidate): candidate is string => candidate !== undefined);

      if (avifCandidates.length === 0) return;

      node.properties.sizes = "(max-width: 768px) 100vw, 662px";
      const pictureNode = h("picture", [
        h("source", {
          srcSet: avifCandidates.join(", "),
          type: "image/avif",
          sizes: "(max-width: 768px) 100vw, 662px",
        }),
        node,
      ]);

      parent.children[index] = pictureNode as unknown as Element;
      return SKIP;
    });
  };
}
