import { parse } from "node-html-parser";

/** Medium's importer needs a plain image rather than responsive picture sources. */
export function mediumImportImages(html: string, canonical: string): string {
  const root = parse(html);
  for (const image of root.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (!src) continue;
    const url = new URL(src, canonical);
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    image.setAttribute("src", url.href);
    for (const name of ["srcset", "sizes", "loading", "decoding", "fetchpriority", "style", "height", "width"]) image.removeAttribute(name);
    const picture = image.closest("picture");
    if (picture) picture.replaceWith(image);
    if (image.closest("figure")) continue;
    const outer = image.parentNode?.tagName === "A" ? image.parentNode : image;
    const p = outer.parentNode;
    const figure = "<figure>" + outer.toString() + "</figure>";
    if (p?.tagName === "P" && p.innerHTML.trim() === outer.toString()) p.replaceWith(figure);
    else if (p?.tagName !== "P") outer.replaceWith(figure);
  }
  return root.toString();
}
