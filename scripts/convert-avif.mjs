import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const dir = "public/blog-images";

try {
  const files = await readdir(dir);
  const images = files.filter((f) =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  let converted = 0;
  for (const file of images) {
    const src = join(dir, file);
    const dest = join(dir, file.replace(/\.\w+$/, ".avif"));

    // Skip if AVIF already exists and is newer
    try {
      const srcStat = await stat(src);
      const destStat = await stat(dest);
      if (destStat.mtimeMs >= srcStat.mtimeMs) continue;
    } catch {
      // dest doesn't exist, convert
    }

    await sharp(src).resize({ width: 768, withoutEnlargement: true }).avif({ quality: 40 }).toFile(dest);
    converted++;
    console.log(`Converted: ${file} → ${file.replace(/\.\w+$/, ".avif")}`);
  }

  console.log(`Done: ${converted} converted, ${images.length - converted} skipped`);
} catch (e) {
  if (e.code === "ENOENT") {
    console.log("No blog-images directory, skipping AVIF conversion");
  } else {
    throw e;
  }
}
