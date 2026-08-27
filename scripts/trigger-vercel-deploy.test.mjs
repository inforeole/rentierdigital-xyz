import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { triggerVercelDeploy } from "./trigger-vercel-deploy.mjs";

describe("triggerVercelDeploy", () => {
  test("posts a cacheable hook URL with an abort signal", async () => {
    let request;

    await triggerVercelDeploy({
      hookUrl: "https://example.test/hook?source=github",
      timeoutMs: 50,
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status: 204 };
      },
    });

    expect(request.url).toBe("https://example.test/hook?source=github&buildCache=true");
    expect(request.options.method).toBe("POST");
    expect(request.options.signal).toBeInstanceOf(AbortSignal);
    expect(request.options.signal.aborted).toBe(false);
  });

  test("replaces a false build cache value", async () => {
    let requestedUrl;

    await triggerVercelDeploy({
      hookUrl: "https://example.test/hook?buildCache=false&source=github",
      fetchImpl: async (url) => {
        requestedUrl = url;
        return { ok: true, status: 200 };
      },
    });

    expect(requestedUrl).toBe("https://example.test/hook?buildCache=true&source=github");
  });

  test("rejects a missing hook URL before requesting", async () => {
    await expect(triggerVercelDeploy({ hookUrl: "" })).rejects.toThrow(
      "ASTRO_VERCEL_DEPLOY_HOOK must be set",
    );
  });

  test("rejects unsuccessful hook responses", async () => {
    await expect(triggerVercelDeploy({
      hookUrl: "https://example.test/hook",
      fetchImpl: async () => ({ ok: false, status: 503 }),
    })).rejects.toThrow("Vercel deploy hook failed: 503");
  });
});

test("Vercel deploy contract retains branch previews and routes main through the hook", async () => {
  const [vercelJson, workflow] = await Promise.all([
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-vercel.yml", import.meta.url), "utf8"),
  ]);

  expect(JSON.parse(vercelJson).git).toEqual({ deploymentEnabled: { main: false } });
  expect(workflow).toContain("name: Deploy Vercel production");
  expect(workflow).toContain("branches: [main]");
  expect(workflow).toContain('"public/blog-images/**"');
  expect(workflow).toContain("workflow_dispatch:");
  expect(workflow).toContain("contents: read");
  expect(workflow).toContain("runs-on: ubuntu-latest");
  expect(workflow).toContain("timeout-minutes: 5");
  expect(workflow).toContain("node scripts/trigger-vercel-deploy.mjs");
  expect(workflow).toContain("secrets.ASTRO_VERCEL_DEPLOY_HOOK");
});
