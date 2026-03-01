import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeShiftHeading from "rehype-shift-heading";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { rehypeLocalImages } from "./rehype-local-images";

export async function renderMarkdown(md: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeShiftHeading, { shift: -1 })
    .use(rehypeLocalImages)
    .use(rehypeShiki, { theme: "github-dark" })
    .use(rehypeStringify)
    .process(md);
  return String(result);
}
