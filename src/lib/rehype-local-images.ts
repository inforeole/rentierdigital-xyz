import { visit, SKIP } from "unist-util-visit";
import { h } from "hastscript";
import { imageFilename } from "./image-utils";
import type { Root, Element, Parent } from "hast";

export function rehypeLocalImages() {
  return (tree: Root) => {
    let isFirstImage = true;

    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== "img") return;
      if (index === undefined || !parent) return;

      const src = node.properties?.src;
      if (typeof src !== "string" || !src.startsWith("http")) return;
      // Already on blog-images CDN? Extract local path (don't re-hash)
      const isAlreadyLocal = src.includes("/blog-images/");

      // Alt fallback
      const alt = (typeof node.properties?.alt === "string" && node.properties.alt.trim() !== "")
        ? node.properties.alt
        : "Illustration";

      // First image = LCP candidate: eager load, high priority
      const loading = isFirstImage ? "eager" : "lazy";
      const extraProps = isFirstImage ? { fetchpriority: "high" } : {};
      isFirstImage = false;

      // Generate descriptive filename using alt text
      let localSrc: string;
      if (isAlreadyLocal) {
        const pathMatch = src.match(/\/blog-images\/(.*)/);
        localSrc = pathMatch ? `/blog-images/${pathMatch[1]}` : src;
      } else {
        localSrc = `/blog-images/${imageFilename(src, alt)}`;
      }
      const filename = localSrc.split("/").pop() || "";
      const ext = filename.split(".").pop()?.toLowerCase();

      // SVG/GIF: keep simple <img>, no <picture> wrapper
      if (ext === "svg" || ext === "gif") {
        node.properties.src = localSrc;
        node.properties.alt = alt;
        node.properties.loading = loading;
        node.properties.decoding = "async";
        Object.assign(node.properties, extraProps);
        if (!node.properties.width) node.properties.width = "768";
        if (!node.properties.height) node.properties.height = "auto";
        node.properties.style = "width:100%;height:auto";
        return;
      }

      // Other formats: wrap in <picture> with AVIF srcset (480w + 768w)
      const base = filename.replace(/\.\w+$/, "");
      const avif768 = `/blog-images/${base}.avif`;
      const avif480 = `/blog-images/${base}-480w.avif`;
      const pictureNode = h("picture", [
        h("source", {
          srcSet: `${avif480} 480w, ${avif768} 768w`,
          type: "image/avif",
          sizes: "(max-width: 768px) 100vw, 662px",
        }),
        h("img", {
          src: localSrc,
          alt,
          loading,
          decoding: "async",
          width: "768",
          height: "auto",
          sizes: "(max-width: 768px) 100vw, 662px",
          style: "width:100%;height:auto",
          ...extraProps,
        }),
      ]);

      parent.children[index] = pictureNode as unknown as Element;
      return SKIP;
    });
  };
}
