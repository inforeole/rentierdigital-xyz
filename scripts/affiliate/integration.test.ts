import { expect, test } from "bun:test";
import { parse } from "node-html-parser";
import { createRegistry, loadRegistry, assertSourceAffiliates, CONFIG, type RegistryResponse } from "./integration";
import { transformTrackedAffiliateHtml } from "./vendor/trackedAffiliate";
import { decodeTrackedDestination } from "./vendor/trackedAffiliateObfuscation";
const response: RegistryResponse = {version: 1, unverified: [{slug: "unverified", reason: "missing_source"}], verified: [
  {slug: "offer", name: "Offer", lang: "EN", url_redirection: "https://go.rentierdigital.xyz/rdtoken", token: "rdtoken", campaignId: 1, destinations: ["https://merchant.example/?ref=test"]},
  {slug: "second", name: "Second", lang: "EN", url_redirection: "https://go.gozrk.com/othertoken", token: "othertoken", campaignId: 2, destinations: ["https://second.example/?ref=test"]},
  {slug: "french", name: "French", lang: "FR", url_redirection: "https://go.rentierdigital.xyz/frtoken", token: "frtoken", campaignId: 3, destinations: ["https://merchant.fr/?ref=test"]},
]};
test("both verified tracker hosts retain attribution without exposing their URLs", async () => {
  const html = '<html lang="en"><head></head><body><a class="cta" href="/go/offer">Offer</a><a href="/go/second">Second</a><a href="/go/wizard">My product</a><a href="https://www.amazon.com/dp/OWNBOOK">My book</a></body></html>';
  assertSourceAffiliates(html, response);
  const result = await transformTrackedAffiliateHtml({html, pagePathname: "/blog/article/", registry: createRegistry(response), config: CONFIG, runtimeSource: "void 0"});
  const doc = parse(result.html);const buttons = doc.querySelectorAll(`[${CONFIG.controlAttribute}]`);
  expect(buttons).toHaveLength(2);
  expect(result.html).not.toContain("go.rentierdigital.xyz");expect(result.html).not.toContain("go.gozrk.com");
  expect(doc.querySelector('[href="/go/wizard"]')).not.toBeNull();
  expect(doc.querySelector('[href="https://www.amazon.com/dp/OWNBOOK"]')).not.toBeNull();
  expect(buttons[0]?.getAttribute("class")).toBe("cta");
  const urls = buttons.map(button => new URL(decodeTrackedDestination(button.getAttribute(CONFIG.controlAttribute)!, CONFIG)!));
  expect(urls.map(url => url.origin)).toEqual(["https://go.rentierdigital.xyz", "https://go.gozrk.com"]);
  for (const url of urls) {expect(url.searchParams.get("s1")).toBe("rentierdigital.xyz");expect(url.searchParams.get("s3")).toBe("en");expect(url.searchParams.get("s4")).toBe("/blog/article");}
});
test("unverified aliases and incompatible languages stop publication", () => {
  expect(() => assertSourceAffiliates('<a href="/go/unverified">Offer</a>', response)).toThrow("not verified");
  expect(() => assertSourceAffiliates('<html lang="en"><a href="/go/french">Offre</a></html>', response)).toThrow("language mismatch");
});

test("approved Contabo placements use the verified transport and preserve attribution", async () => {
  const data = loadRegistry();
  const row = data.verified.find(row => row.slug === "contabo-openclaw")!;
  const html = `<html lang="en"><head></head><body><a class="cta" href="${row.destinations[0]}">Contabo</a></body></html>`;
  assertSourceAffiliates(html, data);
  const options = {html, config: CONFIG, runtimeSource: "void 0", pagePathname: "/blog/openclaw-architecture-scaling-guide"};
  const result = await transformTrackedAffiliateHtml({...options, registry: createRegistry(data)});
  const button = parse(result.html).querySelector(`[${CONFIG.controlAttribute}]`)!;
  const target = new URL(decodeTrackedDestination(button.getAttribute(CONFIG.controlAttribute)!, CONFIG)!);
  expect(target.origin + target.pathname).toBe("https://go.rentierdigital.xyz/nUmYSJS");
  expect(target.searchParams.get("s1")).toBe("rentierdigital.xyz");
  expect(target.searchParams.get("s4")).toBe(options.pagePathname);
  expect(button.getAttribute("href")).toBeUndefined();
  expect(button.getAttribute("class")).toBe("cta");
  expect(result.html).not.toContain("100429498");
  await expect(transformTrackedAffiliateHtml({...options, registry: createRegistry(response)})).rejects.toThrow();
});

test("the local registry loads without private credentials and rejects unknown aliases", async () => {
  const registry = createRegistry(loadRegistry());
  expect(Object.keys(registry.verifiedGoLinks).length).toBeGreaterThan(0);
  await expect(transformTrackedAffiliateHtml({html: '<html lang="en"><body><a href="/go/new-unverified-offer">Offer</a></body></html>', pagePathname: '/blog/new', registry, config: CONFIG, runtimeSource: 'void 0'})).rejects.toThrow("sans jeton");
});
