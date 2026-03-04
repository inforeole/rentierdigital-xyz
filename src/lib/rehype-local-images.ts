import { visit, SKIP } from "unist-util-visit";
import { h } from "hastscript";
import { imageFilename } from "./image-utils";
import type { Root, Element, Parent } from "hast";

export function rehypeLocalImages() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== "img") return;
      if (index === undefined || !parent) return;

      const src = node.properties?.src;
      if (typeof src !== "string" || !src.startsWith("http")) return;

      // Alt fallback
      const alt = (typeof node.properties.alt === "string" && node.properties.alt.trim() !== "")
        ? node.properties.alt
        : "Illustration";

      // Generate descriptive filename using alt text
      const filename = imageFilename(src, alt);
      const localSrc = `/blog-images/${filename}`;
      const ext = filename.split(".").pop()?.toLowerCase();

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
      const avifSrc = `/blog-images/${filename.replace(/\.\w+$/, ".avif")}`;
      const pictureNode = h("picture", [
        h("source", { srcSet: avifSrc, type: "image/avif", sizes: "(max-width: 768px) 100vw, 662px" }),
        h("img", {
          src: localSrc,
          alt,
          loading: "lazy",
          decoding: "async",
          width: "768",
          height: "432",
          sizes: "(max-width: 768px) 100vw, 662px",
        }),
      ]);

      parent.children[index] = pictureNode as unknown as Element;
      return SKIP;
    });
  };
}
