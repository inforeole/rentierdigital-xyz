import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runImgcoreAudit, runImgcoreFix } from "../scripts/imgcore-fix";

const directories: string[] = [];

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixtureDist(): Promise<{ root: string; dist: string; page: string }> {
  const root = await mkdtemp(join(tmpdir(), "rd-imgcore-"));
  directories.push(root);
  const dist = join(root, "dist");
  await mkdir(join(dist, "blog", "article"), { recursive: true });
  const page = join(dist, "blog", "article", "index.html");
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: "Article", datePublished: "2026-01-01" });
  await writeFile(
    page,
    `<!doctype html><html lang="en"><head><title>Article</title><meta property="og:image" content="https://rentierdigital.xyz/og/article.png"><script type="application/ld+json">${jsonLd}</script></head><body><h1>Article</h1></body></html>`,
  );
  return { root, dist, page };
}

describe("scripts/imgcore-fix", () => {
  test("ajoute l'image og:image au JSON-LD Article qui n'en a pas", async () => {
    const { root, dist, page } = await fixtureDist();
    runImgcoreFix({ distDir: dist, cacheDir: join(root, "cache") });
    const html = await readFile(page, "utf8");
    const match = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
    expect(match).not.toBeNull();
    const data = JSON.parse(match?.[1] ?? "{}") as { image?: unknown };
    expect(JSON.stringify(data.image)).toContain("https://rentierdigital.xyz/og/article.png");
  });

  test("lève une erreur quand le CLI imgcore échoue avec un code non nul", async () => {
    const { root, dist } = await fixtureDist();
    const cli = join(root, "failing-cli.ts");
    await writeFile(cli, 'console.error("boom"); process.exit(3);\n');
    expect(() => runImgcoreFix({ distDir: dist, cli, cacheDir: join(root, "cache") })).toThrow(/code 3[\s\S]*boom/);
  });

  test("lève une erreur quand le CLI dépasse le délai", async () => {
    const { root, dist } = await fixtureDist();
    const cli = join(root, "hanging-cli.ts");
    await writeFile(cli, "await new Promise(() => setInterval(() => {}, 1000));\n");
    expect(() => runImgcoreFix({ distDir: dist, cli, cacheDir: join(root, "cache"), timeoutMs: 500 })).toThrow(/imgcore fix all a échoué/);
  });
});

describe("scripts/imgcore-fix : audit non bloquant", () => {
  async function distWithRemoteImage(): Promise<{ root: string; dist: string; baselinePath: string }> {
    const root = await mkdtemp(join(tmpdir(), "rd-imgcore-audit-"));
    directories.push(root);
    const dist = join(root, "dist");
    await mkdir(dist, { recursive: true });
    await writeFile(
      join(dist, "index.html"),
      '<!doctype html><html lang="en"><head><title>A</title></head><body><main><img src="https://example.test/x.jpg" alt="x"></main></body></html>',
    );
    return { root, dist, baselinePath: join(root, "imgcore-baseline.json") };
  }

  test("une erreur absente de la baseline laisse passer et nomme l'image dans le rapport", async () => {
    const { dist, baselinePath } = await distWithRemoteImage();
    await writeFile(baselinePath, JSON.stringify({ version: 1, fingerprints: [] }));
    const report = runImgcoreAudit({ distDir: dist, baselinePath });
    expect(report).toContain("non bloquant, 1 erreur(s) hors baseline");
    expect(report).toMatch(/nouvelle erreur : img-dimensions {2}index\.html {2}https:\/\/example\.test\/x\.jpg/);
  });

  test("une erreur figée dans la baseline passe", async () => {
    const { dist, baselinePath } = await distWithRemoteImage();
    await writeFile(baselinePath, JSON.stringify({ version: 1, fingerprints: ["img-dimensions|index.html|https://example.test/x.jpg"] }));
    expect(runImgcoreAudit({ distDir: dist, baselinePath })).toContain("0 erreur(s) hors baseline");
  });

  test("une baseline absente est signalée sans faire échouer", async () => {
    const { dist, baselinePath } = await distWithRemoteImage();
    expect(runImgcoreAudit({ distDir: dist, baselinePath })).toMatch(/^non bloquant, audit en échec \(code 2\)/);
  });
});

