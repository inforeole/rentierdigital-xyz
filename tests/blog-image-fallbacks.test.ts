import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { convertBlogImageFallbacks, encodeFallback } from "../scripts/blog-image-fallbacks";

const directories: string[] = [];

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

async function png(width: number, height: number, alpha = 1): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 30, alpha } } }).png().toBuffer());
}

async function fixture(): Promise<{ root: string; dist: string; cache: string; images: string }> {
  const root = await mkdtemp(join(tmpdir(), "rd-fallbacks-"));
  directories.push(root);
  const dist = join(root, "dist");
  const images = join(dist, "blog-images");
  await mkdir(join(dist, "blog", "a"), { recursive: true });
  await mkdir(images, { recursive: true });
  await writeFile(join(images, "photo-1234abcd.png"), await png(1600, 900));
  await writeFile(join(images, "small-aaaa1111.png"), await png(100, 50, 0.5));
  await writeFile(join(images, "weird.png'"), "pas une image");
  await writeFile(
    join(dist, "blog", "a", "index.html"),
    [
      `<meta property="og:image" content="https://rentierdigital.xyz/blog-images/photo-1234abcd.png">`,
      `<picture><img src="/blog-images/photo-1234abcd.png"></picture>`,
      `<script type="application/ld+json">{"image":"https://rentierdigital.xyz/blog-images/small-aaaa1111.png"}</script>`,
      `<img src="/blog-images/weird.png'">`,
      `<img src="/og-default.png">`,
    ].join("\n"),
  );
  await writeFile(
    join(dist, "sitemap-images.xml"),
    `<urlset><image:loc>https://rentierdigital.xyz/blog-images/photo-1234abcd.png</image:loc></urlset>`,
  );
  return { root, dist, cache: join(root, "cache"), images };
}

describe("scripts/blog-image-fallbacks", () => {
  test("remplace le PNG par un JPEG redimensionné et réécrit HTML, JSON-LD et sitemap", async () => {
    const { dist, cache, images } = await fixture();
    const result = await convertBlogImageFallbacks({ distDir: dist, cacheDir: cache });

    expect(result.converted).toBe(2);
    expect(result.rewrittenFiles).toBe(2);
    const files = await readdir(images);
    expect(files.sort()).toEqual(["photo-1234abcd-fb.jpg", "small-aaaa1111-fb.jpg", "weird.png'"]);

    const big = sharp(join(images, "photo-1234abcd-fb.jpg"));
    expect((await big.metadata()).format).toBe("jpeg");
    expect((await big.metadata()).width).toBe(1200);
    expect((await sharp(join(images, "small-aaaa1111-fb.jpg")).metadata()).width).toBe(100);

    const html = await readFile(join(dist, "blog", "a", "index.html"), "utf8");
    expect(html).toContain(`content="https://rentierdigital.xyz/blog-images/photo-1234abcd-fb.jpg"`);
    expect(html).toContain(`src="/blog-images/photo-1234abcd-fb.jpg"`);
    expect(html).toContain(`"image":"https://rentierdigital.xyz/blog-images/small-aaaa1111-fb.jpg"`);
    expect(html).toContain(`src="/blog-images/weird.png'"`);
    expect(html).toContain(`src="/og-default.png"`);
    expect(await readFile(join(dist, "sitemap-images.xml"), "utf8")).toContain("/blog-images/photo-1234abcd-fb.jpg</image:loc>");
  });

  test("aplatit la transparence sur fond blanc", async () => {
    const { dist, cache, images } = await fixture();
    await convertBlogImageFallbacks({ distDir: dist, cacheDir: cache });
    const { data } = await sharp(join(images, "small-aaaa1111-fb.jpg")).raw().toBuffer({ resolveWithObject: true });
    // rouge (200,30,30) à 50 % sur blanc : le vert doit être nettement relevé
    expect(data[1]).toBeGreaterThan(100);
  });

  test("un second passage réutilise le cache sans rappeler l'encodeur", async () => {
    const first = await fixture();
    await convertBlogImageFallbacks({ distDir: first.dist, cacheDir: first.cache });
    const firstBytes = new Uint8Array(await readFile(join(first.images, "photo-1234abcd-fb.jpg")));

    const second = await fixture();
    let calls = 0;
    const result = await convertBlogImageFallbacks({
      distDir: second.dist,
      cacheDir: first.cache,
      encode: async (source) => {
        calls += 1;
        return encodeFallback(source);
      },
    });
    expect(calls).toBe(0);
    expect(result.fromCache).toBe(2);
    expect(Buffer.compare(new Uint8Array(await readFile(join(second.images, "photo-1234abcd-fb.jpg"))), firstBytes) === 0).toBe(true);
  });

  test("échoue si un -fb.jpg existe déjà", async () => {
    const { dist, cache, images } = await fixture();
    await writeFile(join(images, "photo-1234abcd-fb.jpg"), "intrus");
    await expect(convertBlogImageFallbacks({ distDir: dist, cacheDir: cache })).rejects.toThrow("photo-1234abcd-fb.jpg");
    expect((await stat(join(images, "photo-1234abcd.png"))).isFile()).toBe(true);
  });
});
