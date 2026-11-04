import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { CONFIG } from "../scripts/affiliate/integration";
import { buildTrackedAffiliateRuntime, trackrAttributionModulePath } from "../scripts/affiliate/vendor/trackedAffiliateRuntime";

const cacheDirectories: string[] = [];

afterAll(async () => {
  await Promise.all(cacheDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

function quotedConstant(source: string, name: string): string {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*"([^"]+)"`).exec(source);
  if (!match?.[1]) throw new Error(`constante ${name} introuvable dans le paquet trackr-attribution`);
  return match[1];
}

describe("runtime d'attribution des boutons affiliés", () => {
  test("le build embarque le code du paquet trackr-attribution installé", async () => {
    const modulePath = trackrAttributionModulePath();
    expect(modulePath.split(sep).join("/")).toContain("/node_modules/trackr-attribution/");

    const packageSource = await readFile(modulePath, "utf8");
    const storageKey = quotedConstant(packageSource, "STORAGE_KEY");
    const contractSource = await readFile(join(modulePath, "..", "contract.ts"), "utf8");
    const attributionParam = quotedConstant(contractSource, "ATTRIBUTION_PARAM");

    const cacheDirectory = await mkdtemp(join(tmpdir(), "affiliate-runtime-"));
    cacheDirectories.push(cacheDirectory);
    const runtime = await buildTrackedAffiliateRuntime({ config: CONFIG, cacheDirectory });

    // La clé de stockage est un contrat partagé avec trackr : une dérive du paquet installé doit échouer ici.
    expect(storageKey).toBe("trackr.initial-attribution.v1");
    expect(attributionParam).toBe("__trk_attr");
    expect(runtime).toContain(storageKey);
    expect(runtime).toContain(attributionParam);
    // Le nom de fonction initTrackrAttribution est attendu ; seul l'identifiant global isolé est interdit.
    expect(runtime).not.toMatch(/\bTrackrAttribution\b/);
  }, 60_000);
});
