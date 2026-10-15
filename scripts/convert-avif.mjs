import { convertBlogImages } from "./avif-cache.mjs";

const sourceDir = "public/blog-images";
const cacheDir = "node_modules/.cache/rentierdigital-avif/v1";

try {
  const result = await convertBlogImages({ sourceDir, cacheDir });
  console.log(`Done: ${result.encodedVariants} variants encoded, ${result.cacheHits} cache hits`);
} catch (e) {
  if (e.code === "ENOENT") {
    console.log("No blog-images directory, skipping AVIF conversion");
  } else {
    throw e;
  }
}
