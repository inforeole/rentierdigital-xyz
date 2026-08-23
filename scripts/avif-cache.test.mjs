import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import { convertBlogImages } from "./avif-cache.mjs";

const workspaces = [];

async function createFixture({ sources = ["alpha.png", "bravo.png"] } = {}) {
  const root = await mkdtemp(join(tmpdir(), "avif-cache-"));
  workspaces.push(root);
  const sourceDir = join(root, "public", "blog-images");
  const cacheDir = join(root, "node_modules", ".cache", "rentierdigital-avif", "v1");
  await mkdir(sourceDir, { recursive: true });
  await Promise.all(sources.map(async (sourceName, index) => {
    const image = sharp({ create: { width: 4 + index, height: 3, channels: 3, background: index ? "#0ea5e9" : "#e11d48" } });
    const output = join(sourceDir, sourceName);
    if (/\.jpe?g$/i.test(sourceName)) return image.jpeg().toFile(output);
    if (/\.webp$/i.test(sourceName)) return image.webp().toFile(output);
    return image.png().toFile(output);
  }));
  return { root, sourceDir, cacheDir };
}

function outputPath(sourceDir, name, width) {
  return join(sourceDir, name.replace(/\.[^.]+$/, width === 480 ? "-480w.avif" : ".avif"));
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("convertBlogImages", () => {
  test("converts a cold tiny PNG fixture into real AVIF variants", async () => {
    const { sourceDir, cacheDir } = await createFixture();

    const result = await convertBlogImages({ sourceDir, cacheDir });

    expect(result.encodedVariants).toBe(4);
    expect((await sharp(outputPath(sourceDir, "alpha.png", 768)).metadata()).format).toBe("heif");
    expect((await sharp(outputPath(sourceDir, "alpha.png", 480)).metadata()).format).toBe("heif");
  });

  test("uses a valid warm cache without encoding and restores deleted public outputs", async () => {
    const { sourceDir, cacheDir } = await createFixture();
    await convertBlogImages({ sourceDir, cacheDir });
    await unlink(outputPath(sourceDir, "alpha.png", 768));
    await unlink(outputPath(sourceDir, "alpha.png", 480));
    let encodes = 0;

    const result = await convertBlogImages({
      sourceDir,
      cacheDir,
      conversionSettings: {
        encoder: async ({ sourcePath, width, quality, outputPath: destination }) => {
          encodes++;
          await sharp(sourcePath).resize({ width, withoutEnlargement: true }).avif({ quality }).toFile(destination);
        },
      },
    });

    expect(encodes).toBe(0);
    expect(result.encodedVariants).toBe(0);
    await expect(stat(outputPath(sourceDir, "alpha.png", 768))).resolves.toBeDefined();
    await expect(stat(outputPath(sourceDir, "alpha.png", 480))).resolves.toBeDefined();
  });

  test("bootstraps pre-existing public variants byte-for-byte without encoding", async () => {
    const { sourceDir, cacheDir } = await createFixture({ sources: ["alpha.png"] });
    const desktop = outputPath(sourceDir, "alpha.png", 768);
    const mobile = outputPath(sourceDir, "alpha.png", 480);
    await sharp({ create: { width: 3, height: 2, channels: 3, background: "#a855f7" } }).avif({ quality: 57 }).toFile(desktop);
    await sharp({ create: { width: 2, height: 2, channels: 3, background: "#f59e0b" } }).avif({ quality: 31 }).toFile(mobile);
    const before = await Promise.all([readFile(desktop), readFile(mobile)]);
    let encodes = 0;

    const result = await convertBlogImages({
      sourceDir,
      cacheDir,
      conversionSettings: {
        encoder: async () => { encodes++; },
      },
    });

    expect(encodes).toBe(0);
    expect(result.encodedVariants).toBe(0);
    expect(await Promise.all([readFile(desktop), readFile(mobile)])).toEqual(before);
  });

  test("chooses PNG over WebP and JPEG when source basenames collide", async () => {
    const { sourceDir, cacheDir } = await createFixture({ sources: ["collision.jpg", "collision.webp", "collision.png"] });
    let encodes = 0;

    const result = await convertBlogImages({
      sourceDir,
      cacheDir,
      conversionSettings: {
        encoder: async ({ sourcePath, width, quality, outputPath: destination }) => {
          encodes++;
          await sharp(sourcePath).resize({ width, withoutEnlargement: true }).avif({ quality }).toFile(destination);
        },
      },
    });

    expect(encodes).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceName).toBe("collision.png");
    await expect(stat(outputPath(sourceDir, "collision.png", 768))).resolves.toBeDefined();
    await expect(stat(outputPath(sourceDir, "collision.png", 480))).resolves.toBeDefined();
  });

  test("invalidates only the source whose bytes or conversion settings change", async () => {
    const { sourceDir, cacheDir } = await createFixture();
    await convertBlogImages({ sourceDir, cacheDir });
    await sharp({ create: { width: 5, height: 4, channels: 3, background: "#22c55e" } })
      .png()
      .toFile(join(sourceDir, "alpha.png"));
    let encodes = 0;
    const encoder = async ({ sourcePath, width, quality, outputPath: destination }) => {
      encodes++;
      await sharp(sourcePath).resize({ width, withoutEnlargement: true }).avif({ quality }).toFile(destination);
    };

    const sourceChanged = await convertBlogImages({ sourceDir, cacheDir, conversionSettings: { encoder } });
    expect(encodes).toBe(2);
    expect(sourceChanged.encodedVariants).toBe(2);
    encodes = 0;
    const settingsChanged = await convertBlogImages({
      sourceDir,
      cacheDir,
      conversionSettings: { quality768: 41, encoder },
    });
    expect(encodes).toBe(4);
    expect(settingsChanged.encodedVariants).toBe(4);
  });

  test("repairs only a missing or corrupt cached variant", async () => {
    const { sourceDir, cacheDir } = await createFixture();
    const first = await convertBlogImages({ sourceDir, cacheDir });
    const alpha = first.items.find((item) => item.sourceName === "alpha.png");
    await unlink(join(alpha.cachePath, "480w.avif"));
    let encodes = 0;
    const encoder = async ({ sourcePath, width, quality, outputPath: destination }) => {
      encodes++;
      await sharp(sourcePath).resize({ width, withoutEnlargement: true }).avif({ quality }).toFile(destination);
    };

    const missing = await convertBlogImages({ sourceDir, cacheDir, conversionSettings: { encoder } });
    expect(encodes).toBe(1);
    expect(missing.encodedVariants).toBe(1);
    await writeFile(join(alpha.cachePath, "768w.avif"), "corrupt");
    encodes = 0;

    const corrupt = await convertBlogImages({ sourceDir, cacheDir, conversionSettings: { encoder } });
    expect(encodes).toBe(1);
    expect(corrupt.encodedVariants).toBe(1);
    expect(await readFile(join(alpha.cachePath, "768w.avif"))).not.toEqual(Buffer.from("corrupt"));
  });
});
