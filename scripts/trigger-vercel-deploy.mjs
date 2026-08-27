import { pathToFileURL } from "node:url";

function buildCachedDeployHookUrl(hookUrl) {
  const url = new URL(hookUrl);
  url.searchParams.set("buildCache", "true");
  return url.toString();
}

export async function triggerVercelDeploy({
  hookUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
} = {}) {
  if (!hookUrl?.trim()) {
    throw new Error("ASTRO_VERCEL_DEPLOY_HOOK must be set");
  }

  const response = await fetchImpl(buildCachedDeployHookUrl(hookUrl), {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Vercel deploy hook failed: ${response.status}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  triggerVercelDeploy({ hookUrl: process.env.ASTRO_VERCEL_DEPLOY_HOOK }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
