import sharp from "sharp";
import { readdir, stat, rename } from "node:fs/promises";
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

    // Skip if AVIF already exists. mtime check unreliable on CI (git clone
    // doesn't preserve mtimes — files get extraction-order timestamps).
    try {
      await stat(dest);
      continue;
    } catch {
      // dest doesn't exist, convert
    }

    // Resize source to 768w max (in-place) — no point shipping a 4000px fallback
    const meta = await sharp(src).metadata();
    if (meta.width && meta.width > 768) {
      await sharp(src).resize({ width: 768, withoutEnlargement: true }).toFile(src + ".tmp");
      await rename(src + ".tmp", src);
    }

    // Full size (768w)
    await sharp(src).resize({ width: 768, withoutEnlargement: true }).avif({ quality: 40 }).toFile(dest);
    // Mobile size (480w)
    const mobileDest = join(dir, file.replace(/\.\w+$/, "-480w.avif"));
    await sharp(src).resize({ width: 480, withoutEnlargement: true }).avif({ quality: 35 }).toFile(mobileDest);
    converted++;
    console.log(`Converted: ${file} → ${file.replace(/\.\w+$/, ".avif")} + 480w + source resized`);
  }

  console.log(`Done: ${converted} converted, ${images.length - converted} skipped`);
} catch (e) {
  if (e.code === "ENOENT") {
    console.log("No blog-images directory, skipping AVIF conversion");
  } else {
    throw e;
  }
}
