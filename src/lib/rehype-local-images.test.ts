import { describe, expect, test } from "bun:test";
import type { Element, Root } from "hast";
import { toLocalImagePath } from "./image-utils";
import { rehypeLocalImages } from "./rehype-local-images";

function renderImage(src: string, properties: Element["properties"] = {}): Element {
  const image: Element = {
    type: "element",
    tagName: "img",
    properties: { src, alt: "Fixture image", ...properties },
    children: [],
  };
  const tree: Root = { type: "root", children: [image] };

  rehypeLocalImages()(tree);

  return tree.children[0] as Element;
}

describe("toLocalImagePath", () => {
  test("keeps a remote URL when its generated local copy is missing", () => {
    const remote = "https://images.inforeole.example/never-copied.png";

    expect(toLocalImagePath(remote, "Missing fixture")).toBe(remote);
  });

  test("uses an existing local copy from a remote blog-images URL", () => {
    const filename = "a-diagram-showing-a-single-secret-e-g-stripe-secret-key-10bf21e9.png";

    expect(toLocalImagePath(`https://rentierdigital.xyz/blog-images/${filename}`))
      .toBe(`/blog-images/${filename}`);
  });

  test("keeps a remote blog-images URL when that local file is missing", () => {
    const remote = "https://rentierdigital.xyz/blog-images/not-published-here.png";

    expect(toLocalImagePath(remote)).toBe(remote);
  });

  test("keeps a local blog-images path unchanged", () => {
    const local = "/blog-images/content-provided.png";

    expect(toLocalImagePath(local)).toBe(local);
  });
});

describe("rehypeLocalImages", () => {
  test("keeps missing remote GIF and PNG originals as images", () => {
    const gif = "https://images.inforeole.example/cta-never-copied.gif";
    const png = "https://images.inforeole.example/architecture-never-copied.png";

    const renderedGif = renderImage(gif, { alt: "Animated CTA", loading: "lazy" });
    const renderedPng = renderImage(png, { alt: "Architecture" });

    expect(renderedGif.tagName).toBe("img");
    expect(renderedGif.properties.src).toBe(gif);
    expect(renderedGif.properties.alt).toBe("Animated CTA");
    expect(renderedGif.properties.loading).toBe("lazy");
    expect(renderedPng.tagName).toBe("img");
    expect(renderedPng.properties.src).toBe(png);
  });

  test("keeps an available local original without AVIF as an image", () => {
    const filename = "a-diagram-showing-a-single-secret-e-g-stripe-secret-key-10bf21e9.png";
    const rendered = renderImage(`https://rentierdigital.xyz/blog-images/${filename}`);

    expect(rendered.tagName).toBe("img");
    expect(rendered.properties.src).toBe(`/blog-images/${filename}`);
  });

  test("emits only existing AVIF candidates for an available original", () => {
    const filename = "claude-code-memory-coding-habits-f9ca4bfc.png";
    const base = filename.replace(/\.png$/, "");
    const rendered = renderImage(`https://rentierdigital.xyz/blog-images/${filename}`);

    expect(rendered.tagName).toBe("picture");
    const source = rendered.children[0] as Element;
    const image = rendered.children[1] as Element;
    expect(source.properties.srcSet).toBe(
      `/blog-images/${base}-480w.avif 480w, /blog-images/${base}.avif 768w`,
    );
    expect(image.properties.src).toBe(`/blog-images/${filename}`);
    expect(image.properties.alt).toBe("Fixture image");
    expect(image.properties.loading).toBe("eager");
  });

  test("does not rewrite content-provided local paths", () => {
    const local = "/blog-images/content-provided.png";
    const rendered = renderImage(local, { loading: "lazy" });

    expect(rendered.tagName).toBe("img");
    expect(rendered.properties).toEqual({
      src: local,
      alt: "Fixture image",
      loading: "lazy",
    });
  });

  test("keeps the link around a rewritten image", () => {
    const filename = "claude-code-memory-coding-habits-f9ca4bfc.png";
    const image: Element = {
      type: "element",
      tagName: "img",
      properties: { src: `https://rentierdigital.xyz/blog-images/${filename}`, alt: "Linked image" },
      children: [],
    };
    const link: Element = {
      type: "element",
      tagName: "a",
      properties: { href: "https://example.com/destination" },
      children: [image],
    };
    const tree: Root = { type: "root", children: [link] };

    rehypeLocalImages()(tree);

    expect((tree.children[0] as Element).tagName).toBe("a");
    expect((tree.children[0] as Element).properties.href).toBe("https://example.com/destination");
    expect(((tree.children[0] as Element).children[0] as Element).tagName).toBe("picture");
  });
});
