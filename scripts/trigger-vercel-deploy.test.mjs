import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("Vercel deploy workflow contract", () => {
  test("dispatches the cacheable hook directly without checking out the repository", async () => {
    const [vercelJson, workflow] = await Promise.all([
      readFile(new URL("../vercel.json", import.meta.url), "utf8"),
      readFile(new URL("../.github/workflows/deploy-vercel.yml", import.meta.url), "utf8"),
    ]);

    expect(JSON.parse(vercelJson).git).toEqual({ deploymentEnabled: { main: false } });
    expect(workflow).toContain("name: Deploy Vercel production");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain('"public/blog-images/**"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("timeout-minutes: 2");
    expect(workflow).not.toContain("actions/checkout");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain("package-manager-cache: false");
    expect(workflow).toContain("VERCEL_DEPLOY_HOOK: ${{ secrets.ASTRO_VERCEL_DEPLOY_HOOK }}");
    expect(workflow).toContain("process.env.VERCEL_DEPLOY_HOOK");
    expect(workflow).toContain('url.origin !== "https://api.vercel.com"');
    expect(workflow).toContain("url.username || url.password");
    expect(workflow).toContain('url.searchParams.set("buildCache", "true")');
    expect(workflow).toContain('method: "POST"');
    expect(workflow).toContain('redirect: "manual"');
    expect(workflow).toContain("AbortSignal.timeout(30_000)");
    expect(workflow).toContain("response.status < 200 || response.status >= 300");
    expect(workflow.match(/await fetch\(/g)).toHaveLength(1);
    expect(workflow).not.toContain("trigger-vercel-deploy.mjs");
    expect(workflow).not.toContain("console.log(url");
    expect(workflow).not.toContain("console.error(url");
  });
});
