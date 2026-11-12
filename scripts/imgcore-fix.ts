import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const IMGCORE_DOMAIN = "rentierdigital.xyz";

// WHY 300 s : mesuré à ~2,5 s cache chaud ; un premier build à froid encode les variantes srcset avec
// sharp. La borne arrête un CLI bloqué sans couper un build à froid légitime.
export const IMGCORE_TIMEOUT_MS = 300_000;

// Dans node_modules/.cache pour que le cache de build de Vercel conserve les variantes d'un build à l'autre.
export const IMGCORE_CACHE_DIR = join(ROOT, "node_modules", ".cache", "imgcore");

/** Résout le CLI d'imgcore installé dans node_modules (`file:../imgcore`), jamais une copie des sources. */
export function resolveImgcoreCli(root: string = ROOT): string {
  const pkg = createRequire(join(root, "package.json")).resolve("imgcore/package.json");
  return join(dirname(pkg), "src", "cli.ts");
}

export interface ImgcoreFixOptions {
  distDir: string;
  cli?: string;
  cacheDir?: string;
  timeoutMs?: number;
}

/** Lance `imgcore fix all` sur le dist ; toute erreur (code non nul, délai dépassé) lève et fait échouer le build. */
export function runImgcoreFix(options: ImgcoreFixOptions): string {
  const cli = options.cli ?? resolveImgcoreCli();
  const args = [cli, "fix", "all", options.distDir, "--domain", IMGCORE_DOMAIN, "--cache", options.cacheDir ?? IMGCORE_CACHE_DIR];
  const run = spawnSync("bun", args, {
    encoding: "utf8",
    timeout: options.timeoutMs ?? IMGCORE_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error) throw new Error(`imgcore fix all a échoué : ${run.error.message}`);
  if (run.status !== 0) {
    const detail = (run.stderr || run.stdout).trim().split("\n").slice(-5).join("\n");
    throw new Error(`imgcore fix all a échoué (code ${String(run.status)})${detail ? `\n${detail}` : ""}`);
  }
  return run.stdout.trim();
}

if (import.meta.main) {
  try {
    console.log(runImgcoreFix({ distDir: join(ROOT, "dist") }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
